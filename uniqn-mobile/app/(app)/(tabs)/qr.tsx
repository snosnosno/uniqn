/**
 * UNIQN Mobile - QR Screen
 * QR 코드 화면 - 출퇴근용 QR 생성 및 스캔
 */

import { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Button, EmptyState } from '@/components/ui';
import { QRCodeScanner, QRCodeDisplay } from '@/components/qr';
import { QrCodeIcon, ScanIcon, RefreshIcon, CalendarIcon } from '@/components/icons';
import {
  useCreateQRCode,
  useQRCodeScanner,
  useCurrentWorkStatus,
  useTodaySchedules,
} from '@/hooks';
import type { QRCodeAction, QRCodeScanResult, ScheduleEvent } from '@/types';

// ============================================================================
// Constants
// ============================================================================

type Mode = 'show' | 'scan';

// ============================================================================
// Main Component
// ============================================================================

export default function QRScreen() {
  const [mode, setMode] = useState<Mode>('show');
  const [selectedAction, setSelectedAction] = useState<QRCodeAction>('checkIn');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isDisplayOpen, setIsDisplayOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleEvent | null>(null);

  // 현재 근무 상태 조회
  const { currentWorkLog, isWorking } = useCurrentWorkStatus();

  // 오늘의 스케줄 조회
  const { schedules: todaySchedules, isLoading: isLoadingSchedules } = useTodaySchedules();

  // QR 코드 생성 훅
  const {
    createQRCode,
    qrData,
    isLoading: isCreatingQR,
    reset: resetQR,
  } = useCreateQRCode({
    onSuccess: () => {
      setIsDisplayOpen(true);
    },
  });

  // 자동 액션 선택 (근무 중이면 퇴근, 아니면 출근)
  useEffect(() => {
    setSelectedAction(isWorking ? 'checkOut' : 'checkIn');
  }, [isWorking]);

  // 확정된 스케줄 필터링
  const confirmedSchedules = todaySchedules.filter((s) => s.type === 'confirmed');

  // QR 스캔 결과 핸들러
  const { handleScanResult, isProcessing } = useQRCodeScanner({
    workLogId: selectedSchedule?.workLogId || currentWorkLog?.id || '',
    expectedAction: selectedAction,
    onSuccess: () => {
      setIsScannerOpen(false);
    },
  });

  // QR 생성 핸들러
  const handleGenerateQR = useCallback(() => {
    if (!selectedSchedule?.eventId) return;

    createQRCode({
      eventId: selectedSchedule.eventId,
      action: selectedAction,
    });
  }, [createQRCode, selectedSchedule, selectedAction]);

  // QR 새로고침 핸들러
  const handleRefreshQR = useCallback(() => {
    resetQR();
    handleGenerateQR();
  }, [resetQR, handleGenerateQR]);

  // 스캐너 열기
  const handleOpenScanner = useCallback(() => {
    setIsScannerOpen(true);
  }, []);

  // 스캐너 닫기
  const handleCloseScanner = useCallback(() => {
    setIsScannerOpen(false);
  }, []);

  // 스캔 완료
  const handleScan = useCallback(
    (result: QRCodeScanResult) => {
      handleScanResult(result);
    },
    [handleScanResult]
  );

  // QR 표시 닫기
  const handleCloseDisplay = useCallback(() => {
    setIsDisplayOpen(false);
  }, []);

  // 스케줄 선택
  const handleSelectSchedule = useCallback((schedule: ScheduleEvent) => {
    setSelectedSchedule(schedule);
  }, []);

  const actionLabel = selectedAction === 'checkIn' ? '출근' : '퇴근';

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['top']}>
      {/* 헤더 */}
      <View className="bg-white px-4 py-3 dark:bg-gray-800">
        <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">QR 코드</Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          출퇴근 QR 코드를 생성하거나 스캔하세요
        </Text>
      </View>

      <View className="flex-1 px-4 py-6">
        {/* 현재 상태 표시 */}
        <Card className="mb-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-sm text-gray-500 dark:text-gray-400">현재 상태</Text>
              <Text
                className={`text-lg font-semibold ${
                  isWorking
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                {isWorking ? '근무 중' : '출근 전'}
              </Text>
            </View>
            <View
              className={`px-3 py-1.5 rounded-full ${
                isWorking
                  ? 'bg-green-100 dark:bg-green-900/30'
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  isWorking
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                {actionLabel} 필요
              </Text>
            </View>
          </View>
        </Card>

        {/* 모드 선택 버튼 */}
        <View className="mb-6 flex-row gap-3">
          <Pressable
            className={`flex-1 flex-row items-center justify-center py-3 rounded-xl ${
              mode === 'show'
                ? 'bg-primary-600'
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
            }`}
            onPress={() => setMode('show')}
          >
            <QrCodeIcon size={20} color={mode === 'show' ? '#FFFFFF' : '#6B7280'} />
            <Text
              className={`ml-2 font-medium ${
                mode === 'show' ? 'text-white' : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              내 QR 생성
            </Text>
          </Pressable>
          <Pressable
            className={`flex-1 flex-row items-center justify-center py-3 rounded-xl ${
              mode === 'scan'
                ? 'bg-primary-600'
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
            }`}
            onPress={() => setMode('scan')}
          >
            <ScanIcon size={20} color={mode === 'scan' ? '#FFFFFF' : '#6B7280'} />
            <Text
              className={`ml-2 font-medium ${
                mode === 'scan' ? 'text-white' : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              QR 스캔
            </Text>
          </Pressable>
        </View>

        {mode === 'show' ? (
          // QR 코드 생성 모드
          <View className="flex-1">
            {/* 오늘의 스케줄 목록 */}
            {confirmedSchedules.length === 0 ? (
              <EmptyState
                title="오늘 스케줄이 없습니다"
                description="확정된 스케줄이 있을 때 QR 코드를 생성할 수 있습니다."
                variant="content"
              />
            ) : (
              <>
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  스케줄 선택
                </Text>
                {confirmedSchedules.map((schedule) => (
                  <Pressable
                    key={schedule.id}
                    onPress={() => handleSelectSchedule(schedule)}
                    className={`mb-2 p-4 rounded-xl border-2 ${
                      selectedSchedule?.id === schedule.id
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                    }`}
                  >
                    <View className="flex-row items-center">
                      <CalendarIcon
                        size={20}
                        color={selectedSchedule?.id === schedule.id ? '#3B82F6' : '#6B7280'}
                      />
                      <View className="ml-3 flex-1">
                        <Text
                          className={`font-medium ${
                            selectedSchedule?.id === schedule.id
                              ? 'text-primary-700 dark:text-primary-300'
                              : 'text-gray-900 dark:text-gray-100'
                          }`}
                        >
                          {schedule.eventName}
                        </Text>
                        <Text className="text-sm text-gray-500 dark:text-gray-400">
                          {schedule.role}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                ))}

                {/* QR 생성 버튼 */}
                {selectedSchedule && (
                  <View className="mt-4">
                    <Button
                      onPress={handleGenerateQR}
                      loading={isCreatingQR}
                      fullWidth
                      icon={<QrCodeIcon size={20} color="#FFFFFF" />}
                    >
                      {actionLabel} QR 코드 생성
                    </Button>
                  </View>
                )}
              </>
            )}
          </View>
        ) : (
          // QR 스캔 모드
          <View className="flex-1 items-center justify-center">
            <Card padding="lg" className="items-center w-full">
              <View className="mb-6 h-48 w-48 items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                <ScanIcon size={64} color="#9CA3AF" />
              </View>
              <Text className="text-center text-lg font-semibold text-gray-900 dark:text-gray-100">
                QR 코드 스캔
              </Text>
              <Text className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400 px-4">
                관리자가 보여주는 QR 코드를 스캔하여{'\n'}
                {actionLabel}을 완료하세요
              </Text>
              <Button
                variant="primary"
                className="mt-6"
                onPress={handleOpenScanner}
                fullWidth
                icon={<ScanIcon size={20} color="#FFFFFF" />}
              >
                카메라로 스캔하기
              </Button>
            </Card>
          </View>
        )}
      </View>

      {/* QR 스캐너 */}
      <QRCodeScanner
        visible={isScannerOpen}
        onClose={handleCloseScanner}
        onScan={handleScan}
        expectedAction={selectedAction}
        title={`${actionLabel} QR 스캔`}
      />

      {/* QR 코드 표시 */}
      <QRCodeDisplay
        visible={isDisplayOpen}
        onClose={handleCloseDisplay}
        qrData={qrData || null}
        isLoading={isCreatingQR}
        onRefresh={handleRefreshQR}
        action={selectedAction}
      />
    </SafeAreaView>
  );
}
