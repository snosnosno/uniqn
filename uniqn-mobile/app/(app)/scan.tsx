/**
 * UNIQN Mobile - QR 스캔 화면
 *
 * @description 스태프 출퇴근 QR 스캔 단일 진입점. 튜토리얼을 이미 본 사용자는
 *   진입 즉시 카메라가 열리고, 최초 1회는 튜토리얼을 먼저 본 뒤 카메라가 열린다.
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
  const { lastError, clearError, handleScanResult, isProcessing } = useQRCodeScanner({
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

  // 튜토리얼과 스캐너는 상호 배타적으로 렌더한다.
  //
  // 이유: QRCodeScanner 는 네이티브에서 presentationStyle="fullScreen" RNModal 로
  // 별도 윈도우에 present 되고, TutorialOverlay 는 Modal/Portal 없이 인라인 렌더된다
  // (QRCodeScanner.tsx 의 RNModal / TutorialOverlay.tsx 의 SafeAreaView 루트).
  // 따라서 스캐너가 떠 있는 동안에는 오버레이가 z-index 와 무관하게 항상 가려진다.
  // 보이지도 않는 튜토리얼이 useCompletionFlag 의 타임아웃(최소 30초)에 걸려
  // 완료 플래그가 영구 기록되는 비가역 부작용까지 있었다.
  const isTutorialVisible = needsTutorial && !isTutorialLoading;
  // 로딩 중에는 스캐너를 열지 않는다. 열었다가 튜토리얼 필요 판정이 나면
  // Modal 이 슬라이드로 닫히며 깜빡이고, 최초 사용자에게 카메라 권한 요청이
  // 먼저 튀어나오기 때문이다. 판정이 끝난 뒤에만 카메라를 연다.
  const isScannerVisible = !isTutorialLoading && !needsTutorial;

  return (
    // 스캐너가 전체 화면을 덮기 전(그리고 튜토리얼 판정이 끝나기 전) 흰 배경이
    // 번쩍이지 않도록 검정 바탕을 깐다. 이 짧은 순간에는 이 배경만 보인다.
    <View className="flex-1 bg-black dark:bg-black">
      <QRCodeScanner
        visible={isScannerVisible}
        onClose={handleClose}
        onScan={handleScan}
        title="출퇴근 QR 스캔"
        scanError={lastError}
        onClearError={clearError}
        isProcessing={isProcessing}
      />
      {isTutorialVisible && (
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
