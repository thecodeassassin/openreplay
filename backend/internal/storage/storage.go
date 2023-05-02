package storage

import (
	"bytes"
	"fmt"
	"github.com/andybalholm/brotli"
	"io"
	"log"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	config "openreplay/backend/internal/config/storage"
	"openreplay/backend/pkg/messages"
	metrics "openreplay/backend/pkg/metrics/storage"
	"openreplay/backend/pkg/storage"

	gzip "github.com/klauspost/pgzip"
)

type FileType string

const (
	DOM FileType = "/dom.mob"
	DEV FileType = "/devtools.mob"
)

func (t FileType) String() string {
	if t == DOM {
		return "dom"
	}
	return "devtools"
}

type Task struct {
	id     string
	key    string
	domRaw []byte
	devRaw []byte
	doms   *bytes.Buffer
	dome   *bytes.Buffer
	dev    *bytes.Buffer
}

func (t *Task) SetMob(mob []byte, tp FileType) {
	if tp == DOM {
		t.domRaw = mob
	} else {
		t.devRaw = mob
	}
}

func (t *Task) Mob(tp FileType) []byte {
	if tp == DOM {
		return t.domRaw
	}
	return t.devRaw
}

type Storage struct {
	cfg                 *config.Config
	s3                  *storage.S3
	startBytes          []byte
	compressionTasks    chan *Task // brotli compression or gzip compression with encryption
	uploadingTasks      chan *Task // upload to s3
	readyForCompression chan struct{}
	readyForUploading   chan struct{}
}

func New(cfg *config.Config, s3 *storage.S3) (*Storage, error) {
	switch {
	case cfg == nil:
		return nil, fmt.Errorf("config is empty")
	case s3 == nil:
		return nil, fmt.Errorf("s3 storage is empty")
	}
	newStorage := &Storage{
		cfg:                 cfg,
		s3:                  s3,
		startBytes:          make([]byte, cfg.FileSplitSize),
		compressionTasks:    make(chan *Task, 1),
		uploadingTasks:      make(chan *Task, 1),
		readyForCompression: make(chan struct{}),
		readyForUploading:   make(chan struct{}),
	}
	go newStorage.compressionWorker()
	go newStorage.uploadingWorker()
	return newStorage, nil
}

func (s *Storage) Wait() {
	<-s.readyForCompression
	<-s.readyForUploading
}

func (s *Storage) Process(msg *messages.SessionEnd) (err error) {
	// Generate file path
	sessionID := strconv.FormatUint(msg.SessionID(), 10)
	filePath := s.cfg.FSDir + "/" + sessionID

	// Prepare sessions
	newTask := &Task{
		id:  sessionID,
		key: msg.EncryptionKey,
	}
	wg := &sync.WaitGroup{}
	wg.Add(2)
	go func() {
		if prepErr := s.prepareSession(filePath, DOM, newTask); prepErr != nil {
			err = fmt.Errorf("prepareSession DOM err: %s", prepErr)
		}
		wg.Done()
	}()
	go func() {
		if prepErr := s.prepareSession(filePath, DEV, newTask); prepErr != nil {
			err = fmt.Errorf("prepareSession DEV err: %s", prepErr)
		}
		wg.Done()
	}()
	wg.Wait()
	if err != nil {
		if strings.Contains(err.Error(), "big file") {
			log.Printf("%s, sess: %d", err, msg.SessionID())
			metrics.IncreaseStorageTotalSkippedSessions()
			return nil
		}
		return err
	}

	// Send new task to compression worker
	s.compressionTasks <- newTask
	// Unload worker
	<-s.readyForCompression
	return nil
}

func (s *Storage) openSession(filePath string, tp FileType) ([]byte, error) {
	if tp == DEV {
		filePath += "devtools"
	}
	// Check file size before download into memory
	info, err := os.Stat(filePath)
	if err == nil && info.Size() > s.cfg.MaxFileSize {
		metrics.RecordSkippedSessionSize(float64(info.Size()), tp.String())
		return nil, fmt.Errorf("big file, size: %d", info.Size())
	}
	// Read file into memory
	raw, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}
	if !s.cfg.UseSort {
		return raw, nil
	}
	start := time.Now()
	res, err := s.sortSessionMessages(raw)
	if err != nil {
		return nil, fmt.Errorf("can't sort session, err: %s", err)
	}
	metrics.RecordSessionSortDuration(float64(time.Now().Sub(start).Milliseconds()), tp.String())
	return res, nil
}

