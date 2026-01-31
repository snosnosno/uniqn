/**
 * UNIQN Mobile - 동의 정보 관리 화면
 * 약관 동의 상태 조회 및 마케팅 수신 동의 변경
 */

import { useState } from 'react';
import { View, Text, ScrollView, Switch, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Card, Badge } from '@/components/ui';
import { ChevronRightIcon } from '@/components/icons';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { updateMarketingConsent } from '@/services/authService';
import { logger } from '@/utils/logger';

interface ConsentRowProps {
  label: string;
  description: string;
  value: boolean;
  editable?: boolean;
  onValueChange?: (value: boolean) => void;
  isLoading?: boolean;
  onViewTerms?: () => void;
}

function ConsentRow({
  label,
  description,
  value,
  editable = false,
  onValueChange,
  isLoading = false,
  onViewTerms,
}: ConsentRowProps) {
  return (
    <View className="py-3 border-b border-gray-100 dark:border-gray-700">
      <View className="flex-row items-center justify-between mb-1">
        <View className="flex-row items-center flex-1">
          <Text className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</Text>
          {!editable && (
            <Badge variant="secondary" className="ml-2">
              필수
            </Badge>
          )}
        </View>
        {editable ? (
          <Switch
            value={value}
            onValueChange={onValueChange}
            disabled={isLoading}
            trackColor={{ false: '#D1D5DB', true: '#22C55E' }}
            thumbColor="#FFFFFF"
          />
        ) : (
          <Badge variant={value ? 'success' : 'secondary'}>
            {value ? '동의함' : '미동의'}
          </Badge>
        )}
      </View>
      <Text className="text-xs text-gray-500 dark:text-gray-400 pr-12">{description}</Text>
      {onViewTerms && (
        <Pressable onPress={onViewTerms} className="flex-row items-center mt-2">
          <Text className="text-xs text-primary-600 dark:text-primary-400">약관 보기</Text>
          <ChevronRightIcon size={14} color="#3B82F6" />
        </Pressable>
      )}
    </View>
  );
}

export default function ConsentManagementScreen() {
  const { profile, user } = useAuth();
  const setProfile = useAuthStore((state) => state.setProfile);
  const addToast = useToastStore((state) => state.addToast);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleMarketingConsentChange = async (value: boolean) => {
    if (!user?.uid || !profile) return;

    setIsUpdating(true);
    try {
      await updateMarketingConsent(user.uid, value);

      // 로컬 상태 업데이트
      setProfile({
        ...profile,
        marketingAgreed: value,
        updatedAt: new Date(),
      });

      addToast({
        type: 'success',
        message: value ? '마케팅 수신에 동의했습니다.' : '마케팅 수신 동의를 철회했습니다.',
      });
    } catch (error) {
      logger.error('마케팅 동의 업데이트 실패', error as Error);
      addToast({
        type: 'error',
        message: '동의 상태 변경에 실패했습니다.',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleViewTerms = () => {
    // TODO: 실제 이용약관 URL로 변경
    Linking.openURL('https://example.com/terms');
  };

  const handleViewPrivacy = () => {
    // TODO: 실제 개인정보처리방침 URL로 변경
    Linking.openURL('https://example.com/privacy');
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['bottom']}>
      <Stack.Screen options={{ title: '동의 정보 관리' }} />

      <ScrollView className="flex-1" contentContainerClassName="p-4">
        {/* 필수 동의 항목 */}
        <Card className="mb-4">
          <Text className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
            필수 동의 항목
          </Text>
          <ConsentRow
            label="이용약관"
            description="서비스 이용에 필요한 기본 약관입니다."
            value={profile?.termsAgreed ?? false}
            onViewTerms={handleViewTerms}
          />
          <View className="py-3">
            <View className="flex-row items-center justify-between mb-1">
              <View className="flex-row items-center">
                <Text className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  개인정보처리방침
                </Text>
                <Badge variant="secondary" className="ml-2">
                  필수
                </Badge>
              </View>
              <Badge variant={profile?.privacyAgreed ? 'success' : 'secondary'}>
                {profile?.privacyAgreed ? '동의함' : '미동의'}
              </Badge>
            </View>
            <Text className="text-xs text-gray-500 dark:text-gray-400 pr-12">
              개인정보 수집 및 이용에 관한 안내입니다.
            </Text>
            <Pressable onPress={handleViewPrivacy} className="flex-row items-center mt-2">
              <Text className="text-xs text-primary-600 dark:text-primary-400">약관 보기</Text>
              <ChevronRightIcon size={14} color="#3B82F6" />
            </Pressable>
          </View>
        </Card>

        {/* 선택 동의 항목 */}
        <Card className="mb-4">
          <Text className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
            선택 동의 항목
          </Text>
          <View className="py-3">
            <View className="flex-row items-center justify-between mb-1">
              <View className="flex-row items-center flex-1">
                <Text className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  마케팅 정보 수신
                </Text>
                <Badge variant="primary" className="ml-2">
                  선택
                </Badge>
              </View>
              <Switch
                value={profile?.marketingAgreed ?? false}
                onValueChange={handleMarketingConsentChange}
                disabled={isUpdating}
                trackColor={{ false: '#D1D5DB', true: '#22C55E' }}
                thumbColor="#FFFFFF"
              />
            </View>
            <Text className="text-xs text-gray-500 dark:text-gray-400 pr-12">
              이벤트, 혜택 등 마케팅 정보를 받아보실 수 있습니다.
            </Text>
          </View>
        </Card>

        {/* 안내 문구 */}
        <Card>
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            동의 정보 안내
          </Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400 leading-5">
            • 필수 동의 항목은 서비스 이용에 반드시 필요합니다.{'\n'}
            • 선택 동의 항목은 언제든지 변경할 수 있습니다.{'\n'}
            • 필수 동의 철회를 원하시면 회원 탈퇴를 진행해주세요.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
