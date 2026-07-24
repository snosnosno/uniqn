/**
 * UNIQN Mobile - 구인자 신청 상태 배너
 *
 * @description 심사 중인 신청이 있을 때 프로필 상단에 표시되는 배너
 * - pending 상태일 때만 렌더링
 */

import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { useEmployerApplication } from '@/hooks/auth/useEmployerApplication';

export function EmployerApplicationStatusBanner() {
  const { data: application, isLoading } = useEmployerApplication();

  if (isLoading || !application || application.status !== 'pending') {
    return null;
  }

  return (
    <Pressable
      onPress={() => router.push('/(app)/employer-application-status')}
      className="mx-4 mb-3 rounded-lg bg-warning-50 px-4 py-3 dark:bg-warning-900/20"
    >
      <Text className="text-sm font-sans-medium text-warning-700 dark:text-warning-300">
        구인자 신청 심사 중
      </Text>
      <Text className="mt-0.5 text-xs text-warning-600 dark:text-warning-400 font-sans">
        관리자 검토 후 알림이 발송됩니다. 탭하여 확인하세요.
      </Text>
    </Pressable>
  );
}
