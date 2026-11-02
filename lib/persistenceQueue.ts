export interface SyncStatus {
  pending: number;
  saving: boolean;
  error: string;
}

/** Keep writes ordered and retain a failed write until the user retries it. */
export class PersistenceQueue {
  private jobs: Array<{ run: () => Promise<void>; resolve?: (saved: boolean) => void }> = [];
  private running = false;
  private error = '';

  constructor(private readonly onChange: (status: SyncStatus) => void) {}

  get pending() { return this.jobs.length; }

  discard() {
    if (this.running) return;
    for (const job of this.jobs) job.resolve?.(false);
    this.jobs = [];
    this.error = '';
    this.publish();
  }

  enqueue(run: () => Promise<void>): Promise<boolean> {
    return new Promise(resolve => {
      this.jobs.push({ run, resolve });
      this.publish();
      if (this.error) {
        resolve(false);
        this.jobs[this.jobs.length - 1].resolve = undefined;
      } else void this.flush();
    });
  }

  async retry() {
    this.error = '';
    await this.flush();
  }

  private publish() {
    this.onChange({ pending: this.jobs.length, saving: this.running, error: this.error });
  }

  private async flush() {
    if (this.running || this.error) return;
    this.running = true;
    this.publish();
    try {
      while (this.jobs.length) {
        const job = this.jobs[0];
        try {
          await job.run();
          this.jobs.shift();
          job.resolve?.(true);
        } catch (error) {
          console.error('Database save failed:', error);
          const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
          this.error = message.startsWith('Plan limit:')
            ? message
            : 'Your changes could not be saved. Keep this page open and retry.';
          for (const pending of this.jobs) {
            pending.resolve?.(false);
            pending.resolve = undefined;
          }
          break;
        }
        this.publish();
      }
    } finally {
      this.running = false;
      this.publish();
    }
  }
}
