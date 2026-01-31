/**
 * UNIQN Mobile - 본인인증 정보 화면
 * 본인인증 상태 조회
 */

import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Card, Badge } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { ShieldCheckIcon } from '@/components/icons';

/**
 * 생년월일 포맷팅 (YYYYMMDD → YYYY.MM.DD)
 */
function formatBirthDate(birthDate?: string): string {
  if (!birthDate || birthDate.length !== 8) return '-';
  return `${birthDate.substring(0, 4)}.${birthDate.substring(4, 6)}.${birthDate.substring(6, 8)}`;
}

/**
 * 성별 표시 텍스트
 */
function getGenderText(gender?: 'male' | 'female'): string {
  if (gender === 'male') return '남성';
  if (gender === 'female') return '여성';
  return '-';
}

/**
 * 인증 제공자 표시 텍스트
 */
function getProviderText(provider?: 'pass' | 'kakao'): string {
  if (provider === 'pass') return 'PASS 본인인증';
  if (provider === 'kakao') return '카카오 본인인증';
  return '-';
}

interface InfoRowProps {
  label: string;
  value: string;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <View className="flex-row items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
      <Text className="text-sm text-gray-500 dark:text-gray-400">{label}</Text>
      <Text className="text-sm font-medium text-gray-900 dark:text-gray-100">{value}</Text>
    </View>
  );
}

export default function IdentityVerificationScreen() {
  const { profile } = useAuth();

  const isVerified = profile?.identityVerified === true;

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['bottom']}>
      <Stack.Screen options={{ title: '본인인증' }} />

      <ScrollView className="flex-1" contentContainerClassName="p-4">
        {/* 인증 상태 카드 */}
        <Card className="mb-4">
          <View className="items-center py-4">
            <View
              className={`w-16 h-16 rounded-full items-center justify-center mb-3 ${
                isVerified
                  ? 'bg-success-100 dark:bg-success-900/30'
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}
            >
              <ShieldCheckIcon
                size={32}
                color={isVerified ? '#22C55E' : '#9CA3AF'}
              />
            </View>
            <Badge variant={isVerified ? 'success' : 'secondary'}>
              {isVerified ? '인증 완료' : '미인증'}
            </Badge>
            <Text className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center">
              {isVerified
                ? '본인인증이 완료되었습니다.'
                : '본인인증을 완료하지 않았습니다.'}
            </Text>
          </View>
        </Card>

        {/* 인증 정보 */}
        {isVerified && (
          <Card className="mb-4">
            <Text className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
              인증 정보
            </Text>
            <InfoRow label="인증 방법" value={getProviderText(profile?.identityProvider)} />
            <InfoRow label="이름" value={profile?.verifiedName ?? '-'} />
            <InfoRow label="연락처" value={profile?.verifiedPhone ?? '-'} />
            <InfoRow label="생년월일" value={formatBirthDate(profile?.verifiedBirthDate)} />
            <View className="flex-row items-center justify-between py-3">
              <Text className="text-sm text-gray-500 dark:text-gray-400">성별</Text>
              <Text className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {getGenderText(profile?.verifiedGender)}
              </Text>
            </View>
          </Card>
        )}

        {/* 안내 문구 */}
        <Card>
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            본인인증 안내
          </Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400 leading-5">
            • 본인인증 정보는 회원가입 시 수집된 정보입니다.{'\n'}
            • 본인인증 정보는 수정할 수 없습니다.{'\n'}
            • 정보 변경이 필요한 경우 고객센터로 문의해주세요.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
