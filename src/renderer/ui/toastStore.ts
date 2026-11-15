/**
 * The toast queue, without React: any code can show a toast (services, store subscriptions, commands).
 * Who uses it: ui/Toast.tsx draws it; about twenty-five files call showToast; tests/unit/shellLibrary.test.ts tests
 * queueToast. Why a store apart from Toast.tsx: services must not import a component.
 */
import { create } from 'zustand';

/** The toast's colour role. */
export type ToastTone = 'info' | 'success' | 'warn' | 'error' | 'ai';

/** What a caller gives to show a toast. */
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

/** A toast in the queue; a closed one stays (open false) until the next toast is queued. */
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
/** How long a toast stays when the caller gives no duration. */
export const DEFAULT_TOAST_MS = 8000;

/** Counts toasts; makes ids for toasts without one and a fresh key for each replacement. */
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

/** The queue on screen. */
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
