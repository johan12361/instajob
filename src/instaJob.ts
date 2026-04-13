import type { JobConfig } from './types/config.js'

export class InstaJob<T> {
  config: JobConfig<T>
  private readonly activeTimers = new Set<NodeJS.Timeout>()
  private readonly scheduledIds = new Set<string>()
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

      for (const item of items) {
        const delay = this.config.getRunDate(item).getTime() - Date.now()
        if (delay > this.config.checkIntervalMs) continue
        if (!this.trySchedule(item)) continue

        const safeDelay = Math.max(0, delay)
        if (parallel) {
          this.log('Scheduling job (parallel) in', safeDelay, 'ms')
          this.createTimeout(item, safeDelay)
        } else {
          this.log('Scheduling job (sequential) in', safeDelay, 'ms')
          await this.waitAndExecute(item, safeDelay)
        }
      }
    } catch (error) {
      console.error('[InstaJob] Error during job fetch cycle:', error)
    }
  }

  private trySchedule(item: T): boolean {
    if (!this.config.getJobId) return true
    const id = this.config.getJobId(item)
    if (this.scheduledIds.has(id)) return false
    this.scheduledIds.add(id)
    return true
  }

  private waitAndExecute(item: T, delay: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.activeTimers.delete(timer)
        void this.executeJob(item, timer).then(resolve)
      }, delay)
      this.activeTimers.add(timer)
    })
  }

  private createTimeout(item: T, delay: number): void {
    const timer = setTimeout(() => void this.executeJob(item, timer), delay)
    this.activeTimers.add(timer)
  }

  private async executeJob(item: T, timer: NodeJS.Timeout): Promise<void> {
    try {
      this.log('Executing job —', new Date().toISOString())
      await this.config.onTick(item)
      this.log('Job completed —', new Date().toISOString())
    } catch (error) {
      console.error('[InstaJob] Error executing job:', error)
    } finally {
      this.activeTimers.delete(timer)
      if (this.config.getJobId) this.scheduledIds.delete(this.config.getJobId(item))
    }
  }
}
