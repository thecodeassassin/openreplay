import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals'
import { initTracker } from './common.integration'

describe('', () => {
  test('b', () => {
    const tracker = initTracker()
    tracker.start()
  })
})
