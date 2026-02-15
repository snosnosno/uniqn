/**
 * UNIQN Mobile - 본인인증 컴포넌트
 *
 * @description 포트원 V2 SDK 기반 휴대폰 본인인증
 * @version 2.1.0
 *
 * 플로우:
 * 1. 사용자가 "휴대폰 본인인증" 버튼 클릭
 * 2. 포트원 SDK WebView 모달 오픈
 * 3. 인증 완료 후 Cloud Function으로 결과 검증
 * 4. CI/DI는 서버에만 저장, 클라이언트에는 개인정보만 반환
 *
 * 개발 모드: Mock 인증 사용 (포트원 SDK 미호출)
 */

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldCheckIcon, CheckCircleIcon, XCircleIcon } from '@/components/icons';
import {
  generateIdentityVerificationId,
  getPortOneParams,
  verifyIdentityResult,
} from '@/services/identityVerificationService';
import type { VerifiedIdentityData } from '@/services/identityVerificationService';

// 포트원 SDK 컴포넌트 (네이티브 전용, 모듈 최상위에서 로드)
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const PortOneSDK = Platform.OS !== 'web' ? require('@portone/react-native-sdk') : null;

// ============================================================================
// Types
// ============================================================================

/** 본인인증 제공자 */
export type IdentityProvider = 'pass' | 'kakao';

/** 본인인증 결과 */
export interface VerificationResult {
  /** 인증된 이름 */
  name: string;
  /** 인증된 휴대폰 번호 */
  phone: string;
  /** 인증된 생년월일 (YYYYMMDD) */
  birthDate: string;
  /** 인증된 성별 */
  gender: 'male' | 'female';
  /** 사용한 인증 제공자 */
  provider: IdentityProvider;
  /** 인증 완료 시간 */
  verifiedAt: Date;
  /** 포트원 본인인증 ID (서버에서 CI/DI 연결에 사용) */
  identityVerificationId: string;
}

/** 본인인증 상태 */
export type VerificationStatus = 'idle' | 'verifying' | 'success' | 'error';

/** 컴포넌트 Props */
export interface IdentityVerificationProps {
  /** 인증 완료 콜백 */
  onVerified: (result: VerificationResult) => void;
  /** 인증 실패 콜백 */
  onError?: (error: Error) => void;
  /** 초기 인증 결과 (이미 인증된 경우) */
  initialResult?: VerificationResult | null;
  /** 제목 */
  title?: string;
  /** 설명 */
  description?: string;
  /** 컴팩트 모드 (작은 크기) */
  compact?: boolean;
  /** 비활성화 */
  disabled?: boolean;
  /** 개발 모드 (모의 인증 허용) */
  devMode?: boolean;
}

// ============================================================================
// Mock Data (개발용)
// ============================================================================

const MOCK_VERIFICATION_DELAY = 1500; // ms

function generateMockResult(): VerificationResult {
  return {
    name: '홍길동',
    phone: '010-1234-5678',
    birthDate: '19900101',
    gender: 'male',
    provider: 'pass',
    verifiedAt: new Date(),
    identityVerificationId: `mock-${Date.now()}`,
  };
}

// ============================================================================
// PortOne WebView Modal (네이티브 전용)
// ============================================================================

interface PortOneModalProps {
  visible: boolean;
  identityVerificationId: string;
  onComplete: (verifiedData: VerifiedIdentityData) => void;
  onError: (error: Error) => void;
  onClose: () => void;
}

/**
 * 포트원 본인인증 WebView 모달
 * - @portone/react-native-sdk의 IdentityVerification 컴포넌트를 렌더링
 * - 웹에서는 사용 불가 (네이티브 전용)
 */
