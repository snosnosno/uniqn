import React from 'react';
import { View, Text } from 'react-native';
import { Button } from '@/components/ui/Button';

export interface PortOneIdentityVerificationProps {
  onVerified: () => void;
  onError?: (error: Error) => void;
  initialIdentity?: unknown;
  disabled?: boolean;
  customerId?: string;
  customerFullName?: string;
  customerPhoneNumber?: string;
}

export function PortOneIdentityVerification({
  disabled = false,
}: PortOneIdentityVerificationProps) {
  return (
    <View className="rounded-md border border-secondary-200 bg-secondary-50 p-4 dark:border-surface-overlay dark:bg-surface-elevated">
      <Text className="mb-2 font-semibold text-secondary-900 dark:text-off-white">
        이니시스 본인인증
      </Text>
      <Text className="mb-4 text-sm leading-5 text-secondary-600 dark:text-secondary-300">
        웹 환경에서는 아직 이니시스 본인인증 SDK를 연결하지 않았습니다. 현재는 모바일 앱에서만
        사용할 수 있습니다.
      </Text>
      <Button disabled variant="outline" fullWidth>
        모바일 앱에서 이용 가능
      </Button>
      {!disabled && (
        <Text className="mt-3 text-xs text-secondary-500 dark:text-secondary-400">
          웹에서는 기존 문자 인증 fallback이 유지됩니다.
        </Text>
      )}
    </View>
  );
}

export default PortOneIdentityVerification;
