//@ts-ignore
import Tracker from '../../..'

//@ts-ignore
window.Worker = class Worker {
  constructor(str: string) {}
  postMessage(msg: any) {
    console.log('post message', msg)
  }
}

const startFetchMock = function () {
  console.log('/start')
  return Promise.resolve({
    status: 200,
    json() {
      return {
        token: 'sometoken',
        userUUID: 'userUUID-userUUID',
        //projectID: ,
        //beaconSizeLimit,
        delay: 0,
        sessionID: 123,
        startTimestamp: Date.now(),
      }
    },
  })
}

export function initTracker() {
  // mock fetch
  // mock WebWorker
  // or ?? mock send()

  const tracker = new Tracker({
    projectKey: 'blabliblu',
  })

  return tracker
}
