type Listener<T> = (value: T) => void

/** A small typed event emitter that runs anywhere (no node:events). */
export class Emitter<Events extends Record<string, unknown>> {
  private readonly listeners: {
    [K in keyof Events]?: Set<Listener<Events[K]>>
  } = {}

  /** Returns a function that removes the listener. */
  on<K extends keyof Events>(type: K, listener: Listener<Events[K]>): () => void {
    const set = (this.listeners[type] ??= new Set())
    set.add(listener)
    return () => {
      set.delete(listener)
    }
  }

  emit<K extends keyof Events>(type: K, value: Events[K]): void {
    for (const listener of this.listeners[type] ?? []) listener(value)
  }
}
