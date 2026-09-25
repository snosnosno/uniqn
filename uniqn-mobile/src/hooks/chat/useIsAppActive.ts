/**
 * 앱이 전면(active)인지 — 채팅 읽음 처리는 사용자가 실제로 보고 있을 때만 한다
 */
import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

export function useIsAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      setActive(next === 'active');
    });
    return () => subscription.remove();
  }, []);

  return active;
}
