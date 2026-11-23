export interface SyncStatus {
  pending: number;
  saving: boolean;
  error: string;
}

const MATERIAL_LIMIT_MESSAGE = 'This workspace has reached its 200 saved-version limit';

/** Keep writes ordered and retain retryable failures until the user retries them. */
export class PersistenceQueue {
  private jobs: Array<{
    run: () => Promise<void>;
    resolve?: (saved: boolean) => void;
    onRejected?: (message: string) => void;
  }> = [];
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

  enqueue(run: () => Promise<void>, onRejected?: (message: string) => void): Promise<boolean> {
    return new Promise(resolve => {
      this.jobs.push({ run, resolve, onRejected });
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
          const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
          if (message === MATERIAL_LIMIT_MESSAGE && error && typeof error === 'object' && 'code' in error && error.code === 'P0001') {
            this.jobs.shift();
            job.resolve?.(false);
            job.onRejected?.(message);
            this.publish();
            continue;
          }
          console.error('Database save failed:', error);
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
