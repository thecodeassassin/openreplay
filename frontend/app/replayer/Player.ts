import * as localStorage from './localStorage';





export default class Player {
  constructor() {

  }


  toggleInspectorMode(flag, clickCallback) {
    if (typeof flag !== 'boolean') {
      const { inspectorMode } = getState();
      flag = !inspectorMode;
    }

    if (flag) {
      this.pause();
      update({ inspectorMode: true });
      return super.enableInspector(clickCallback);
    } else {
      super.disableInspector();
      update({ inspectorMode: false });
    }
  }

  markTargets(targets: { selector: string, count: number }[] | null) {
    this.pause();
    this.setMarkedTargets(targets);
  }

  activeTarget(index) {
    this.setActiveTarget(index);
  }


  toggleSkip() {
    const skip = !this.state.get().skip
    localStorage.setItem(SKIP_STORAGE_KEY, skip)
    this.state.update({ skip })
  }

  toggleSkipToIssue() {
    const skipToIssue = !this.state.get().skipToIssue
    localStorage.setItem(SKIP_TO_ISSUE_STORAGE_KEY, skipToIssue)
    this.state.update({ skipToIssue })
  }

  toggleAutoplay() {
    const autoplay = !this.state.get().autoplay
    localStorage.setItem(AUTOPLAY_STORAGE_KEY, autoplay)
    this.state.update({ autoplay })
  }

  toggleEvents() {
    const showEvents = !this.state.get().showEvents
    localStorage.setItem(SHOW_EVENTS_STORAGE_KEY, showEvents)
    this.state.update({ showEvents })
  }

  
  private updateSpeed(speed: number) {
    localStorage.setItem(SPEED_STORAGE_KEY, speed)
    this.state.update({ speed })
  }

  toggleSpeed() {
    const { speed } = this.state.get()
    this.updateSpeed(speed < HIGHEST_SPEED ? speed * 2 : 1)
  }

  speedUp() {
    const { speed } = this.state.get()
    this.updateSpeed(Math.min(HIGHEST_SPEED, speed * 2))
  }

  speedDown() {
    const { speed } = this.state.get()
    this.updateSpeed(Math.max(1, speed / 2))
  }

}