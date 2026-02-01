/**
 * UNIQN Mobile - QR Screen
 *
 * @description 스태프용 QR 스캔 화면
 * @version 2.0.0 - 스캔 전용으로 변경 (QR 생성은 구인자 전용)
 *
 * @note 구인자의 QR 생성은 EventQRModal을 통해 이루어집니다.
 */

import { useState, useCallback, useEffect } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Button } from '@/components/ui';
import { QRCodeScanner } from '@/components/qr';
import { ScanIcon, CheckCircleIcon, ClockIcon } from '@/components/icons';
import { useQRCodeScanner, useCurrentWorkStatus } from '@/hooks';
import type { QRCodeAction, QRCodeScanResult } from '@/types';

// ============================================================================
// Main Component
// ============================================================================

export default function QRScreen() {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<QRCodeAction>('checkIn');

  // 현재 근무 상태 조회
  const { isWorking } = useCurrentWorkStatus();

  // 자동 액션 선택 (근무 중이면 퇴근, 아니면 출근)
  useEffect(() => {
    setSelectedAction(isWorking ? 'checkOut' : 'checkIn');
  }, [isWorking]);

  // QR 스캔 결과 핸들러
  const { handleScanResult, isProcessing } = useQRCodeScanner({
    onSuccess: () => {
      setIsScannerOpen(false);
    },
  });

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

  const actionLabel = selectedAction === 'checkIn' ? '출근' : '퇴근';

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['top']}>
      {/* 헤더 */}
      <View className="bg-white px-4 py-3 dark:bg-surface">
        <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">QR 스캔</Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          구인자의 QR 코드를 스캔하여 출퇴근하세요
        </Text>
      </View>

      <View className="flex-1 px-4 py-6">
        {/* 현재 상태 표시 */}
        <Card
          className="mb-6"
          accessibilityLabel={`현재 상태: ${isWorking ? '근무 중' : '출근 전'}`}
        >
          <View className="flex-row items-center">
            <View
              className={`w-12 h-12 rounded-full items-center justify-center ${
                isWorking ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-surface'
              }`}
            >
              {isWorking ? (
                <ClockIcon size={24} color="#22C55E" />
              ) : (
                <CheckCircleIcon size={24} color="#9CA3AF" />
              )}
            </View>
            <View className="ml-4 flex-1">
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
                  : 'bg-primary-100 dark:bg-primary-900/30'
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  isWorking
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-primary-700 dark:text-primary-300'
                }`}
              >
                {actionLabel} 필요
              </Text>
            </View>
          </View>
        </Card>

        {/* QR 스캔 메인 카드 */}
        <Card padding="lg" className="flex-1 items-center justify-center">
          <View className="mb-8 h-56 w-56 items-center justify-center rounded-3xl border-2 border-dashed border-gray-300 dark:border-surface-overlay bg-gray-50 dark:bg-surface">
            <ScanIcon size={80} color="#9CA3AF" />
          </View>

          <Text className="text-center text-xl font-bold text-gray-900 dark:text-gray-100">
            QR 코드 스캔
          </Text>

          <Text className="mt-3 text-center text-base text-gray-500 dark:text-gray-400 px-4 leading-6">
            구인자가 보여주는 QR 코드를 스캔하여{'\n'}
            {actionLabel}을 완료하세요
          </Text>

          <View className="w-full mt-8">
            <Button
              variant="primary"
              onPress={handleOpenScanner}
              loading={isProcessing}
              fullWidth
              size="lg"
              icon={<ScanIcon size={24} color="#FFFFFF" />}
              accessibilityLabel={`카메라로 ${actionLabel} QR 코드 스캔하기`}
              accessibilityHint="QR 코드 스캐너가 열립니다"
            >
              카메라로 스캔하기
            </Button>
          </View>

          {/* 안내 문구 */}
          <View className="mt-6 px-4">
            <Text className="text-center text-xs text-gray-400 dark:text-gray-500">
              QR 코드는 구인자가 현장에서 생성합니다.{'\n'}
              스캔 후 자동으로 출퇴근이 처리됩니다.
            </Text>
          </View>
        </Card>
      </View>

      {/* QR 스캐너 */}
      <QRCodeScanner
        visible={isScannerOpen}
        onClose={handleCloseScanner}
        onScan={handleScan}
        expectedAction={selectedAction}
        title={`${actionLabel} QR 스캔`}
      />
    </SafeAreaView>
  );
}
