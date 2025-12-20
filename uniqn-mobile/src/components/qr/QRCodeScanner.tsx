/**
 * UNIQN Mobile - QRCodeScanner 컴포넌트
 *
 * @description 출퇴근용 QR 코드 스캐너
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import {
  XMarkIcon,
  RefreshIcon,
  ScanIcon,
} from '@/components/icons';
import { logger } from '@/utils/logger';
import type { QRCodeScanResult, QRCodeAction } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface QRCodeScannerProps {
  visible: boolean;
  onClose: () => void;
  onScan: (result: QRCodeScanResult) => void;
  expectedAction?: QRCodeAction;
  title?: string;
}

// ============================================================================
// Constants
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCAN_AREA_SIZE = SCREEN_WIDTH * 0.7;

// ============================================================================
// Component
// ============================================================================

export function QRCodeScanner({
  visible,
  onClose,
  onScan,
  expectedAction,
  title = 'QR 코드 스캔',
}: QRCodeScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);

  // 권한 요청
  useEffect(() => {
    if (visible && !permission?.granted) {
      requestPermission();
    }
  }, [visible, permission, requestPermission]);

  // 컴포넌트 열릴 때 스캔 상태 초기화
  useEffect(() => {
    if (visible) {
      setScanned(false);
    }
  }, [visible]);

  // QR 코드 스캔 핸들러
  const handleBarCodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (scanned) return;

      setScanned(true);

      try {
        logger.info('QR 코드 스캔됨', { data: result.data });

        // QR 코드 데이터 파싱 시도
        let qrData: { qrCodeId?: string; eventId?: string; action?: string };

        try {
          qrData = JSON.parse(result.data);
        } catch {
          // JSON이 아닌 경우 ID로 간주
          qrData = { qrCodeId: result.data };
        }

        // 액션 검증 (expectedAction이 있는 경우)
        if (expectedAction && qrData.action && qrData.action !== expectedAction) {
          onScan({
            success: false,
            error: expectedAction === 'checkIn'
              ? '출근용 QR 코드가 아닙니다.'
              : '퇴근용 QR 코드가 아닙니다.',
          });
          return;
        }

        onScan({
          success: true,
          qrCodeId: qrData.qrCodeId,
          eventId: qrData.eventId,
          action: qrData.action as QRCodeAction | undefined,
        });
      } catch (error) {
        logger.error('QR 코드 파싱 실패', error as Error);
        onScan({
          success: false,
          error: '유효하지 않은 QR 코드입니다.',
        });
      }
    },
    [scanned, expectedAction, onScan]
  );

  // 다시 스캔
  const handleRescan = useCallback(() => {
    setScanned(false);
  }, []);

  // 플래시 토글
  const handleToggleFlash = useCallback(() => {
    setFlashEnabled((prev) => !prev);
  }, []);

  if (!visible) return null;

  // 권한 체크
  if (!permission) {
    return (
      <SafeAreaView className="flex-1 bg-black" edges={['top', 'bottom']}>
        <View className="flex-1 justify-center items-center">
          <Text className="text-white">카메라 권한 확인 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-gray-900" edges={['top', 'bottom']}>
        <View className="flex-1 justify-center items-center p-6">
          <ScanIcon size={64} color="#6B7280" />
          <Text className="text-white text-xl font-bold mt-4 text-center">
            카메라 권한이 필요합니다
          </Text>
          <Text className="text-gray-400 text-center mt-2 mb-6">
            QR 코드를 스캔하려면 카메라 접근 권한을 허용해주세요.
          </Text>
          <Button onPress={requestPermission}>
            권한 허용하기
          </Button>
          <Pressable onPress={onClose} className="mt-4">
            <Text className="text-gray-400">닫기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top', 'bottom']}>
      {/* 헤더 */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-black/50 z-10">
        <Pressable
          onPress={onClose}
          className="w-10 h-10 items-center justify-center rounded-full"
          accessibilityLabel="닫기"
        >
          <XMarkIcon size={24} color="#FFFFFF" />
        </Pressable>
        <Text className="text-white text-lg font-semibold">{title}</Text>
        <Pressable
          onPress={handleToggleFlash}
          className="w-10 h-10 items-center justify-center rounded-full"
          accessibilityLabel={flashEnabled ? '플래시 끄기' : '플래시 켜기'}
        >
          <Text className={flashEnabled ? 'text-yellow-400' : 'text-white'}>
            {flashEnabled ? '🔦' : '💡'}
          </Text>
        </Pressable>
      </View>

      {/* 카메라 뷰 */}
      <View className="flex-1">
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          enableTorch={flashEnabled}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        />

        {/* 오버레이 */}
        <View className="flex-1 justify-center items-center">
          {/* 스캔 영역 가이드 */}
          <View
            style={{
              width: SCAN_AREA_SIZE,
              height: SCAN_AREA_SIZE,
              borderWidth: 2,
              borderColor: scanned ? '#22C55E' : '#FFFFFF',
              borderRadius: 16,
            }}
          >
            {/* 코너 장식 */}
            <View
              className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 rounded-tl-lg"
              style={{ borderColor: scanned ? '#22C55E' : '#3B82F6' }}
            />
            <View
              className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 rounded-tr-lg"
              style={{ borderColor: scanned ? '#22C55E' : '#3B82F6' }}
            />
            <View
              className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 rounded-bl-lg"
              style={{ borderColor: scanned ? '#22C55E' : '#3B82F6' }}
            />
            <View
              className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 rounded-br-lg"
              style={{ borderColor: scanned ? '#22C55E' : '#3B82F6' }}
            />
          </View>

          {/* 안내 문구 */}
          <Text className="text-white text-center mt-6 px-8">
            {scanned
              ? '스캔 완료!'
              : expectedAction === 'checkIn'
                ? 'QR 코드를 영역 안에 맞춰주세요\n(출근용)'
                : expectedAction === 'checkOut'
                  ? 'QR 코드를 영역 안에 맞춰주세요\n(퇴근용)'
                  : 'QR 코드를 영역 안에 맞춰주세요'}
          </Text>
        </View>
      </View>

      {/* 하단 버튼 */}
      {scanned && (
        <View className="px-6 py-4 bg-black/50">
          <Button
            variant="outline"
            onPress={handleRescan}
            icon={<RefreshIcon size={20} color="#FFFFFF" />}
          >
            <Text className="text-white ml-2">다시 스캔하기</Text>
          </Button>
        </View>
      )}
    </SafeAreaView>
  );
}

export default QRCodeScanner;
