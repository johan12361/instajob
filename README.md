# instajob

A lightweight, database-agnostic job scheduler for Node.js & Bun. Poll your database and fire jobs at the right time — no cron syntax required.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
  - [Basic Setup](#basic-setup)
  - [Parallel vs Sequential Execution](#parallel-vs-sequential-execution)
  - [Enabling Logs](#enabling-logs)
- [Configuration](#configuration)
- [TypeScript Types](#typescript-types)
- [How It Works](#how-it-works)
- [Features](#features)
- [License](#license)
- [Report Issues](#report-issues)

## Installation

```bash
npm install instajob
# or
bun add instajob
# or
pnpm add instajob
# or
yarn add instajob
```

## Quick Start

```ts
import { InstaJob } from 'instajob'

type Reminder = {
  id: string
  message: string
  runAt: Date
}

const scheduler = new InstaJob<Reminder>({
  checkIntervalMs: 60_000, // Poll every 60 seconds

  fetchJobs: async () => {
    // Return jobs scheduled within the next interval
    return await db.reminders.findMany({
      where: { runAt: { lte: new Date(Date.now() + 60_000) }, done: false }
    })
  },

  getRunDate: (reminder) => reminder.runAt,

  onTick: async (reminder) => {
    await sendNotification(reminder.message)
    await db.reminders.update({ where: { id: reminder.id }, data: { done: true } })
  }
})

await scheduler.start()
```

## Usage

### Basic Setup

Define your job type and pass three required functions to `InstaJob`:

1. **`fetchJobs`** — queries your database for upcoming jobs.
2. **`getRunDate`** — tells the scheduler when each job should run.
3. **`onTick`** — executes when the scheduled time arrives. Mark the job as done here.

```ts
const scheduler = new InstaJob<MyJob>({
  checkIntervalMs: 30_000,
  fetchJobs: async () => await getUpcomingJobs(),
  getRunDate: (job) => job.scheduledAt,
  onTick: async (job) => {
    await processJob(job)
    await markJobAsDone(job.id)
  }
})

await scheduler.start()
```

### Parallel vs Sequential Execution

By default, all jobs fetched in a cycle are scheduled and executed in **parallel**. You can switch to **sequential** mode so each job waits for the previous one to finish before starting.

```ts
// Parallel (default) — jobs run concurrently
const scheduler = new InstaJob<MyJob>({
  checkIntervalMs: 60_000,
  fetchJobs: async () => getJobs(),
  getRunDate: (job) => job.runAt,
  onTick: async (job) => processJob(job),
  parallel: true
})

// Sequential — jobs run one after another
const scheduler = new InstaJob<MyJob>({
  checkIntervalMs: 60_000,
  fetchJobs: async () => getJobs(),
  getRunDate: (job) => job.runAt,
  onTick: async (job) => processJob(job),
  parallel: false
})
```

### Enabling Logs

Enable built-in logging to monitor cycle activity and job execution:

```ts
const scheduler = new InstaJob<MyJob>({
  checkIntervalMs: 60_000,
  fetchJobs: async () => getJobs(),
  getRunDate: (job) => job.runAt,
  onTick: async (job) => processJob(job),
  logging: true
})
```

Sample output:

```
[InstaJob] Starting — interval: 60000 ms
[InstaJob] Cycle started — 2026-04-12T18:00:00.000Z
[InstaJob] Jobs fetched: 3
[InstaJob] Scheduling job (parallel) in 4200 ms
[InstaJob] Executing job — 2026-04-12T18:00:04.200Z
[InstaJob] Job completed — 2026-04-12T18:00:04.350Z
```

Errors are always logged regardless of the `logging` setting.

## Configuration

All options for `JobConfig<T>`:

| Option            | Type                         | Required | Default | Description                                                   |
| ----------------- | ---------------------------- | -------- | ------- | ------------------------------------------------------------- |
| `fetchJobs`       | `() => Promise<T[]>`         | ✅       | —       | Fetches upcoming jobs from your data source                   |
| `getRunDate`      | `(item: T) => Date`          | ✅       | —       | Returns the scheduled run date for a job                      |
| `onTick`          | `(item: T) => Promise<void>` | ✅       | —       | Executed when a job's time arrives                            |
| `checkIntervalMs` | `number`                     | ✅       | —       | Polling interval in milliseconds (e.g. `60_000` for 1 min)    |
| `parallel`        | `boolean`                    | ❌       | `true`  | Run cycle jobs in parallel (`true`) or sequentially (`false`) |
| `logging`         | `boolean`                    | ❌       | `false` | Enable built-in console logs for monitoring                   |

## TypeScript Types

```ts
import { InstaJob } from 'instajob'
import type { JobConfig } from 'instajob'

// Full config type
const config: JobConfig<MyJob> = {
  checkIntervalMs: 60_000,
  fetchJobs: async () => [],
  getRunDate: (job) => job.runAt,
  onTick: async (job) => {}
}
```

## How It Works

1. On `start()`, the scheduler immediately runs a cycle and fetches jobs via `fetchJobs()`.
2. For each job, it calculates the delay until `getRunDate()`.
3. If the delay is within the current `checkIntervalMs` window, a timer is set.
4. When the timer fires, `onTick()` is called with the job.
5. The cycle repeats every `checkIntervalMs` milliseconds.

This means `fetchJobs` should return jobs scheduled **within the next interval** to avoid missed or duplicate executions.

## Features

- ✅ Full TypeScript support
- ✅ Database-agnostic — works with any data source
- ✅ Parallel and sequential execution modes
- ✅ Built-in optional logging
- ✅ Promise-based API (async/await)
- ✅ Zero dependencies
- ✅ Works with Node.js ≥ 18 and Bun

## License

MIT © [johan12361](https://github.com/johan12361)

## Report Issues

If you find any issues, please report them at: [GitHub Issues](https://github.com/johan12361/instajob/issues)
