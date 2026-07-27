import { Alert, Platform } from 'react-native';

interface ConfirmActionOptions {
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  /**
   * 취소/닫기 시 호출. 안드로이드 뒤로가기 dismiss 도 여기로 온다.
   * 확인 여부에 따라 흐름을 이어가야 하는 호출부(confirmActionAsync)를 위해 존재한다.
   */
  onCancel?: () => void;
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
  onCancel,
}: ConfirmActionOptions): void {
  // 확인/취소 콜백은 정확히 한 번만 — 안드로이드는 취소 버튼과 dismiss 가 함께 올 수 있다.
  let settled = false;
  const settle = (fn?: () => void | Promise<void>) => {
    if (settled) return;
    settled = true;
    const result = fn?.();
    if (isPromiseLike(result)) {
      void result.then(undefined, () => undefined);
    }
  };

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (window.confirm(`${title}\n\n${message}`)) {
      settle(onConfirm);
    } else {
      settle(onCancel);
    }
    return;
  }

  Alert.alert(
    title,
    message,
    [
      { text: cancelText, style: 'cancel', onPress: () => settle(onCancel) },
      {
        text: confirmText,
        style: destructive ? 'destructive' : 'default',
        onPress: () => settle(onConfirm),
      },
    ],
    { onDismiss: () => settle(onCancel) }
  );
}

/**
 * confirmAction 의 Promise 변형 — 확인 여부에 따라 후속 작업을 이어가야 할 때 쓴다.
 * @returns 확인=true / 취소·닫기=false
 */
export function confirmActionAsync(
  options: Omit<ConfirmActionOptions, 'onConfirm' | 'onCancel'>
): Promise<boolean> {
  return new Promise((resolve) => {
    confirmAction({
      ...options,
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}
