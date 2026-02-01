/**
 * UNIQN Mobile - 회원가입 Step 2: 본인인증
 *
 * @description PASS 또는 카카오 본인인증
 * @version 1.0.0
 */

import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Button } from '@/components/ui/Button';
import type { SignUpStep2Data } from '@/schemas';

// ============================================================================
// Types
// ============================================================================

type IdentityProvider = 'pass' | 'kakao';

interface SignupStep2Props {
  onNext: (data: SignUpStep2Data) => void;
  onBack: () => void;
  initialData?: Partial<SignUpStep2Data>;
  isLoading?: boolean;
}

interface VerificationResult {
  name: string;
  phone: string;
  birthDate: string; // YYYYMMDD 형식
  gender: 'male' | 'female';
  provider: IdentityProvider;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * 생년월일에서 출생년도 추출
 */
function extractBirthYear(birthDate: string): number {
  return parseInt(birthDate.substring(0, 4), 10);
}

/**
 * 18세 이상 검증
 */
function validateAge(birthDate: string): boolean {
  const birthYear = extractBirthYear(birthDate);
  const currentYear = new Date().getFullYear();
  return currentYear - birthYear >= 18;
}

/**
 * 생년월일 포맷팅 (YYYYMMDD → YYYY.MM.DD)
 */
function formatBirthDate(birthDate: string): string {
  if (birthDate.length !== 8) return birthDate;
  return `${birthDate.substring(0, 4)}.${birthDate.substring(4, 6)}.${birthDate.substring(6, 8)}`;
}

// ============================================================================
// Component
// ============================================================================

export function SignupStep2({ onNext, onBack, initialData, isLoading = false }: SignupStep2Props) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedData, setVerifiedData] = useState<VerificationResult | null>(
    initialData?.identityVerified
      ? {
          name: initialData.verifiedName || '',
          phone: initialData.verifiedPhone || '',
          birthDate: initialData.verifiedBirthDate || '',
          gender: initialData.verifiedGender || 'male',
          provider: initialData.identityProvider || 'pass',
        }
      : null
  );
  const [error, setError] = useState<string | null>(null);

  const handleVerification = async (provider: IdentityProvider) => {
    setIsVerifying(true);
    setError(null);

    try {
      // 현재: 모의 인증 (개발용)
      // 실제 연동 시: PASS 또는 카카오 본인인증 SDK 구현 필요
      // @see IdentityVerification.tsx

      // 임시: 모의 본인인증 결과 (개발용)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // 실제 구현 시 SDK 콜백에서 받은 데이터 사용
      const mockResult: VerificationResult = {
        name: '홍길동',
        phone: '010-1234-5678',
        birthDate: '19900101', // 본인인증에서 받은 생년월일
        gender: 'male', // 본인인증에서 받은 성별
        provider,
      };

      // 18세 미만 가입 차단
      if (!validateAge(mockResult.birthDate)) {
        setError('만 18세 이상만 가입 가능합니다.');
        return;
      }

      setVerifiedData(mockResult);
    } catch {
      setError('본인인증에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleNext = () => {
    if (!verifiedData) {
      setError('본인인증이 필요합니다.');
      return;
    }

    onNext({
      identityVerified: true,
      identityProvider: verifiedData.provider,
      verifiedName: verifiedData.name,
      verifiedPhone: verifiedData.phone,
      verifiedBirthDate: verifiedData.birthDate,
      verifiedGender: verifiedData.gender,
    });
  };

  const handleResetVerification = () => {
    setVerifiedData(null);
    setError(null);
  };

  return (
    <View className="w-full flex-col gap-4">
      {/* 안내 문구 */}
      <View className="mb-4">
        <Text className="text-sm text-gray-600 dark:text-gray-400 text-center">
          안전한 서비스 이용을 위해{'\n'}
          본인인증이 필요합니다.
        </Text>
      </View>

      {/* 본인인증 완료 상태 */}
      {verifiedData ? (
        <View className="bg-success-50 dark:bg-success-900/30 rounded-lg p-4">
          <View className="flex-row items-center mb-3">
            <View className="w-8 h-8 rounded-full bg-success-500 items-center justify-center mr-3">
              <Text className="text-white font-bold">✓</Text>
            </View>
            <Text className="text-success-700 dark:text-success-400 font-semibold">
              본인인증 완료
            </Text>
          </View>

          <View className="flex-col gap-2 ml-11">
            <View className="flex-row">
              <Text className="text-gray-500 dark:text-gray-400 w-16">이름</Text>
              <Text className="text-gray-900 dark:text-white font-medium">{verifiedData.name}</Text>
            </View>
            <View className="flex-row">
              <Text className="text-gray-500 dark:text-gray-400 w-16">휴대폰</Text>
              <Text className="text-gray-900 dark:text-white font-medium">
                {verifiedData.phone}
              </Text>
            </View>
            <View className="flex-row">
              <Text className="text-gray-500 dark:text-gray-400 w-16">생년월일</Text>
              <Text className="text-gray-900 dark:text-white font-medium">
                {formatBirthDate(verifiedData.birthDate)}
              </Text>
            </View>
            <View className="flex-row">
              <Text className="text-gray-500 dark:text-gray-400 w-16">성별</Text>
              <Text className="text-gray-900 dark:text-white font-medium">
                {verifiedData.gender === 'male' ? '남성' : '여성'}
              </Text>
            </View>
            <View className="flex-row">
              <Text className="text-gray-500 dark:text-gray-400 w-16">인증</Text>
              <Text className="text-gray-900 dark:text-white font-medium">
                {verifiedData.provider === 'pass' ? 'PASS 본인인증' : '카카오 본인인증'}
              </Text>
            </View>
          </View>

          <Pressable onPress={handleResetVerification} className="mt-4 ml-11">
            <Text className="text-sm text-gray-500 dark:text-gray-400 underline">
              다시 인증하기
            </Text>
          </Pressable>
        </View>
      ) : (
        /* 본인인증 버튼 */
        <View className="flex-col gap-3">
          {/* PASS 본인인증 */}
          <Pressable
            onPress={() => handleVerification('pass')}
            disabled={isVerifying || isLoading}
            className={`
              flex-row items-center justify-center
              py-4 px-4 rounded-lg
              bg-[#1B1464]
              ${isVerifying || isLoading ? 'opacity-50' : ''}
            `}
          >
            {isVerifying ? (
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
            disabled={isVerifying || isLoading}
            className={`
              flex-row items-center justify-center
              py-4 px-4 rounded-lg
              bg-[#FEE500]
              ${isVerifying || isLoading ? 'opacity-50' : ''}
            `}
          >
            {isVerifying ? (
              <ActivityIndicator color="#191919" size="small" />
            ) : (
              <>
                <Text className="text-[#191919] font-bold mr-2">💬</Text>
                <Text className="text-[#191919] font-medium">카카오 본인인증</Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      {/* 에러 메시지 */}
      {error && (
        <View className="bg-error-50 dark:bg-error-900/30 rounded-lg p-3">
          <Text className="text-error-600 dark:text-error-400 text-sm text-center">{error}</Text>
        </View>
      )}

      {/* 버튼 영역 */}
      <View className="mt-6 flex-col gap-3">
        <Button onPress={handleNext} disabled={!verifiedData || isLoading} fullWidth>
          다음
        </Button>

        <Button onPress={onBack} variant="ghost" disabled={isLoading} fullWidth>
          이전
        </Button>
      </View>
    </View>
  );
}

export default SignupStep2;
