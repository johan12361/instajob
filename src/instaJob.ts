import type { JobConfig } from './types/config.js'

export class InstaJob<T> {
  config: JobConfig<T>
  private readonly activeTimers = new Set<NodeJS.Timeout>()
  private readonly log: (...args: unknown[]) => void

  constructor(config: JobConfig<T>) {
    this.config = config
    this.log = config.logging === true ? console.log.bind(console, '[InstaJob]') : (): void => {}
  }

  async start(): Promise<void> {
    this.log('Starting — interval:', this.config.checkIntervalMs, 'ms')
    await this.processQueue()
    setInterval(() => void this.processQueue(), this.config.checkIntervalMs)
  }

  private async processQueue(): Promise<void> {
    try {
      this.log('Cycle started —', new Date().toISOString())
      const items = await this.config.fetchJobs()
      this.log('Jobs fetched:', items.length)

      const parallel = this.config.parallel ?? true

      if (parallel) {
        for (const item of items) {
          const runDate = this.config.getRunDate(item)
          const delay = runDate.getTime() - Date.now()

          if (delay <= this.config.checkIntervalMs) {
            this.log('Scheduling job (parallel) in', Math.max(0, delay), 'ms')
            this.createTimeout(item, Math.max(0, delay))
          }
        }
      } else {
        for (const item of items) {
          const runDate = this.config.getRunDate(item)
          const delay = runDate.getTime() - Date.now()

          if (delay <= this.config.checkIntervalMs) {
            this.log('Scheduling job (sequential) in', Math.max(0, delay), 'ms')
            await this.waitAndExecute(item, Math.max(0, delay))
          }
        }
      }
    } catch (error) {
      console.error('[InstaJob] Error during job fetch cycle:', error)
    }
  }

  private waitAndExecute(item: T, delay: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.activeTimers.delete(timer)
        void this.executeJob(item).then(resolve)
      }, delay)
      this.activeTimers.add(timer)
    })
  }

  private createTimeout(item: T, delay: number): void {
    const timer = setTimeout(() => void this.executeJob(item), delay)

    this.activeTimers.add(timer)
  }

  private async executeJob(item: T): Promise<void> {
    try {
      this.log('Executing job —', new Date().toISOString())
      await this.config.onTick(item)
      this.log('Job completed —', new Date().toISOString())
    } catch (error) {
      console.error('[InstaJob] Error executing job:', error)
    } finally {
      this.activeTimers.forEach((timer) => {
        if (timer) this.activeTimers.delete(timer)
      })
    }
  }
}
