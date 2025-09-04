import PQueue from "p-queue"

export interface QueueOptions {
  concurrency?: number
  interval?: number
  intervalCap?: number
  timeout?: number
}

export class TaskQueue {
  private queue: PQueue

  constructor(options: QueueOptions = {}) {
    this.queue = new PQueue({
      concurrency: options.concurrency || 5,
      interval: options.interval,
      intervalCap: options.intervalCap,
      timeout: options.timeout,
    })
  }

  async add<T>(task: () => Promise<T>, priority = 0): Promise<T> {
    return this.queue.add(task, { priority })
  }

  get size(): number {
    return this.queue.size
  }

  get pending(): number {
    return this.queue.pending
  }

  get isPaused(): boolean {
    return this.queue.isPaused
  }

  pause(): void {
    this.queue.pause()
  }

  start(): void {
    this.queue.start()
  }

  clear(): void {
    this.queue.clear()
  }

  async onEmpty(): Promise<void> {
    return this.queue.onEmpty()
  }

  async onIdle(): Promise<void> {
    return this.queue.onIdle()
  }
}
