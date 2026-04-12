import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { InstaJob } from '../src/instaJob.js'
import type { JobConfig } from '../src/types/config.js'

type TestJob = {
  id: string
  runAt: Date
}

function makeJob(delayMs: number): TestJob {
  return { id: crypto.randomUUID(), runAt: new Date(Date.now() + delayMs) }
}

function makeConfig(overrides: Partial<JobConfig<TestJob>> = {}): JobConfig<TestJob> {
  return {
    checkIntervalMs: 60_000,
    fetchJobs: vi.fn().mockResolvedValue([]),
    getRunDate: (job) => job.runAt,
    onTick: vi.fn().mockResolvedValue(undefined),
    ...overrides
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('InstaJob', () => {
  describe('constructor', () => {
    it('stores the config', () => {
      const config = makeConfig()
      const scheduler = new InstaJob(config)
      expect(scheduler.config).toBe(config)
    })
  })

  describe('start()', () => {
    it('calls fetchJobs immediately on start', async () => {
      const config = makeConfig()
      const scheduler = new InstaJob(config)

      await scheduler.start()

      expect(config.fetchJobs).toHaveBeenCalledTimes(1)
    })

    it('calls fetchJobs again after checkIntervalMs', async () => {
      const config = makeConfig()
      const scheduler = new InstaJob(config)

      await scheduler.start()
      await vi.advanceTimersByTimeAsync(60_000)

      expect(config.fetchJobs).toHaveBeenCalledTimes(2)
    })

    it('calls fetchJobs multiple times across multiple intervals', async () => {
      const config = makeConfig()
      const scheduler = new InstaJob(config)

      await scheduler.start()
      await vi.advanceTimersByTimeAsync(180_000)

      expect(config.fetchJobs).toHaveBeenCalledTimes(4)
    })
  })

  describe('parallel mode (default)', () => {
    it('calls onTick for a job scheduled within the interval', async () => {
      const job = makeJob(500)
      const config = makeConfig({
        fetchJobs: vi.fn().mockResolvedValue([job])
      })
      const scheduler = new InstaJob(config)

      await scheduler.start()
      await vi.advanceTimersByTimeAsync(1000)

      expect(config.onTick).toHaveBeenCalledWith(job)
    })

    it('does not call onTick for a job beyond the interval window', async () => {
      const job = makeJob(120_000) // beyond 60s interval
      const config = makeConfig({
        fetchJobs: vi.fn().mockResolvedValue([job])
      })
      const scheduler = new InstaJob(config)

      await scheduler.start()
      await vi.advanceTimersByTimeAsync(60_000)

      expect(config.onTick).not.toHaveBeenCalled()
    })

    it('calls onTick for multiple jobs in parallel', async () => {
      const jobs = [makeJob(100), makeJob(200), makeJob(300)]
      const config = makeConfig({
        fetchJobs: vi.fn().mockResolvedValue(jobs),
        parallel: true
      })
      const scheduler = new InstaJob(config)

      await scheduler.start()
      await vi.advanceTimersByTimeAsync(500)

      expect(config.onTick).toHaveBeenCalledTimes(3)
    })

    it('calls onTick immediately for a job with past runAt', async () => {
      const job = makeJob(-5000) // already past
      const config = makeConfig({
        fetchJobs: vi.fn().mockResolvedValue([job])
      })
      const scheduler = new InstaJob(config)

      await scheduler.start()
      await vi.advanceTimersByTimeAsync(100)

      expect(config.onTick).toHaveBeenCalledWith(job)
    })
  })

  describe('sequential mode (parallel: false)', () => {
    it('calls onTick for each job one after another', async () => {
      const jobs = [makeJob(0), makeJob(0), makeJob(0)]
      const order: string[] = []
      const config = makeConfig({
        fetchJobs: vi.fn().mockResolvedValue(jobs),
        onTick: vi.fn().mockImplementation(async (job: TestJob) => {
          order.push(job.id)
        }),
        parallel: false
      })
      const scheduler = new InstaJob(config)

      const startPromise = scheduler.start()
      await vi.advanceTimersByTimeAsync(100)
      await startPromise

      expect(config.onTick).toHaveBeenCalledTimes(3)
      expect(order).toEqual(jobs.map((j) => j.id))
    })

    it('does not call onTick for jobs beyond the interval window', async () => {
      const job = makeJob(120_000)
      const config = makeConfig({
        fetchJobs: vi.fn().mockResolvedValue([job]),
        parallel: false
      })
      const scheduler = new InstaJob(config)

      await scheduler.start()
      await vi.advanceTimersByTimeAsync(60_000)

      expect(config.onTick).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('does not throw if fetchJobs rejects', async () => {
      const config = makeConfig({
        fetchJobs: vi.fn().mockRejectedValue(new Error('DB error'))
      })
      const scheduler = new InstaJob(config)

      await expect(scheduler.start()).resolves.toBeUndefined()
    })

    it('does not throw if onTick rejects', async () => {
      const job = makeJob(0)
      const config = makeConfig({
        fetchJobs: vi.fn().mockResolvedValue([job]),
        onTick: vi.fn().mockRejectedValue(new Error('tick error'))
      })
      const scheduler = new InstaJob(config)

      await scheduler.start()
      await vi.advanceTimersByTimeAsync(100)
    })
  })

  describe('logging', () => {
    it('calls console.log when logging is enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const config = makeConfig({ logging: true })
      const scheduler = new InstaJob(config)

      await scheduler.start()

      expect(consoleSpy).toHaveBeenCalled()
    })

    it('does not call console.log when logging is disabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const config = makeConfig({ logging: false })
      const scheduler = new InstaJob(config)

      await scheduler.start()

      expect(consoleSpy).not.toHaveBeenCalled()
    })
  })
})
