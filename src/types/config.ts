export interface JobConfig<T> {
  // Async function defined by the user to fetch scheduled jobs
  fetchJobs: () => Promise<T[]>
  // Async function to get the scheduled run date for each job
  getRunDate: (item: T) => Date
  // What to do when the time comes (e.g. send a notification and update the DB)
  onTick: (item: T) => Promise<void>
  // Polling interval (e.g. every hour)
  checkIntervalMs: number
  // If true (default), jobs in a cycle run in parallel; if false, one after another
  parallel?: boolean
  // If true, enables logs to monitor the cycle and job execution
  logging?: boolean
}
