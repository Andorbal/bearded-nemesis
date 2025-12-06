import { writable } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);

  let nextId = 0;

  const store = {
    subscribe,
    show(type: ToastType, message: string, duration = 5000) {
      const id = `toast-${nextId++}`;
      const toast: Toast = { id, type, message, duration };

      update(toasts => [...toasts, toast]);

      if (duration > 0) {
        setTimeout(() => {
          store.dismiss(id);
        }, duration);
      }

      return id;
    },
    success(message: string, duration?: number) {
      return store.show('success', message, duration);
    },
    error(message: string, duration?: number) {
      return store.show('error', message, duration);
    },
    info(message: string, duration?: number) {
      return store.show('info', message, duration);
    },
    warning(message: string, duration?: number) {
      return store.show('warning', message, duration);
    },
    dismiss(id: string) {
      update(toasts => toasts.filter(t => t.id !== id));
    },
  };

  return store;
}

export const toastStore = createToastStore();
