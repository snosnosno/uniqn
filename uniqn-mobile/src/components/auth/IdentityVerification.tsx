/**
 * UNIQN Mobile - 본인인증 컴포넌트
 *
 * @description 재사용 가능한 본인인증 UI (PASS/카카오)
 * @version 1.0.0
 *
 * TODO [Phase 6]: 실제 본인인증 SDK 연동
 * - PASS: react-native-nice-pass 또는 WebView
 * - Kakao: 카카오 본인인증 SDK
 */

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { ShieldCheckIcon, CheckCircleIcon, XCircleIcon } from '@/components/icons';

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
  /** 사용한 인증 제공자 */
  provider: IdentityProvider;
  /** 인증 완료 시간 */
  verifiedAt: Date;
  /** CI (연계정보, 필요한 경우) */
  ci?: string;
  /** DI (중복가입확인정보, 필요한 경우) */
  di?: string;
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

const MOCK_NAMES = ['홍길동', '김철수', '이영희', '박지성', '최민수'];
const MOCK_PHONES = ['010-1234-5678', '010-9876-5432', '010-1111-2222'];

function generateMockResult(provider: IdentityProvider): VerificationResult {
  return {
    name: MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)],
    phone: MOCK_PHONES[Math.floor(Math.random() * MOCK_PHONES.length)],
    provider,
    verifiedAt: new Date(),
  };
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
    const [status, setStatus] = useState<VerificationStatus>(
      initialResult ? 'success' : 'idle'
    );
    const [result, setResult] = useState<VerificationResult | null>(initialResult);
    const [error, setError] = useState<string | null>(null);
    const [activeProvider, setActiveProvider] = useState<IdentityProvider | null>(null);

    /**
     * 본인인증 시작
     */
    const handleVerification = useCallback(
      async (provider: IdentityProvider) => {
        if (disabled || status === 'verifying') return;

        setActiveProvider(provider);
        setStatus('verifying');
        setError(null);

        try {
          if (devMode) {
            // 개발 모드: 모의 인증
            await new Promise((resolve) => setTimeout(resolve, MOCK_VERIFICATION_DELAY));
            const mockResult = generateMockResult(provider);
            setResult(mockResult);
            setStatus('success');
            onVerified(mockResult);
          } else {
            // 프로덕션: 실제 SDK 연동
            // TODO [Phase 6]: 실제 본인인증 SDK 연동
            throw new Error('본인인증 서비스가 준비 중입니다.');
          }
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : '본인인증에 실패했습니다.';
          setError(errorMessage);
          setStatus('error');
          onError?.(err instanceof Error ? err : new Error(errorMessage));
        } finally {
          setActiveProvider(null);
        }
      },
      [disabled, status, devMode, onVerified, onError]
    );

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
            <Text className="text-xs text-gray-500 dark:text-gray-400 underline">
              재인증
            </Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View className="w-full">
        {/* 헤더 */}
        {!compact && (
          <View className="items-center mb-6">
            <View className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full items-center justify-center mb-3">
              <ShieldCheckIcon size={32} color="#6366f1" />
            </View>
            <Text className="text-xl font-bold text-gray-900 dark:text-white">
              {title}
            </Text>
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
                  {result.provider === 'pass' ? 'PASS' : '카카오'} 인증
                </Text>
              </View>
            </View>

            <View className="bg-white dark:bg-gray-800 rounded-lg p-3 space-y-2">
              <View className="flex-row justify-between">
                <Text className="text-gray-500 dark:text-gray-400 text-sm">이름</Text>
                <Text className="text-gray-900 dark:text-white font-medium">
                  {result.name}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-gray-500 dark:text-gray-400 text-sm">휴대폰</Text>
                <Text className="text-gray-900 dark:text-white font-medium">
                  {result.phone}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={handleReset}
              className="mt-4 py-2 items-center"
            >
              <Text className="text-sm text-gray-500 dark:text-gray-400 underline">
                다시 인증하기
              </Text>
            </Pressable>
          </View>
        ) : (
          /* 인증 버튼 */
          <View className="space-y-3">
            {/* PASS 본인인증 */}
            <Pressable
              onPress={() => handleVerification('pass')}
              disabled={disabled || status === 'verifying'}
              className={`
                flex-row items-center justify-center
                py-4 px-6 rounded-xl
                bg-[#1B1464]
                ${disabled || status === 'verifying' ? 'opacity-50' : 'active:opacity-80'}
              `}
              accessibilityLabel="PASS 본인인증"
              accessibilityHint="PASS 앱을 통해 본인인증을 진행합니다"
            >
              {activeProvider === 'pass' && status === 'verifying' ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Text className="text-white font-bold text-lg mr-2">PASS</Text>
                  <Text className="text-white font-medium">본인인증</Text>
                </>
              )}
            </Pressable>

            {/* 카카오 본인인증 */}
            <Pressable
              onPress={() => handleVerification('kakao')}
              disabled={disabled || status === 'verifying'}
              className={`
                flex-row items-center justify-center
                py-4 px-6 rounded-xl
                bg-[#FEE500]
                ${disabled || status === 'verifying' ? 'opacity-50' : 'active:opacity-80'}
              `}
              accessibilityLabel="카카오 본인인증"
              accessibilityHint="카카오를 통해 본인인증을 진행합니다"
            >
              {activeProvider === 'kakao' && status === 'verifying' ? (
                <ActivityIndicator color="#191919" size="small" />
              ) : (
                <>
                  <Text className="text-[#191919] text-lg mr-2">💬</Text>
                  <Text className="text-[#191919] font-medium">카카오 본인인증</Text>
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
            <Text className="ml-2 text-error-600 dark:text-error-400 text-sm flex-1">
              {error}
            </Text>
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
