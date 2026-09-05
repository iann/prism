import { runCameraCleanupOnce } from '@/lib/cameras/sessions';

let started = false;
let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

/** One process-local timer plus durable rows makes cleanup restartable. */
export function startCameraSessionCleanup(): void {
  if (started || process.env.NODE_ENV === 'test') return;
  started = true;
  const run = () => {
    if (running) return;
    running = true;
    void runCameraCleanupOnce()
      .catch((error) => console.error('Camera cleanup failed:', error))
      .finally(() => { running = false; });
  };
  run();
  timer = setInterval(run, 10_000);
  timer.unref?.();
}

export function stopCameraSessionCleanupForTests(): void {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
  running = false;
}