function PortOneModal({
  visible,
  identityVerificationId,
  onComplete,
  onError,
  onClose,
}: PortOneModalProps) {
  const [verifying, setVerifying] = useState(false);

  if (!PortOneSDK) return null;

  const PortOneIdentityVerification = PortOneSDK.IdentityVerification;
  const params = getPortOneParams(identityVerificationId);

  const handleComplete = async (response: {
    code?: string;
    message?: string;
    identityVerificationId: string;
  }) => {
    // SDK 응답에 code가 있으면 에러
    if (response.code !== null && response.code !== undefined) {
      if (response.code === 'IDENTITY_VERIFICATION_CANCELLED') {
        onClose();
        return;
      }
      onError(new Error(response.message || '본인인증에 실패했습니다.'));
      return;
    }

    // Cloud Function으로 인증 결과 검증
    setVerifying(true);
    try {
      const verifiedData = await verifyIdentityResult(identityVerificationId);
      onComplete(verifiedData);
    } catch (err) {
      onError(err instanceof Error ? err : new Error('인증 결과 검증에 실패했습니다.'));
    } finally {
      setVerifying(false);
    }
  };

  const handleError = (error: { code?: string; message?: string }) => {
    onError(new Error(error.message || '본인인증 중 오류가 발생했습니다.'));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
        {/* 닫기 헤더 */}
        <View className="flex-row items-center justify-between px-4 pb-3 border-b border-gray-200 dark:border-gray-700">
          <Text className="text-lg font-bold text-gray-900 dark:text-white">본인인증</Text>
          <Pressable onPress={onClose} className="p-2">
            <Text className="text-gray-500 dark:text-gray-400 text-base">닫기</Text>
          </Pressable>
        </View>

        {/* 검증 중 오버레이 */}
        {verifying ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#6366f1" />
            <Text className="mt-4 text-gray-600 dark:text-gray-400">인증 결과 확인 중...</Text>
          </View>
        ) : (
          /* 포트원 SDK 컴포넌트 (WebView) */
          <PortOneIdentityVerification
            request={params}
            onComplete={handleComplete}
            onError={handleError}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ============================================================================
// Component
// ============================================================================

export const IdentityVerification: React.FC<IdentityVerificationProps> = React.memo(
  ({
    onVerified,
    onError,
    initialResult = null,
    title = '본인인증',
    description = '안전한 서비스 이용을 위해 본인인증이 필요합니다.',
    compact = false,
    disabled = false,
    devMode = __DEV__,
  }) => {
    const [status, setStatus] = useState<VerificationStatus>(initialResult ? 'success' : 'idle');
    const [result, setResult] = useState<VerificationResult | null>(initialResult);
    const [error, setError] = useState<string | null>(null);

    // 포트원 모달 상태
    const [showPortOne, setShowPortOne] = useState(false);
    const [currentVerificationId, setCurrentVerificationId] = useState('');

    /**
     * 본인인증 시작
     */
    const handleVerification = useCallback(async () => {
      if (disabled || status === 'verifying') return;

      setStatus('verifying');
      setError(null);

      if (devMode) {
        // 개발 모드: 모의 인증
        try {
          await new Promise((resolve) => setTimeout(resolve, MOCK_VERIFICATION_DELAY));
          const mockResult = generateMockResult();
          setResult(mockResult);
          setStatus('success');
          onVerified(mockResult);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : '본인인증에 실패했습니다.';
          setError(errorMessage);
          setStatus('error');
          onError?.(err instanceof Error ? err : new Error(errorMessage));
        }
      } else {
        // 프로덕션: 포트원 SDK 모달 오픈
        const verificationId = generateIdentityVerificationId();
        setCurrentVerificationId(verificationId);
        setShowPortOne(true);
      }
    }, [disabled, status, devMode, onVerified, onError]);

    /**
     * 포트원 인증 완료
     */
    const handlePortOneComplete = useCallback(
      (verifiedData: VerifiedIdentityData) => {
        setShowPortOne(false);
        const verificationResult: VerificationResult = {
          name: verifiedData.name,
          phone: verifiedData.phone,
          birthDate: verifiedData.birthDate,
          gender: verifiedData.gender,
          provider: 'pass',
          verifiedAt: new Date(),
          identityVerificationId: currentVerificationId,
        };
        setResult(verificationResult);
        setStatus('success');
        onVerified(verificationResult);
      },
      [onVerified, currentVerificationId]
    );

    /**
     * 포트원 인증 실패
     */
    const handlePortOneError = useCallback(
      (err: Error) => {
        setShowPortOne(false);
        setError(err.message);
        setStatus('error');
        onError?.(err);
      },
      [onError]
    );

    /**
     * 포트원 모달 닫기 (취소)
     */
    const handlePortOneClose = useCallback(() => {
      setShowPortOne(false);
      setStatus('idle');
    }, []);

    /**
     * 인증 초기화 (다시 인증)
     */
    const handleReset = useCallback(() => {
      setResult(null);
      setStatus('idle');
      setError(null);
    }, []);

    // 컴팩트 모드: 인증 완료 시 간단한 표시
    if (compact && result) {
      return (
        <View className="flex-row items-center bg-success-50 dark:bg-success-900/20 px-3 py-2 rounded-lg">
          <CheckCircleIcon size={16} color="#22c55e" />
          <Text className="ml-2 text-sm text-success-700 dark:text-success-400">
            본인인증 완료 ({result.name})
          </Text>
          <Pressable onPress={handleReset} className="ml-auto">
            <Text className="text-xs text-gray-500 dark:text-gray-400 underline">재인증</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View className="w-full">
        {/* 포트원 본인인증 모달 */}
        {showPortOne && (
          <PortOneModal
            visible={showPortOne}
            identityVerificationId={currentVerificationId}
            onComplete={handlePortOneComplete}
            onError={handlePortOneError}
            onClose={handlePortOneClose}
          />
        )}

        {/* 헤더 */}
        {!compact && (
          <View className="items-center mb-6">
            <View className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full items-center justify-center mb-3">
              <ShieldCheckIcon size={32} color="#6366f1" />
            </View>
            <Text className="text-xl font-bold text-gray-900 dark:text-white">{title}</Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1">
              {description}
            </Text>
          </View>
        )}

        {/* 인증 완료 상태 */}
        {result && status === 'success' ? (
          <View className="bg-success-50 dark:bg-success-900/20 rounded-xl p-4 mb-4">
            <View className="flex-row items-center mb-4">
              <View className="w-10 h-10 rounded-full bg-success-500 items-center justify-center">
                <CheckCircleIcon size={24} color="white" />
              </View>
              <View className="ml-3">
                <Text className="text-success-700 dark:text-success-400 font-semibold">
                  본인인증 완료
                </Text>
                <Text className="text-xs text-success-600 dark:text-success-500">
                  휴대폰 본인인증
                </Text>
              </View>
            </View>

            <View className="bg-white dark:bg-surface rounded-lg p-3 flex-col gap-2">
              <View className="flex-row justify-between">
                <Text className="text-gray-500 dark:text-gray-400 text-sm">이름</Text>
                <Text className="text-gray-900 dark:text-white font-medium">{result.name}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-gray-500 dark:text-gray-400 text-sm">휴대폰</Text>
                <Text className="text-gray-900 dark:text-white font-medium">{result.phone}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-gray-500 dark:text-gray-400 text-sm">생년월일</Text>
                <Text className="text-gray-900 dark:text-white font-medium">
                  {result.birthDate.replace(/(\d{4})(\d{2})(\d{2})/, '$1.$2.$3')}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-gray-500 dark:text-gray-400 text-sm">성별</Text>
                <Text className="text-gray-900 dark:text-white font-medium">
                  {result.gender === 'male' ? '남성' : '여성'}
                </Text>
              </View>
            </View>

            <Pressable onPress={handleReset} className="mt-4 py-2 items-center">
              <Text className="text-sm text-gray-500 dark:text-gray-400 underline">
                다시 인증하기
              </Text>
            </Pressable>
          </View>
        ) : (
          /* 인증 버튼 */
          <View className="flex-col gap-3">
            {/* 휴대폰 본인인증 */}
            <Pressable
              onPress={handleVerification}
              disabled={disabled || status === 'verifying'}
              className={`
                flex-row items-center justify-center
                py-4 px-6 rounded-xl
                bg-primary-600
                ${disabled || status === 'verifying' ? 'opacity-50' : 'active:opacity-80'}
              `}
              accessibilityLabel="휴대폰 본인인증"
              accessibilityHint="휴대폰을 통해 본인인증을 진행합니다"
            >
              {status === 'verifying' ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <ShieldCheckIcon size={20} color="white" />
                  <Text className="text-white font-bold text-base ml-2">휴대폰 본인인증</Text>
                </>
              )}
            </Pressable>

            {/* 개발 모드 표시 */}
            {devMode && (
              <View className="flex-row items-center justify-center mt-2">
                <View className="w-2 h-2 bg-yellow-500 rounded-full mr-2" />
                <Text className="text-xs text-gray-400 dark:text-gray-500">
                  개발 모드: 모의 인증이 활성화됨
                </Text>
              </View>
            )}
          </View>
        )}

        {/* 에러 메시지 */}
        {error && (
          <View className="flex-row items-center bg-error-50 dark:bg-error-900/20 rounded-lg p-3 mt-4">
            <XCircleIcon size={18} color="#ef4444" />
            <Text className="ml-2 text-error-600 dark:text-error-400 text-sm flex-1">{error}</Text>
          </View>
        )}

        {/* 안내 문구 */}
        {!result && (
          <View className="mt-6">
            <Text className="text-xs text-gray-400 dark:text-gray-500 text-center">
              본인인증 정보는 회원 확인 용도로만 사용되며,{'\n'}
              안전하게 보호됩니다.
            </Text>
          </View>
        )}
      </View>
    );
  }
);

IdentityVerification.displayName = 'IdentityVerification';

export default IdentityVerification;
