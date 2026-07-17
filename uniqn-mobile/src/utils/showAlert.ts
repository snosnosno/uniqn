import { Alert, Platform } from 'react-native';

/**
 * 플랫폼 안전 1버튼 안내 다이얼로그.
 *
 * react-native-web 의 Alert.alert 는 완전 no-op(static alert() {})이라
 * 웹에서 안내가 조용히 증발한다 — 웹은 window.alert 로 분기한다.
 * 확인/취소가 필요한 다이얼로그는 confirmAction 을 사용할 것.
 */
export function showAlert(title: string, message: string): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
    return;
  }

  Alert.alert(title, message);
}
