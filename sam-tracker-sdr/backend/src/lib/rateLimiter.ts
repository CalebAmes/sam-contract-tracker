export interface RateLimiterOptions {
  concurrency: number;
  baseDelayMs: number;
  maxDelayMs: number;
  maxRetries: number;
  shouldRetry?: (error: unknown) => boolean;
}

type Task = {
  fn: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  attempt: number;
};

const defaultShouldRetry = (error: any): boolean => {
  const status = error?.response?.status;
  if (status === 429) {
    return true;
  }
  if (typeof status === "number" && status >= 500 && status < 600) {
    return true;
  }
  const code = error?.code;
  if (typeof code === "string" && ["ECONNABORTED", "ETIMEDOUT", "EAI_AGAIN"].includes(code)) {
    return true;
  }
  // network errors often have no status
  if (status === undefined && (error?.isAxiosError || error?.message)) {
    return true;
  }
  return false;
};

export function createRateLimiter(options: RateLimiterOptions) {
  const {
    concurrency,
    baseDelayMs,
    maxDelayMs,
    maxRetries,
    shouldRetry = defaultShouldRetry,
  } = options;

  let active = 0;
  const queue: Task[] = [];

  const processQueue = () => {
    if (active >= concurrency || queue.length === 0) {
      return;
    }

    const task = queue.shift()!;
    active += 1;

    const finalize = () => {
      setTimeout(() => {
        active -= 1;
        processQueue();
      }, baseDelayMs);
    };

    const runAttempt = () => {
      Promise.resolve()
        .then(task.fn)
        .then((value) => {
          task.resolve(value);
          finalize();
        })
        .catch((error) => {
          if (shouldRetry(error) && task.attempt < maxRetries) {
            task.attempt += 1;
            const delay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, task.attempt));
            console.warn(
              `[rateLimiter] retrying task (attempt ${task.attempt} of ${maxRetries}) in ${delay}ms`,
              error
            );
            setTimeout(runAttempt, delay);
            return;
          }
          if (error && typeof error === "object") {
            (error as any).retryAttempts = task.attempt;
          }
          task.reject(error);
          finalize();
        });
    };

    runAttempt();
    setTimeout(processQueue, 0);
  };

  function schedule<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push({
        fn,
        resolve: (value) => resolve(value as T),
        reject,
        attempt: 0,
      });
      processQueue();
    });
  }

  return { schedule };
}

export function describeAxiosError(error: any, context: string): Error {
  const status = error?.response?.status;
  const statusText = error?.response?.statusText;
  const url = error?.config?.url || error?.config?.baseURL;
  const attempts = typeof error?.retryAttempts === "number" ? error.retryAttempts : 0;
  const detailMessage =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    String(error);

  const meta: string[] = [];
  if (status) {
    meta.push(`status ${status}${statusText ? ` ${statusText}` : ""}`);
  }
  if (url) {
    meta.push(url);
  }
  if (attempts > 0) {
    meta.push(`${attempts} retries`);
  }

  const suffix = meta.length ? ` (${meta.join(" | ")})` : "";
  const message = `${context}${suffix}: ${detailMessage}`;
  const enhanced = new Error(message);
  if (error && typeof error === "object") {
    (enhanced as any).cause = error;
  }
  return enhanced;
}
