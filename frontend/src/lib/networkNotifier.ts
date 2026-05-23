type NotifyFn = (message: string) => void;

let notifyFn: NotifyFn | null = null;

export function setNetworkNotifier(fn: NotifyFn) {
  notifyFn = fn;
}

export function notifyNetworkError(message: string) {
  notifyFn?.(message);
}