func (s *Storage) sortSessionMessages(raw []byte) ([]byte, error) {
	// Parse messages, sort by index and save result into slice of bytes
	unsortedMessages, err := messages.SplitMessages(raw)
	if err != nil {
		log.Printf("can't sort session, err: %s", err)
		return raw, nil
	}
	return messages.MergeMessages(raw, messages.SortMessages(unsortedMessages)), nil
}

func (s *Storage) prepareSession(path string, tp FileType, task *Task) error {
	// Open session file
	startRead := time.Now()
	mob, err := s.openSession(path, tp)
	if err != nil {
		return err
	}
	metrics.RecordSessionReadDuration(float64(time.Now().Sub(startRead).Milliseconds()), tp.String())
	metrics.RecordSessionSize(float64(len(mob)), tp.String())

	// Put opened session file into task struct
	task.SetMob(mob, tp)
	return nil
}

func (s *Storage) packSession(task *Task, tp FileType) {
	// If encryption key is empty, pack session using better algorithm
	if task.key == "" {
		s.packSessionBetter(task, tp)
		return
	}

	// Prepare mob file
	mob := task.Mob(tp)

	if tp == DEV || len(mob) <= s.cfg.FileSplitSize {
		// Compression
		start := time.Now()
		data := s.compressSession(mob)
		metrics.RecordSessionCompressDuration(float64(time.Now().Sub(start).Milliseconds()), tp.String())

		// Encryption
		start = time.Now()
		result := s.encryptSession(data.Bytes(), task.key)
		metrics.RecordSessionEncryptionDuration(float64(time.Now().Sub(start).Milliseconds()), tp.String())

		if tp == DOM {
			task.doms = bytes.NewBuffer(result)
		} else {
			task.dev = bytes.NewBuffer(result)
		}
		return
	}

	// Prepare two workers
	wg := &sync.WaitGroup{}
	wg.Add(2)
	var firstPart, secondPart, firstEncrypt, secondEncrypt int64

	// DomStart part
	go func() {
		// Compression
		start := time.Now()
		data := s.compressSession(mob[:s.cfg.FileSplitSize])
		firstPart = time.Since(start).Milliseconds()

		// Encryption
		start = time.Now()
		task.doms = bytes.NewBuffer(s.encryptSession(data.Bytes(), task.key))
		firstEncrypt = time.Since(start).Milliseconds()

		// Finish task
		wg.Done()
	}()
	// DomEnd part
	go func() {
		// Compression
		start := time.Now()
		data := s.compressSession(mob[s.cfg.FileSplitSize:])
		secondPart = time.Since(start).Milliseconds()

		// Encryption
		start = time.Now()
		task.dome = bytes.NewBuffer(s.encryptSession(data.Bytes(), task.key))
		secondEncrypt = time.Since(start).Milliseconds()

		// Finish task
		wg.Done()
	}()
	wg.Wait()

	// Record metrics
	metrics.RecordSessionEncryptionDuration(float64(firstEncrypt+secondEncrypt), tp.String())
	metrics.RecordSessionCompressDuration(float64(firstPart+secondPart), tp.String())
}

// packSessionBetter is a new version of packSession that uses brotli compression (only if we are not using encryption)
func (s *Storage) packSessionBetter(task *Task, tp FileType) {
	// Prepare mob file
	mob := task.Mob(tp)

	if tp == DEV || len(mob) <= s.cfg.FileSplitSize {
		// Compression
		start := time.Now()
		result := s.compressSessionBetter(mob)
		metrics.RecordSessionCompressDuration(float64(time.Now().Sub(start).Milliseconds()), tp.String())

		if tp == DOM {
			task.doms = result
		} else {
			task.dev = result
		}
		return
	}

	// Prepare two workers
	wg := &sync.WaitGroup{}
	wg.Add(2)
	var firstPart, secondPart, firstEncrypt, secondEncrypt int64

	// DomStart part
	go func() {
		// Compression
		start := time.Now()
		task.doms = s.compressSessionBetter(mob[:s.cfg.FileSplitSize])
		firstPart = time.Since(start).Milliseconds()

		// Finish task
		wg.Done()
	}()
	// DomEnd part
	go func() {
		// Compression
		start := time.Now()
		task.dome = s.compressSessionBetter(mob[s.cfg.FileSplitSize:])
		secondPart = time.Since(start).Milliseconds()

		// Finish task
		wg.Done()
	}()
	wg.Wait()

	// Record metrics
	metrics.RecordSessionEncryptionDuration(float64(firstEncrypt+secondEncrypt), tp.String())
	metrics.RecordSessionCompressDuration(float64(firstPart+secondPart), tp.String())
}

