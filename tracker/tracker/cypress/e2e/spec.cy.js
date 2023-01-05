import Tracker from '../..'

class Worker {
  constructor(str) {}
  postMessage(msg) {
    console.log('post message')
  }
}

const startFetchMock = function () {
  console.log('allo?')
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

describe('template spec', () => {
  it('passes', async () => {
    cy.visit('cypress/e2e/index.html')
    cy.intercept(
      {
        method: 'POST', // Route all GET requests
        url: '/ingest/v1/web/start', // that have a URL that matches '/users/*'
      },
      {
        token: 'sometoken',
        userUUID: 'userUUID-userUUID',
        //projectID: ,
        //beaconSizeLimit,
        delay: 0,
        sessionID: 123,
        startTimestamp: Date.now(),
      },
    ).as('/start')
    await cy.window().then((win) => {
      win.Worker = Worker
      console.log(Worker, win.fetch)

      const tracker = new Tracker({
        projectKey: 'whatewer',
        __DISABLE_SECURE_MODE: true,
      })
      tracker.start()
    })
  })
})
