/**
 * UNIQN Mobile - 미저장 변경사항 가드 훅
 *
 * @description 폼 화면에서 뒤로가기 시 미저장 데이터 손실 방지
 * @version 1.0.0
 */

import { useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import { useNavigation } from 'expo-router';

/**
 * 미저장 변경사항이 있을 때 뒤로가기를 차단하고 확인 다이얼로그를 표시합니다.
 *
 * @param hasUnsavedChanges - 미저장 변경사항 존재 여부
 *
 * @example
 * const [isDirty, setIsDirty] = useState(false);
 * useUnsavedChangesGuard(isDirty);
 *
 * // 입력 변경 시: setIsDirty(true)
 * // 제출 성공 시: setIsDirty(false)
 */
export function useUnsavedChangesGuard(hasUnsavedChanges: boolean) {
  const navigation = useNavigation();

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      e.preventDefault();

      if (Platform.OS === 'web') {
        if (window.confirm('저장하지 않은 변경사항이 있습니다. 정말 나가시겠습니까?')) {
          navigation.dispatch(e.data.action);
        }
      } else {
        Alert.alert(
          '변경사항 저장 안 됨',
          '저장하지 않은 변경사항이 있습니다. 정말 나가시겠습니까?',
          [
            { text: '계속 편집', style: 'cancel' },
            {
              text: '나가기',
              style: 'destructive',
              onPress: () => navigation.dispatch(e.data.action),
            },
          ]
        );
      }
    });

    return unsubscribe;
  }, [hasUnsavedChanges, navigation]);
}