func (s *Storage) encryptSession(data []byte, encryptionKey string) []byte {
	var encryptedData []byte
	var err error
	if encryptionKey != "" {
		encryptedData, err = EncryptData(data, []byte(encryptionKey))
		if err != nil {
			log.Printf("can't encrypt data: %s", err)
			encryptedData = data
		}
	} else {
		encryptedData = data
	}
	return encryptedData
}

func (s *Storage) compressSession(data []byte) *bytes.Buffer {
	zippedMob := new(bytes.Buffer)
	z, _ := gzip.NewWriterLevel(zippedMob, gzip.DefaultCompression)
	if _, err := z.Write(data); err != nil {
		log.Printf("can't write session data to compressor: %s", err)
	}
	if err := z.Close(); err != nil {
		log.Printf("can't close compressor: %s", err)
	}
	return zippedMob
}

func (s *Storage) compressSessionBetter(data []byte) *bytes.Buffer {
	out := bytes.Buffer{}
	writer := brotli.NewWriterOptions(&out, brotli.WriterOptions{Quality: brotli.DefaultCompression})
	in := bytes.NewReader(data)
	n, err := io.Copy(writer, in)
	if err != nil {
		log.Printf("can't write session data to compressor: %s", err)
	}

	if int(n) != len(data) {
		log.Printf("wrote less data than expected: %d vs %d", n, len(data))
	}

	if err := writer.Close(); err != nil {
		log.Printf("can't close compressor: %s", err)
	}
	return &out
}

func (s *Storage) uploadSession(task *Task) {
	log.Printf("new upload task: %s", task.id)
	wg := &sync.WaitGroup{}
	wg.Add(3)
	var (
		uploadDoms int64 = 0
		uploadDome int64 = 0
		uploadDev  int64 = 0
	)
	compression := storage.NoCompression
	if task.key == "" {
		compression = storage.Brotli
	}
	go func() {
		if task.doms != nil {
			start := time.Now()
			if err := s.s3.Upload(task.doms, task.id+string(DOM)+"s", "application/octet-stream", compression); err != nil {
				log.Fatalf("Storage: start upload failed.  %s", err)
			}
			uploadDoms = time.Now().Sub(start).Milliseconds()
		}
		wg.Done()
	}()
	go func() {
		if task.dome != nil {
			start := time.Now()
			if err := s.s3.Upload(task.dome, task.id+string(DOM)+"e", "application/octet-stream", compression); err != nil {
				log.Fatalf("Storage: start upload failed.  %s", err)
			}
			uploadDome = time.Now().Sub(start).Milliseconds()
		}
		wg.Done()
	}()
	go func() {
		if task.dev != nil {
			start := time.Now()
			if err := s.s3.Upload(task.dev, task.id+string(DEV), "application/octet-stream", compression); err != nil {
				log.Fatalf("Storage: start upload failed.  %s", err)
			}
			uploadDev = time.Now().Sub(start).Milliseconds()
		}
		wg.Done()
	}()
	wg.Wait()
	metrics.RecordSessionUploadDuration(float64(uploadDoms+uploadDome), DOM.String())
	metrics.RecordSessionUploadDuration(float64(uploadDev), DEV.String())
	metrics.IncreaseStorageTotalSessions()
}

func (s *Storage) doCompression(task *Task) {
	log.Printf("new compression task: %s", task.id)
	wg := &sync.WaitGroup{}
	wg.Add(2)
	go func() {
		s.packSession(task, DOM)
		wg.Done()
	}()
	go func() {
		s.packSession(task, DEV)
		wg.Done()
	}()
	wg.Wait()
	s.uploadingTasks <- task
}

func (s *Storage) compressionWorker() {
	for {
		select {
		case task := <-s.compressionTasks:
			s.doCompression(task)
		default:
			// Signal that worker finished all tasks
			s.readyForCompression <- struct{}{}
		}
	}
}

func (s *Storage) uploadingWorker() {
	for {
		select {
		case task := <-s.uploadingTasks:
			s.uploadSession(task)
		default:
			// Signal that worker finished all tasks
			s.readyForUploading <- struct{}{}
		}
	}
}
