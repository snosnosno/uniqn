/**
 * UNIQN Mobile - QR Screen
 * QR 코드 화면
 */

import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Button } from '@/components/ui';
import { QrCodeIcon, ScanIcon } from '@/components/icons';
import { useState } from 'react';

export default function QRScreen() {
  const [mode, setMode] = useState<'show' | 'scan'>('show');

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['top']}>
      {/* 헤더 */}
      <View className="bg-white px-4 py-3 dark:bg-gray-800">
        <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">QR 코드</Text>
      </View>

      <View className="flex-1 items-center justify-center px-6">
        {/* 모드 선택 버튼 */}
        <View className="mb-8 flex-row gap-3">
          <Button
            variant={mode === 'show' ? 'primary' : 'outline'}
            onPress={() => setMode('show')}
            icon={<QrCodeIcon size={18} color={mode === 'show' ? '#fff' : '#6B7280'} />}
          >
            내 QR
          </Button>
          <Button
            variant={mode === 'scan' ? 'primary' : 'outline'}
            onPress={() => setMode('scan')}
            icon={<ScanIcon size={18} color={mode === 'scan' ? '#fff' : '#6B7280'} />}
          >
            스캔
          </Button>
        </View>

        {mode === 'show' ? (
          // QR 코드 표시
          <Card padding="lg" className="items-center">
            <View className="mb-4 h-48 w-48 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
              <QrCodeIcon size={120} color="#3b82f6" />
            </View>
            <Text className="text-center text-lg font-semibold text-gray-900 dark:text-gray-100">
              출퇴근 QR 코드
            </Text>
            <Text className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
              매니저에게 이 코드를 보여주세요
            </Text>
          </Card>
        ) : (
          // QR 스캔 (플레이스홀더)
          <Card padding="lg" className="items-center">
            <View className="mb-4 h-48 w-48 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
              <ScanIcon size={64} color="#9CA3AF" />
            </View>
            <Text className="text-center text-lg font-semibold text-gray-900 dark:text-gray-100">
              QR 코드 스캔
            </Text>
            <Text className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
              카메라 권한이 필요합니다
            </Text>
            <Button variant="outline" className="mt-4" onPress={() => {}}>
              카메라 권한 요청
            </Button>
          </Card>
        )}
      </View>
    </SafeAreaView>
  );
}
