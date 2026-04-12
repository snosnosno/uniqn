/**
 * UNIQN Mobile - QRCodeScanner 컴포넌트
 *
 * @description 출퇴근용 QR 코드 스캐너
 * @version 2.1.0 - Event QR 시스템 전용 + 웹 호환성
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal as RNModal,
  useWindowDimensions,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { XMarkIcon, RefreshIcon, ScanIcon } from '@/components/icons';
import { logger } from '@/utils/logger';
import { isWeb } from '@/utils/platform';
import { WebPortal } from '@/components/ui/WebPortal';
import type { QRCodeScanResult, QRCodeAction, QRScanError } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface QRCodeScannerProps {
  visible: boolean;
  onClose: () => void;
  onScan: (result: QRCodeScanResult) => void;
  /** UI 표시용 (실제 검증은 processEventQRCheckIn에서 수행) */
  expectedAction?: QRCodeAction;
  title?: string;
  /** QR 처리 에러 정보 */
  scanError?: QRScanError | null;
  /** 에러 초기화 콜백 */
  onClearError?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

// ============================================================================
// Component
// ============================================================================

export function QRCodeScanner({
  visible,
  onClose,
  onScan,
  expectedAction,
  title = 'QR 코드 스캔',
  scanError,
  onClearError,
}: QRCodeScannerProps) {
  const { width: windowWidth } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const scanAreaSize = Math.min(Math.max(windowWidth * 0.7, 220), 320);

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

        // Event QR 시스템: qrString만 전달 (processEventQRCheckIn에서 파싱 및 검증)
        onScan({
          success: true,
          qrString: result.data,
        });
      } catch (error) {
        logger.error('QR 코드 처리 실패', error as Error);
        onScan({
          success: false,
          error: '유효하지 않은 QR 코드입니다.',
        });
      }
    },
    [scanned, onScan]
  );

  // 다시 스캔
  const handleRescan = useCallback(() => {
    setScanned(false);
  }, []);

  // 플래시 토글
  const handleToggleFlash = useCallback(() => {
    setFlashEnabled((prev) => !prev);
  }, []);

  // 권한 체크 - 모달 내부 컨텐츠
  const renderContent = () => {
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
        <SafeAreaView className="flex-1 bg-secondary-900" edges={['top', 'bottom']}>
          <View className="flex-1 justify-center items-center p-6">
            <ScanIcon size={64} color="#6B7280" />
            <Text className="text-white text-xl font-bold mt-4 text-center">
              카메라 권한이 필요합니다
            </Text>
            <Text className="text-secondary-400 text-center mt-2 mb-6">
              QR 코드를 스캔하려면 카메라 접근 권한을 허용해주세요.
            </Text>
            <Button onPress={requestPermission}>권한 허용하기</Button>
            <Pressable onPress={onClose} className="mt-4">
              <Text className="text-secondary-400">닫기</Text>
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
            className="w-10 h-10 items-center justify-center rounded-sm"
            accessibilityLabel="닫기"
          >
            <XMarkIcon size={24} color="#FFFFFF" />
          </Pressable>
          <Text className="text-white text-lg font-semibold">{title}</Text>
          <Pressable
            onPress={handleToggleFlash}
            className="w-10 h-10 items-center justify-center rounded-sm"
            accessibilityLabel={flashEnabled ? '플래시 끄기' : '플래시 켜기'}
          >
            <Text className={flashEnabled ? 'text-warning-400' : 'text-white'}>
              {flashEnabled ? '' : ''}
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
                width: scanAreaSize,
                height: scanAreaSize,
                borderWidth: 2,
                borderColor: scanned ? '#22C55E' : '#FFFFFF',
                borderRadius: 16,
              }}
            >
              {/* 코너 장식 */}
              <View
                className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 rounded-tl-lg"
                style={{ borderColor: scanned ? '#22C55E' : '#D4AF37' }}
              />
              <View
                className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 rounded-tr-lg"
                style={{ borderColor: scanned ? '#22C55E' : '#D4AF37' }}
              />
              <View
                className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 rounded-bl-lg"
                style={{ borderColor: scanned ? '#22C55E' : '#D4AF37' }}
              />
              <View
                className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 rounded-br-lg"
                style={{ borderColor: scanned ? '#22C55E' : '#D4AF37' }}
              />
            </View>

            {/* 안내 문구 / 에러 표시 */}
            {scanError ? (
              <View className="mt-6 px-8 items-center">
                <View className="bg-error-900/80 rounded-md p-4 w-full">
                  <Text className="text-error-300 text-center font-semibold mb-1">스캔 실패</Text>
                  <Text className="text-white text-center text-sm">{scanError.message}</Text>
                  {scanError.isRetryable && (
                    <Text className="text-secondary-400 text-center text-xs mt-2">
                      다시 스캔하거나 새 QR 코드를 요청하세요
                    </Text>
                  )}
                </View>
              </View>
            ) : (
              <Text className="text-white text-center mt-6 px-8">
                {scanned
                  ? '스캔 완료!'
                  : expectedAction === 'checkIn'
                    ? 'QR 코드를 영역 안에 맞춰주세요\n(출근용)'
                    : expectedAction === 'checkOut'
                      ? 'QR 코드를 영역 안에 맞춰주세요\n(퇴근용)'
                      : 'QR 코드를 영역 안에 맞춰주세요'}
              </Text>
            )}
          </View>
        </View>

        {/* 하단 버튼 */}
        {(scanned || scanError) && (
          <View className="px-6 py-4 bg-black/50">
            <Button
              variant="outline"
              onPress={() => {
                handleRescan();
                onClearError?.();
              }}
              icon={<RefreshIcon size={20} color="#FFFFFF" />}
            >
              <Text className="text-white ml-2">다시 스캔하기</Text>
            </Button>
          </View>
        )}
      </SafeAreaView>
    );
  };

  // 웹: Portal로 z-index 99999에 렌더링 (다른 모달보다 위)
  if (isWeb) {
    return (
      <WebPortal visible={visible}>
        <View
          style={[
            StyleSheet.absoluteFill,
            // @ts-expect-error - 웹 전용 스타일
            { position: 'fixed', zIndex: 99999 },
          ]}
        >
          {renderContent()}
        </View>
      </WebPortal>
    );
  }

  // 네이티브: 기존 RNModal 사용
  return (
    <RNModal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {renderContent()}
    </RNModal>
  );
}

export default QRCodeScanner;
