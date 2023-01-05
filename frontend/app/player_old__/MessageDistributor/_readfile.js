

const { default: MFileReader } = require( './messages/MFileReader.ts');
const fs = require( 'fs' )
const { default: WindowNodeCounter } = require('./managers/WindowNodeCounter.ts')

const readline = require('readline');

function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }))
}



const b = fs.readFileSync('/Users/workspace/Downloads/7711911443932875');
const arrBuff = new Uint8Array(b.buffer, b.byteOffset, b.byteLength / Uint8Array.BYTES_PER_ELEMENT);

const fReader = new MFileReader(arrBuff)

let next
let msgs = []
let len = 0
let lastIndex = 0


//const mtps = [  "set_node_attribute", "create_element_node", "set_node_data", "remove_node", "create_text_node"]

const counter = new WindowNodeCounter()

//const ids = {}
const byTypes = {}
const hysto = []
let time = 0
let prevCount =0
//let harshTimes = {}

let texts = {}
let timeTexts = 0

while (next = fReader.next()) {
  const [msg, index] = next
  //msgs.push(msg)
  if (isNaN(index)) break;
  // if (msg.id) {
  //     ids[msg.id] = ids[msg.id] ? ids[msg.id] + 1 : 1
  // }
  switch (msg.tp) {
          case "create_document":
            counter.reset();
            break;
          case "create_text_node":
          case "create_element_node":
            counter.addNode(msg.id, msg.parentID);
            break;
          case "move_node":
            counter.moveNode(msg.id, msg.parentID);
            break;
          case "remove_node":
            counter.removeNode(msg.id);
            break;            
        }
  //       const countDiff = counter.count - prevCount
    // if (time !== msg.time && Math.abs( countDiff/(msg.time - time)) > 1 ) {
    //     harshTimes[msg.time] = countDiff
    // }

  if (msg.tp === "set_node_data") {
      if (msg.data.length === 8 && msg.data[2] === ':') {
                
                timeTexts++
            } else {
                texts[msg.data] = texts[msg.data] ? texts[msg.data] + 1 : 1
            }
  }

  const tPart = Math.round(msg.time/5/1000/60)
  if (time > msg.time) {
      console.log("AGA!", time, msg.time)
      break
  }
  time = msg.time
  if (msg.tp === "remove_node") { hysto[tPart] = hysto[tPart] ? hysto[tPart] + 1 : 1 }
    len++
    byTypes[msg.tp] = byTypes[msg.tp] ? byTypes[msg.tp] + 1 : 1

    lastIndex = index
}

console.log(
    byTypes,
    len,
    //lastIndex,
    //hysto,
    texts,
    timeTexts,
    )
// for () {

// }

