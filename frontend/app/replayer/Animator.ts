import type { StateManager } from './state';
import * as localStorage from './localStorage';

const fps = 60
const performance = window.performance || { now: Date.now.bind(Date) }
const requestAnimationFrame =
  window.requestAnimationFrame ||
  // @ts-ignore
  window.webkitRequestAnimationFrame ||
  // @ts-ignore
  window.mozRequestAnimationFrame ||
  // @ts-ignore
  window.oRequestAnimationFrame ||
  // @ts-ignore
  window.msRequestAnimationFrame ||
  (callback => window.setTimeout(() => { callback(performance.now()) }, 1000 / fps))
const cancelAnimationFrame =
  window.cancelAnimationFrame ||
  // @ts-ignore
  window.mozCancelAnimationFrame ||
  window.clearTimeout

const HIGHEST_SPEED = 16


const SPEED_STORAGE_KEY = "__$player-speed$__"
const SKIP_STORAGE_KEY = "__$player-skip$__"
const SKIP_TO_ISSUE_STORAGE_KEY = "__$session-skipToIssue$__"
const AUTOPLAY_STORAGE_KEY = "__$player-autoplay$__"
const SHOW_EVENTS_STORAGE_KEY = "__$player-show-events$__"
const storedSpeed: number = localStorage.int(SPEED_STORAGE_KEY))
const initialSpeed = [1, 2, 4, 8, 16].includes(storedSpeed) ? storedSpeed : 1
const initialSkip = localStorage.bool(SKIP_STORAGE_KEY)
const initialSkipToIssue = localStorage.bool(SKIP_TO_ISSUE_STORAGE_KEY)
const initialAutoplay = localStorage.bool(AUTOPLAY_STORAGE_KEY)
const initialShowEvents = localStorage.bool(SHOW_EVENTS_STORAGE_KEY)



interface State {
  time: number
  playing: boolean
  completed: boolean
  endTime: number
  live: boolean
  livePlay: boolean

  skip: boolean
  skipToIssue: boolean
  autoplay: boolean
  speed: number
  showEvents: boolean
}

export const INITIAL_STATE = {
  time: 0,
  playing: false,
  completed: false,
  endTime: 0,
  live: false,
  livePlay: false,
} as const


export const INITIAL_NON_RESETABLE_STATE = {
  skip: initialSkip,
  skipToIssue: initialSkipToIssue,
  autoplay: initialAutoplay,
  speed: initialSpeed,
  showEvents: initialShowEvents
}

export default class Animator {
  private animationFrameRequestId: number = 0

  constructor(private state: StateManager<State>) {}

  private setTime(time: number, index?: number) {
    this.state.update({
      time,
      completed: false,
    })
    // ?
    // super.move(time, index)
    // listsGoTo(time, index)
  }

  private startAnimation() {
    let prevTime = this.state.get().time
    let animationPrevTime = performance.now()

    const nextFrame = (animationCurrentTime) => {
      const {
        speed,
        skip,
        autoplay,
        skipIntervals,
        endTime,
        live,
        livePlay,
        ready,  // = messagesLoading || cssLoading || disconnected
        lastMessageTime, // should be updated
      } = this.state.get()

      const diffTime = !ready
        ? 0
        : Math.max(animationCurrentTime - animationPrevTime, 0) * (live ? 1 : speed)

      let time = prevTime + diffTime

      const skipInterval = skip && skipIntervals.find(si => si.contains(time))  // TODO: good skip by messages
      if (skipInterval) time = skipInterval.end

      if (time < 0) { time = 0 } // ?

      if (livePlay && time < lastMessageTime) { time = lastMessageTime }
      if (endTime < lastMessageTime) {
        this.state.update({
          endTime: lastMessageTime,
        })
      }

      prevTime = time
      animationPrevTime = animationCurrentTime

      const completed = !live && time >= endTime
      if (completed) {
        this.setTime(endTime)
        return this.state.update({
          playing: false,
          completed: true,
        })
      }

      if (live && time > endTime) {
        this.state.update({
          endTime: time,
        })
      }
      this.setTime(time)
      this.animationFrameRequestId = requestAnimationFrame(nextFrame)
    }
    this.animationFrameRequestId = requestAnimationFrame(nextFrame)
  }

  play() {
    cancelAnimationFrame(this.animationFrameRequestId)
    this.state.update({ playing: true })
    this.startAnimation()
  }

  pause() {
    cancelAnimationFrame(this.animationFrameRequestId)
    this.state.update({ playing: false })
  }

  togglePlay() {
    const { playing, completed } = this.state.get()
    if (playing) {
      this.pause()
    } else if (completed) {
      this.setTime(0)
      this.play()
    } else {
      this.play()
    }
  }

  jump(time: number = this.state.get().time, index?: number) {
    const { live } = this.state.get()
    if (live) return

    if (this.state.get().playing) {
      cancelAnimationFrame(this.animationFrameRequestId)
      this.setTime(time, index)
      this.startAnimation()
      this.state.update({ livePlay: time === this.state.get().endTime })
    } else {
      this.setTime(time, index)
      this.state.update({ livePlay: time === this.state.get().endTime })
    }
  }


}