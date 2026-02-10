/**
 * UNIQN Mobile - 회원가입 Step 2: 본인인증
 *
 * @description 포트원 V2 휴대폰 본인인증
 * @version 2.0.0
 */

import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Button } from '@/components/ui/Button';
import { IdentityVerification } from '@/components/auth/IdentityVerification';
import type { VerificationResult } from '@/components/auth/IdentityVerification';
import type { SignUpStep2Data } from '@/schemas';

// ============================================================================
// Types
// ============================================================================

interface SignupStep2Props {
  onNext: (data: SignUpStep2Data) => void;
  onBack: () => void;
  initialData?: Partial<SignUpStep2Data>;
  isLoading?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * 18세 이상 검증
 */
function validateAge(birthDate: string): boolean {
  const birthYear = parseInt(birthDate.substring(0, 4), 10);
  const currentYear = new Date().getFullYear();
  return currentYear - birthYear >= 18;
}

// ============================================================================
// Component
// ============================================================================

export function SignupStep2({ onNext, onBack, initialData, isLoading = false }: SignupStep2Props) {
  const [verifiedResult, setVerifiedResult] = useState<VerificationResult | null>(
    initialData?.identityVerified
      ? {
          name: initialData.verifiedName || '',
          phone: initialData.verifiedPhone || '',
          birthDate: initialData.verifiedBirthDate || '',
          gender: initialData.verifiedGender || 'male',
          provider: initialData.identityProvider || 'pass',
          verifiedAt: new Date(),
          identityVerificationId: initialData.identityVerificationId || '',
        }
      : null
  );
  const [error, setError] = useState<string | null>(null);

  const handleVerified = (result: VerificationResult) => {
    // 18세 미만 가입 차단
    if (result.birthDate && !validateAge(result.birthDate)) {
      setError('만 18세 이상만 가입 가능합니다.');
      return;
    }

    setError(null);
    setVerifiedResult(result);
  };

  const handleError = (err: Error) => {
    setError(err.message);
  };

  const handleNext = () => {
    if (!verifiedResult) {
      setError('본인인증이 필요합니다.');
      return;
    }

    onNext({
      identityVerified: true,
      identityProvider: verifiedResult.provider,
      verifiedName: verifiedResult.name,
      verifiedPhone: verifiedResult.phone,
      verifiedBirthDate: verifiedResult.birthDate,
      verifiedGender: verifiedResult.gender,
      identityVerificationId: verifiedResult.identityVerificationId,
    });
  };

  return (
    <View className="w-full flex-col gap-4">
      {/* 본인인증 컴포넌트 */}
      <IdentityVerification
        onVerified={handleVerified}
        onError={handleError}
        initialResult={verifiedResult}
        disabled={isLoading}
      />

      {/* 에러 메시지 (18세 미만 등) */}
      {error && (
        <View className="bg-error-50 dark:bg-error-900/30 rounded-lg p-3">
          <Text className="text-error-600 dark:text-error-400 text-sm text-center">{error}</Text>
        </View>
      )}

      {/* 버튼 영역 */}
      <View className="mt-6 flex-col gap-3">
        <Button onPress={handleNext} disabled={!verifiedResult || isLoading} fullWidth>
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
