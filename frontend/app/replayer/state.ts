


export interface StateManager<T extends Object> {
  get(): T
  update(state: Partial<T>): void
  subscribe(cb: (state: T) => void)
}