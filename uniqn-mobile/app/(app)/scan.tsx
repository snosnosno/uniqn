/**
 * UNIQN Mobile - QR 스캔 화면
 *
 * @description 스태프 출퇴근 QR 스캔 단일 진입점. 진입 즉시 카메라가 열린다.
 *   공고당 고정 QR 이라 스캔 전에 사용자가 고를 것이 없다
 *   (출근/퇴근 판정은 서버가 현재 근무 상태로 자동 결정).
 *
 *   헤더 QR 아이콘과 스케줄 상세의 "QR 코드로 출근/퇴근하기" 버튼이
 *   모두 이 라우트를 호출한다 — 스캐너 코드 경로는 하나뿐이다.
 */

import { useCallback } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { QRCodeScanner } from '@/components/qr';
import { useQRCodeScanner } from '@/hooks';
import { useTutorial } from '@/hooks/useTutorial';
import { TutorialOverlay } from '@/components/tutorial';
import { QR_CHECKIN_TUTORIAL } from '@/constants/tutorials';
import { triggerHaptic } from '@/utils/haptics';
import type { QRCodeScanResult } from '@/types';

export default function ScanScreen() {
  // 튜토리얼 (최초 1회 오버레이)
  const {
    needsTutorial,
    completeTutorial,
    isLoading: isTutorialLoading,
    timeoutMs: tutorialTimeoutMs,
  } = useTutorial('qrCheckIn', { pageCount: QR_CHECKIN_TUTORIAL.pages.length });

  // 스택이 비어 있으면(딥링크 직접 진입) 스케줄 탭으로 폴백
  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(app)/(tabs)/schedule');
    }
  }, []);

  // 스캔 결과 처리는 훅이 전담 (토스트·캐시 무효화·에러 문구)
  const { lastError, clearError, handleScanResult } = useQRCodeScanner({
    onSuccess: () => {
      // 출퇴근 체크 완료 — 결정적 순간이므로 Success 햅틱 (impeccable §17).
      void triggerHaptic('success');
      goBack();
    },
  });

  const handleClose = useCallback(() => {
    clearError();
    goBack();
  }, [clearError, goBack]);

  const handleScan = useCallback(
    (result: QRCodeScanResult) => {
      handleScanResult(result);
    },
    [handleScanResult]
  );

  return (
    // 스캐너가 전체 화면을 덮기 전 흰 배경이 번쩍이지 않도록 검정 바탕을 깐다.
    <View className="flex-1 bg-black dark:bg-black">
      <QRCodeScanner
        visible
        onClose={handleClose}
        onScan={handleScan}
        title="출퇴근 QR 스캔"
        scanError={lastError}
        onClearError={clearError}
      />
      {needsTutorial && !isTutorialLoading && (
        <View className="absolute inset-0 z-10">
          <TutorialOverlay
            config={QR_CHECKIN_TUTORIAL}
            onComplete={completeTutorial}
            timeoutMs={tutorialTimeoutMs}
          />
        </View>
      )}
    </View>
  );
}
