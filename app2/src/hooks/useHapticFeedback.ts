import { useCallback } from 'react';

/**
 * 햅틱 피드백을 제공하는 커스텀 훅
 * 모바일 디바이스에서 터치 인터랙션에 대한 촉각적 피드백 제공
 */
export const useHapticFeedback = () => {
  // 가벼운 햅틱 피드백 (선택, 버튼 클릭)
  const lightImpact = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  }, []);

  // 중간 햅틱 피드백 (스위치 토글, 중요한 액션)
  const mediumImpact = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate(25);
    }
  }, []);

  // 강한 햅틱 피드백 (경고, 삭제, 중요한 변경)
  const heavyImpact = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 20, 50]);
    }
  }, []);

  // 성공 햅틱 피드백
  const successFeedback = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate([10, 50, 10]);
    }
  }, []);

  // 오류 햅틱 피드백
  const errorFeedback = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100, 50, 100]);
    }
  }, []);

  // 경고 햅틱 피드백
  const warningFeedback = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 100, 50]);
    }
  }, []);

  // 선택 햅틱 피드백 (체크박스, 라디오 버튼)
  const selectionFeedback = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate(15);
    }
  }, []);

  // 햅틱 피드백 지원 여부 확인
  const isSupported = 'vibrate' in navigator;

  return {
    lightImpact,
    mediumImpact,
    heavyImpact,
    successFeedback,
    errorFeedback,
    warningFeedback,
    selectionFeedback,
    isSupported,
  };
};
