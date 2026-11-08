import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'warn' | 'error' | 'ai';

export interface ToastInput {
  /** Same id replaces the toast that is showing instead of stacking a second one. */
  id?: string;
  title: string;
  description?: string | null;
  tone?: ToastTone;
  /** Milliseconds; Infinity keeps it until dismissed. */
  duration?: number;
  action?: { label: string; onSelect: () => void };
}

export interface ToastItem extends Required<Pick<ToastInput, 'title' | 'tone' | 'duration'>> {
  id: string;
  /** Changes whenever the toast is replaced, so the close timer restarts. */
  key: string;
  description: string | null;
  action: ToastInput['action'] | null;
  open: boolean;
}

interface ToastQueue {
  toasts: ToastItem[];
  show: (input: ToastInput) => string;
  dismiss: (id: string) => void;
  remove: (id: string) => void;
}

/** Five visible at most; older ones leave first. */
export const MAX_TOASTS = 5;
export const DEFAULT_TOAST_MS = 8000;

let sequence = 0;

/** Pure queue step, exported for tests. */
export function queueToast(current: ToastItem[], input: ToastInput): ToastItem[] {
  sequence += 1;
  const id = input.id ?? `toast-${sequence}`;
  const item: ToastItem = {
    id,
    key: `${id}:${sequence}`,
    title: input.title,
    description: input.description ?? null,
    tone: input.tone ?? 'info',
    duration: input.duration ?? DEFAULT_TOAST_MS,
    action: input.action ?? null,
    open: true,
  };
  const rest = current.filter((toast) => toast.id !== id && toast.open);
  return [...rest, item].slice(-MAX_TOASTS);
}

export const useToastStore = create<ToastQueue>((set) => ({
  toasts: [],
  show: (input) => {
    let id = '';
    set((state) => {
      const next = queueToast(state.toasts, input);
      id = next[next.length - 1].id;
      return { toasts: next };
    });
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.map((toast) => (toast.id === id ? { ...toast, open: false } : toast)) })),
  remove: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

/** Show a toast from anywhere (services, store subscriptions). */
export function showToast(input: ToastInput): string {
  return useToastStore.getState().show(input);
}
