/**
 * UNIQN Mobile - 미저장 변경사항 가드 훅
 *
 * @description 폼 화면에서 뒤로가기 시 미저장 데이터 손실 방지
 * @version 1.0.0
 */

import { useCallback, useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { useNavigation } from 'expo-router';

/**
 * 미저장 변경사항이 있을 때 뒤로가기를 차단하고 확인 다이얼로그를 표시합니다.
 *
 * @param hasUnsavedChanges - 미저장 변경사항 존재 여부
 * @returns markClean - 저장 완료 시 다음 뒤로가기를 즉시 통과시키는 동기 표식
 *
 * @example
 * const [isDirty, setIsDirty] = useState(false);
 * const { markClean } = useUnsavedChangesGuard(isDirty);
 *
 * // 입력 변경 시: setIsDirty(true)
 * // 제출 성공 시: setIsDirty(false); markClean(); router.back();
 */
export function useUnsavedChangesGuard(hasUnsavedChanges: boolean): { markClean: () => void } {
  const navigation = useNavigation();
  // 저장 직후 setIsDirty(false)의 리렌더 전에 실행되는 내비게이션이 stale 리스너에
  // 걸리지 않도록, 동기 갱신되는 ref로 최신 clean 상태를 우선한다.
  const cleanRef = useRef(false);

  useEffect(() => {
    cleanRef.current = false; // dirty 상태가 갱신되면 markClean 효과 해제
  }, [hasUnsavedChanges]);

  const markClean = useCallback(() => {
    cleanRef.current = true;
  }, []);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (cleanRef.current) return; // 저장 완료 — 통과
      e.preventDefault();

      if (Platform.OS === 'web') {
        if (window.confirm('저장하지 않은 변경사항이 있습니다. 정말 나가시겠습니까?')) {
          navigation.dispatch(e.data.action);
        }
      } else {
        // Alert.alert 예외: 확인/취소 버튼이 필요한 확인 다이얼로그 (toast는 버튼 미지원)
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

  return { markClean };
}
