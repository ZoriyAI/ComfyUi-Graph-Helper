/** Full motion is On, or System while the OS is not asking to reduce. */
export function motionIsFull(): boolean {
  const mode = document.documentElement.dataset.motion || 'system';
  const osReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return mode === 'on' || (mode === 'system' && !osReduce);
}

/** React Flow fit duration. Zero unless the effective policy is full motion. */
export function fitDurationMs(): number {
  return motionIsFull() ? 200 : 0;
}
