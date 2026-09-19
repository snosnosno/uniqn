/**
 * UNIQN Mobile - QR 스캔 화면
 *
 * @description 스태프 출퇴근 QR 스캔 단일 진입점. 공고별 고정 QR을 스캔하면 서버가
 *   출근/퇴근을 자동 판별하며, 후보가 여러 건일 때만 근무 선택 시트를 보여준다.
 *
 *   헤더 QR 아이콘과 스케줄 상세의 "QR 코드로 출근/퇴근하기" 버튼이
 *   모두 이 라우트를 호출한다 — 스캐너 코드 경로는 하나뿐이다.
 */

import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { QRCodeScanner } from '@/components/qr';
import { StackHeader } from '@/components/headers';
import { BottomSheet, Button } from '@/components/ui';
import { useQRCodeScanner } from '@/hooks/useQRCode';
import { useTutorial } from '@/hooks/useTutorial';
import { TutorialOverlay } from '@/components/tutorial';
import { QR_CHECKIN_TUTORIAL } from '@/constants/tutorials';
import { triggerHaptic } from '@/utils/haptics';
import { formatDateWithWeekday } from '@/utils/formatters';
import { getRoleDisplayName } from '@/types/unified';
import type { EventQRScanResult, QRCodeScanResult } from '@/types';

