/**
 * UNIQN Mobile - QRCodeScanner 웹 버전
 *
 * @description 출퇴근용 QR 코드 스캐너 (웹 플랫폼)
 * @version 1.0.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import jsQR from 'jsqr';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { XMarkIcon, RefreshIcon, ScanIcon } from '@/components/icons';
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

type PermissionState = 'pending' | 'granted' | 'denied';

// ============================================================================
// Constants
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCAN_AREA_SIZE = Math.min(SCREEN_WIDTH * 0.7, 280);
const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;
const SCAN_INTERVAL = 200; // 200ms마다 스캔

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
  const [permission, setPermission] = useState<PermissionState>('pending');
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastScanRef = useRef<number>(0);

  // 카메라 시작
  const startCamera = useCallback(async () => {
    try {
      setError(null);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('이 브라우저는 카메라를 지원하지 않습니다.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: VIDEO_WIDTH },
          height: { ideal: VIDEO_HEIGHT },
        },
      });

      streamRef.current = stream;
      setPermission('granted');

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      logger.info('웹 카메라 시작됨');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '카메라 접근에 실패했습니다.';

      if (
        errorMessage.includes('NotAllowedError') ||
        errorMessage.includes('Permission denied')
      ) {
        setPermission('denied');
        setError('카메라 접근이 거부되었습니다. 브라우저 설정에서 허용해주세요.');
      } else {
        setError(errorMessage);
      }

      logger.error('웹 카메라 시작 실패', err as Error);
    }
  }, []);

  // 카메라 중지
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    logger.info('웹 카메라 중지됨');
  }, []);

  // QR 코드 스캔
  const scanQRCode = useCallback(() => {
    if (scanned) return;

    const now = Date.now();
    if (now - lastScanRef.current < SCAN_INTERVAL) {
      animationRef.current = requestAnimationFrame(scanQRCode);
      return;
    }
    lastScanRef.current = now;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationRef.current = requestAnimationFrame(scanQRCode);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      animationRef.current = requestAnimationFrame(scanQRCode);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code) {
      setScanned(true);
      handleQRCodeDetected(code.data);
    } else {
      animationRef.current = requestAnimationFrame(scanQRCode);
    }
  }, [scanned]);

  // QR 코드 감지 처리
  const handleQRCodeDetected = useCallback(
    (data: string) => {
      try {
        logger.info('QR 코드 스캔됨 (웹)', { data });

        // QR 코드 데이터 파싱 시도
        let qrData: { qrCodeId?: string; eventId?: string; action?: string };

        try {
          qrData = JSON.parse(data);
        } catch {
          // JSON이 아닌 경우 ID로 간주
          qrData = { qrCodeId: data };
        }

        // 액션 검증 (expectedAction이 있는 경우)
        if (expectedAction && qrData.action && qrData.action !== expectedAction) {
          onScan({
            success: false,
            error:
              expectedAction === 'checkIn'
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
      } catch (err) {
        logger.error('QR 코드 파싱 실패 (웹)', err as Error);
        onScan({
          success: false,
          error: '유효하지 않은 QR 코드입니다.',
        });
      }
    },
    [expectedAction, onScan]
  );

  // 다시 스캔
  const handleRescan = useCallback(() => {
    setScanned(false);
    lastScanRef.current = 0;
  }, []);

  // 권한 다시 요청
  const handleRetryPermission = useCallback(() => {
    setPermission('pending');
    setError(null);
    startCamera();
  }, [startCamera]);

  // 컴포넌트 열릴 때 카메라 시작
  useEffect(() => {
    if (visible) {
      setScanned(false);
      setError(null);
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [visible, startCamera, stopCamera]);

  // 스캔 루프 시작
  useEffect(() => {
    if (permission === 'granted' && !scanned && visible) {
      animationRef.current = requestAnimationFrame(scanQRCode);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [permission, scanned, visible, scanQRCode]);

  if (!visible) return null;

  // 권한 체크 중
  if (permission === 'pending' && !error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.statusText}>카메라 권한 확인 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 권한 거부 또는 에러
  if (permission === 'denied' || error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            style={styles.closeButton}
            accessibilityLabel="닫기"
          >
            <XMarkIcon size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.centerContent}>
          <ScanIcon size={64} color="#6B7280" />
          <Text style={styles.permissionTitle}>
            {permission === 'denied' ? '카메라 권한이 필요합니다' : '오류 발생'}
          </Text>
          <Text style={styles.permissionText}>
            {error || '카메라 접근 권한을 허용해주세요.'}
          </Text>
          <View style={styles.buttonContainer}>
            <Button onPress={handleRetryPermission}>다시 시도</Button>
          </View>
          <Pressable onPress={onClose} style={styles.closeTextButton}>
            <Text style={styles.closeText}>닫기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable
          onPress={onClose}
          style={styles.closeButton}
          accessibilityLabel="닫기"
        >
          <XMarkIcon size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.placeholder} />
      </View>

      {/* 카메라 뷰 */}
      <View style={styles.cameraContainer}>
        {/* 비디오 요소 (숨김) */}
        <video
          ref={videoRef as React.RefObject<HTMLVideoElement>}
          style={styles.video}
          playsInline
          muted
          autoPlay
        />

        {/* 캔버스 (숨김, 스캔용) */}
        <canvas
          ref={canvasRef as React.RefObject<HTMLCanvasElement>}
          style={styles.canvas}
        />

        {/* 오버레이 */}
        <View style={styles.overlay}>
          {/* 스캔 영역 가이드 */}
          <View
            style={[
              styles.scanArea,
              { width: SCAN_AREA_SIZE, height: SCAN_AREA_SIZE },
              scanned && styles.scanAreaSuccess,
            ]}
          >
            {/* 코너 장식 */}
            <View style={[styles.corner, styles.cornerTopLeft, scanned && styles.cornerSuccess]} />
            <View style={[styles.corner, styles.cornerTopRight, scanned && styles.cornerSuccess]} />
            <View style={[styles.corner, styles.cornerBottomLeft, scanned && styles.cornerSuccess]} />
            <View style={[styles.corner, styles.cornerBottomRight, scanned && styles.cornerSuccess]} />
          </View>

          {/* 안내 문구 */}
          <Text style={styles.guideText}>
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
        <View style={styles.bottomContainer}>
          <Button
            variant="outline"
            onPress={handleRescan}
            icon={<RefreshIcon size={20} color="#FFFFFF" />}
          >
            <Text style={styles.rescanButtonText}>다시 스캔하기</Text>
          </Button>
        </View>
      )}
    </SafeAreaView>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
    height: 40,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
  },
  canvas: {
    display: 'none',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 16,
    position: 'relative',
  },
  scanAreaSuccess: {
    borderColor: '#22C55E',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
  },
  cornerTopLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
    borderColor: '#3B82F6',
  },
  cornerTopRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
    borderColor: '#3B82F6',
  },
  cornerBottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
    borderColor: '#3B82F6',
  },
  cornerBottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
    borderColor: '#3B82F6',
  },
  cornerSuccess: {
    borderColor: '#22C55E',
  },
  guideText: {
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 32,
    fontSize: 14,
    lineHeight: 20,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  permissionText: {
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    paddingHorizontal: 32,
  },
  buttonContainer: {
    marginBottom: 16,
  },
  closeTextButton: {
    marginTop: 16,
  },
  closeText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  bottomContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  rescanButtonText: {
    color: '#FFFFFF',
    marginLeft: 8,
  },
});

export default QRCodeScanner;
