import MFileReader from './frontend/app/player/web/messages/MFileReader';
import {
  MType,
} from './frontend/app/player/web/messages/raw.gen';

import fs from 'fs'



const FILE =  "../7965577627254796"//"../7964908131926074.mobs"//"../7965498112203651"// "../wrong-ids-2.mobs"
// const data = fs.readFileSync(FILE)

const logger = {
	log(){},
	error(){},
	warn(){},
	group(){},
}

function readBytes(fd, sharedBuffer) {
    return new Promise((resolve, reject) => {
        fs.read(
            fd, 
            sharedBuffer,
            0,
            sharedBuffer.length,
            null,
            (err) => {
                if(err) { return reject(err); }
                resolve();
            }
        );
    });
}
async function* generateChunks(filePath, size) {
    const sharedBuffer = Buffer.alloc(size);
    const stats = fs.statSync(filePath); // file details
    const fd = fs.openSync(filePath); // file descriptor
    let bytesRead = 0; // how many bytes were read
    let end = size; 
    
    for(let i = 0; i < Math.ceil(stats.size / size); i++) {
        await readBytes(fd, sharedBuffer);
        bytesRead = (i + 1) * size;
        if(bytesRead > stats.size) {
           // When we reach the end of file, 
           // we have to calculate how many bytes were actually read
           end = size - (bytesRead - stats.size);
        }
        yield sharedBuffer.slice(0, end);
    }
}



const fileReader = new MFileReader(new Uint8Array(), 0, logger)
const mapByTp = {}


const CHUNK_SIZE = 100000000; // 100MB
let lastI = 0
async function main() {  
	let i = 0
  for await(const chunk of generateChunks(FILE, CHUNK_SIZE)) {
  	fileReader.append(chunk)
  	i++

  	let next
		while (next = fileReader.next()) {
		  const [msg, index] = next
          lastI = isNaN(index) ? lastI : index
		  mapByTp[msg.tp] = mapByTp[msg.tp] ? mapByTp[msg.tp]+1 : 1
		}
    
		console.log(i, "out of ...", )
  }
  
	console.log(mapByTp, lastI)

}

 main()