export default function ScanScreen() {
  const [completedResult, setCompletedResult] = useState<EventQRScanResult | null>(null);
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
  const {
    lastError,
    clearError,
    handleScanResult,
    isProcessing,
    pendingCandidates,
    selectCandidate,
    cancelCandidateSelection,
  } = useQRCodeScanner({
    onSuccess: (result) => {
      // 출퇴근 체크 완료 — 결정적 순간이므로 Success 햅틱 (impeccable §17).
      void triggerHaptic('success');
      setCompletedResult(result);
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
  const isScannerVisible =
    completedResult === null &&
    pendingCandidates.length === 0 &&
    !isProcessing &&
    !isTutorialLoading &&
    !needsTutorial;

  const clock = useCallback(
    (value: Date) =>
      value.toLocaleTimeString('ko-KR', {
        timeZone: 'Asia/Seoul',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    []
  );

  const isDedicatedError =
    lastError?.kind === 'checkoutTooEarly' || lastError?.kind === 'noEligibleWorkLog';

  const handleRescan = useCallback(() => {
    clearError();
  }, [clearError]);

  const goToSchedule = useCallback(() => {
    clearError();
    router.replace('/(app)/(tabs)/schedule');
  }, [clearError]);

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader title="QR 출퇴근" fallbackHref="/(app)/(tabs)/schedule" />

      {completedResult ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow px-4 pb-6"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 justify-center py-6">
            <View className="mx-auto h-16 w-16 items-center justify-center rounded-lg bg-success-100 dark:bg-success-900/30">
              <Text className="text-3xl font-sans-bold text-success-700 dark:text-success-300">
                ✓
              </Text>
            </View>
            <Text className="mt-5 text-center text-2xl font-display text-content-primary dark:text-off-white">
              {completedResult.action === 'checkIn' ? '출근 완료' : '퇴근 완료'}
            </Text>
            {completedResult.timeSlot ? (
              <Text className="mt-2 text-center text-sm font-sans text-content-secondary dark:text-secondary-400">
                예정 {completedResult.timeSlot}
              </Text>
            ) : null}

            <View className="mt-7 rounded-lg border border-divider bg-surface-card p-5 dark:bg-surface-card">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-xs font-sans text-content-muted">스캔 시각</Text>
                  <Text className="mt-1 text-xl font-sans-bold text-content-primary">
                    {clock(completedResult.scannedAt)}
                  </Text>
                </View>
                <Text className="px-4 text-xl font-sans-bold text-primary-600 dark:text-primary-400">
                  →
                </Text>
                <View className="flex-1 items-end">
                  <Text className="text-xs font-sans text-content-muted">적용 시각</Text>
                  <Text className="mt-1 text-2xl font-sans-bold text-primary-700 dark:text-primary-300">
                    {clock(completedResult.appliedTime)}
                  </Text>
                </View>
              </View>
            </View>

            <View className="mt-4 rounded-lg bg-primary-50 p-3 dark:bg-primary-900/20">
              <Text className="text-sm leading-5 font-sans text-content-secondary dark:text-secondary-300">
                원본 스캔 시각은 별도로 보관됩니다. 근무시간은 적용 시각부터 계산돼요.
              </Text>
            </View>
          </View>
          <Button size="lg" fullWidth onPress={goBack}>
            확인
          </Button>
        </ScrollView>
      ) : null}

      {isDedicatedError ? (
        <ScrollView className="flex-1" contentContainerClassName="flex-grow px-4 pb-6">
          <View className="flex-1 justify-center py-6">
            <View className="mx-auto h-16 w-16 items-center justify-center rounded-lg bg-error-100 dark:bg-error-900/30">
              <Text className="text-2xl font-sans-bold text-error-600 dark:text-error-300">!</Text>
            </View>
            <Text className="mt-5 text-center text-xl font-display text-content-primary dark:text-off-white">
              {lastError?.kind === 'checkoutTooEarly'
                ? '아직 퇴근할 수 없어요'
                : '처리할 근무가 없어요'}
            </Text>
            <Text className="mt-2 text-center text-sm leading-5 font-sans text-content-secondary dark:text-secondary-400">
              {lastError?.kind === 'checkoutTooEarly'
                ? '출근과 퇴근의 15분 단위 적용 시각이 같습니다.'
                : '현재 출퇴근 가능한 배정 근무를 찾지 못했습니다.'}
            </Text>
            <View className="mt-6 rounded-lg bg-error-50 p-4 dark:bg-error-900/20">
              {lastError?.kind === 'checkoutTooEarly' ? (
                <Text className="text-sm leading-5 font-sans text-error-700 dark:text-error-300">
                  다음 15분 구간에 다시 QR을 스캔해주세요.
                </Text>
              ) : (
                <View className="gap-2">
                  <Text className="text-sm font-sans-semibold text-error-700 dark:text-error-300">
                    다음 내용을 확인해주세요.
                  </Text>
                  <Text className="text-sm leading-5 font-sans text-content-secondary dark:text-secondary-300">
                    • 이 공고에 배정되었는지
                  </Text>
                  <Text className="text-sm leading-5 font-sans text-content-secondary dark:text-secondary-300">
                    • 출근 가능 시간인지
                  </Text>
                  <Text className="text-sm leading-5 font-sans text-content-secondary dark:text-secondary-300">
                    • 올바른 현장 QR인지
                  </Text>
                </View>
              )}
            </View>
          </View>
          {lastError?.kind === 'noEligibleWorkLog' ? (
            <Button variant="outline" size="lg" fullWidth onPress={goToSchedule} className="mb-3">
              내 스케줄 확인
            </Button>
          ) : null}
          <Button size="lg" fullWidth onPress={handleRescan}>
            다시 스캔하기
          </Button>
        </ScrollView>
      ) : null}

      <QRCodeScanner
        visible={isScannerVisible && !isDedicatedError}
        onClose={handleClose}
        onScan={handleScan}
        title="QR 출퇴근"
        scanError={lastError?.kind === 'generic' ? lastError : null}
        onClearError={clearError}
        isProcessing={isProcessing}
      />
      <BottomSheet
        visible={pendingCandidates.length > 0}
        onClose={cancelCandidateSelection}
        title="근무 선택"
        snapPoints={['50%', '80%']}
        scrollable
        showCloseButton={false}
      >
        <View className="px-2 pb-2">
          <Text className="mb-2 text-sm leading-5 font-sans text-content-secondary dark:text-secondary-400">
            처리할 근무가 {pendingCandidates.length}건 있어요. 날짜와 시간을 확인하세요.
          </Text>
          {pendingCandidates.map((candidate, index) => (
            <Pressable
              key={candidate.workLogId}
              onPress={() => void selectCandidate(candidate.workLogId)}
              disabled={isProcessing}
              className="mt-2 min-h-[92px] rounded-lg border border-divider bg-surface-card p-4 active:bg-secondary-50 dark:bg-surface dark:active:bg-surface-hover"
              accessibilityRole="button"
              accessibilityLabel={`${formatDateWithWeekday(candidate.date)}, ${candidate.timeSlot ?? '시간 미정'}, ${candidate.action === 'checkOut' ? '퇴근' : '출근'} 근무 선택`}
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-sans-semibold text-primary-700 dark:text-primary-300">
                  {candidate.action === 'checkOut' ? '퇴근' : '출근'}
                </Text>
                <Text className="text-xs font-sans text-content-muted">
                  {index === 0 ? '우선 후보' : '다음 근무'}
                </Text>
              </View>
              <Text className="mt-1 text-base font-sans-semibold text-content-primary">
                {formatDateWithWeekday(candidate.date)}
              </Text>
              <Text className="mt-1 text-sm font-sans text-content-secondary">
                예정 {candidate.timeSlot ?? '시간 미정'}
                {candidate.role
                  ? ` · ${getRoleDisplayName(candidate.role, candidate.customRole ?? undefined)}`
                  : ''}
              </Text>
            </Pressable>
          ))}
          <Text className="mt-3 text-xs leading-4 font-sans text-content-muted">
            선택한 근무에 이번 QR 스캔 시각이 기록됩니다.
          </Text>
        </View>
      </BottomSheet>
      {isTutorialVisible && (
        <View className="absolute inset-0 z-10">
          <TutorialOverlay
            config={QR_CHECKIN_TUTORIAL}
            onComplete={completeTutorial}
            timeoutMs={tutorialTimeoutMs}
          />
        </View>
      )}
    </SafeAreaView>
  );
}
