import { Alert, Platform } from 'react-native';

interface ConfirmActionOptions {
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

function isPromiseLike(value: unknown): value is PromiseLike<void> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    typeof (value as PromiseLike<void>).then === 'function'
  );
}

export function confirmAction({
  title,
  message,
  confirmText,
  cancelText = '취소',
  destructive = false,
  onConfirm,
}: ConfirmActionOptions): void {
  const runConfirm = () => {
    const result = onConfirm();

    if (isPromiseLike(result)) {
      void result.then(undefined, () => undefined);
    }
  };

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (window.confirm(`${title}\n\n${message}`)) {
      runConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: cancelText, style: 'cancel' },
    {
      text: confirmText,
      style: destructive ? 'destructive' : 'default',
      onPress: runConfirm,
    },
  ]);
}
