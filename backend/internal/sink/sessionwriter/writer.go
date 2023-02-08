package sessionwriter

import (
	"fmt"
	"log"
	"sync"
	"time"
)

type Task struct {
	sessID uint64
	domBuf []byte
	devBuf []byte
}

type SessionWriter struct {
	filesLimit  int
	workingDir  string
	fileBuffer  int
	syncTimeout time.Duration
	meta        *Meta
	sessions    *sync.Map
	done        chan struct{}
	finished    chan struct{}
	stopped     chan struct{}
	tasks       chan *Task
}

func NewWriter(filesLimit uint16, workingDir string, fileBuffer int, syncTimeout int) *SessionWriter {
	w := &SessionWriter{
		filesLimit:  int(filesLimit) / 2, // should divide by 2 because each session has 2 files
		workingDir:  workingDir + "/",
		fileBuffer:  fileBuffer,
		syncTimeout: time.Duration(syncTimeout) * time.Second,
		meta:        NewMeta(int(filesLimit)),
		sessions:    &sync.Map{},
		done:        make(chan struct{}),
		finished:    make(chan struct{}),
		stopped:     make(chan struct{}),
		tasks:       make(chan *Task, 5), // test value
	}
	go w.writer()
	go w.synchronizer()
	return w
}

func (w *SessionWriter) Write(sid uint64, domBuffer, devBuffer []byte) (err error) {
	w.tasks <- &Task{
		sessID: sid,
		domBuf: domBuffer,
		devBuf: devBuffer,
	}
	return nil
}

func (w *SessionWriter) write(sid uint64, domBuffer, devBuffer []byte) (err error) {
	var sess *Session

	// Load session
	sessObj, ok := w.sessions.Load(sid)
	if !ok {
		// Create new session
		sess, err = NewSession(sid, w.workingDir, w.fileBuffer)
		if err != nil {
			return fmt.Errorf("can't create session: %d, err: %s", sid, err)
		}

		// Check opened sessions limit and close extra session if you need to
		if extraSessID := w.meta.GetExtra(); extraSessID != 0 {
			if err := w.Close(extraSessID); err != nil {
				log.Printf("can't close session: %s", err)
			}
		}

		// Add created session
		w.sessions.Store(sid, sess)
		w.meta.Add(sid)
	} else {
		sess = sessObj.(*Session)
	}

	// Write data to session
	return sess.Write(domBuffer, devBuffer)
}

func (w *SessionWriter) sync(sid uint64) error {
	sessObj, ok := w.sessions.Load(sid)
	if !ok {
		return fmt.Errorf("session: %d not found", sid)
	}
	sess := sessObj.(*Session)
	return sess.Sync()
}

func (w *SessionWriter) Close(sid uint64) error {
	sessObj, ok := w.sessions.LoadAndDelete(sid)
	if !ok {
		return fmt.Errorf("session: %d not found", sid)
	}
	sess := sessObj.(*Session)
	err := sess.Close()
	w.meta.Delete(sid)
	return err
}

func (w *SessionWriter) Stop() {
	w.done <- struct{}{}
	<-w.stopped
}

func (w *SessionWriter) Info() string {
	return fmt.Sprintf("%d sessions", w.meta.Count())
}

func (w *SessionWriter) Sync() {
	w.sessions.Range(func(sid, lockObj any) bool {
		if err := w.sync(sid.(uint64)); err != nil {
			log.Printf("can't sync file descriptor: %s", err)
		}
		return true
	})
}

func (w *SessionWriter) writer() {
	for {
		select {
		case t := <-w.tasks:
			if err := w.write(t.sessID, t.domBuf, t.devBuf); err != nil {
				log.Printf("session write err: %s", err)
			}
		case <-w.done:
			for t := range w.tasks {
				if err := w.write(t.sessID, t.domBuf, t.devBuf); err != nil {
					log.Printf("session write err: %s", err)
				}
			}
			log.Printf("writer have written all buffers from tasks queue")
			w.finished <- struct{}{}
			return
		}
	}
}

func (w *SessionWriter) synchronizer() {
	tick := time.Tick(w.syncTimeout)
	for {
		select {
		case <-tick:
			w.Sync()
		case <-w.finished: // writer have written all buffers from tasks queue, can do final sync
			w.sessions.Range(func(sid, lockObj any) bool {
				if err := w.Close(sid.(uint64)); err != nil {
					log.Printf("can't close file descriptor: %s", err)
				}
				return true
			})
			log.Printf("syncer have flushed and closed all files")
			w.stopped <- struct{}{}
			return
		}
	}
}
