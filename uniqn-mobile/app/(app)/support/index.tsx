import type { ReactNode } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Card, Divider } from '@/components/ui';
import {
  ChevronRightIcon,
  DocumentTextOutlineIcon,
  InformationCircleIcon,
  MessageIcon,
} from '@/components/icons';
import { STATUS } from '@/constants';
import { useMyInquiries } from '@/hooks/useInquiry';

interface MenuItemProps {
  icon: ReactNode;
  label: string;
  description?: string;
  onPress: () => void;
  badge?: number;
  testID: string;
}

function MenuItem({ icon, label, description, onPress, badge, testID }: MenuItemProps) {
  return (
    <Pressable
      onPress={onPress}
      accessible
      focusable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      className="active:opacity-70"
    >
      <View className="flex-row items-center justify-between py-4">
        <View className="flex-1 flex-row items-center">
          <View className="mr-4">{icon}</View>
          <View className="flex-1">
            <Text className="text-base font-medium text-gray-900 dark:text-gray-100">{label}</Text>
            {description ? (
              <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{description}</Text>
            ) : null}
          </View>
        </View>
        <View className="flex-row items-center">
          {badge !== undefined && badge > 0 ? (
            <View className="mr-2 min-w-[20px] items-center justify-center rounded-full bg-primary-500 px-2 py-0.5">
              <Text className="text-xs font-bold text-white">{badge}</Text>
            </View>
          ) : null}
          <ChevronRightIcon size={20} color="#9CA3AF" />
        </View>
      </View>
    </Pressable>
  );
}

export default function SupportScreen() {
  const { inquiries } = useMyInquiries({ enabled: true });

  const pendingCount = inquiries.filter(
    (inquiry) =>
      inquiry.status === STATUS.INQUIRY.OPEN || inquiry.status === STATUS.INQUIRY.IN_PROGRESS
  ).length;

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['bottom']}>
      <ScrollView className="flex-1" contentContainerClassName="p-4">
        <View className="mb-4 rounded-xl bg-primary-50 p-4 dark:bg-primary-900/20">
          <Text className="text-sm text-primary-700 dark:text-primary-300">
            궁금한 점이 있으신가요?
            {'\n'}
            자주 묻는 질문에서 빠르게 답을 찾거나,
            {'\n'}
            1:1 문의로 직접 도움을 요청할 수 있어요.
          </Text>
        </View>

        <Card>
          <MenuItem
            icon={<InformationCircleIcon size={24} color="#A855F7" />}
            label="자주 묻는 질문"
            description="FAQ에서 빠르게 답을 찾아보세요"
            onPress={() => router.push('/(app)/support/faq')}
            testID="support-menu-faq"
          />
          <Divider spacing="sm" />
          <MenuItem
            icon={<MessageIcon size={24} color="#10B981" />}
            label="1:1 문의하기"
            description="직접 문의를 남겨 주세요"
            onPress={() => router.push('/(app)/support/create-inquiry')}
            testID="support-menu-create-inquiry"
          />
          <Divider spacing="sm" />
          <MenuItem
            icon={<DocumentTextOutlineIcon size={24} color="#8B5CF6" />}
            label="문의 내역"
            description="내 문의와 답변을 확인하세요"
            onPress={() => router.push('/(app)/support/my-inquiries')}
            badge={pendingCount}
            testID="support-menu-my-inquiries"
          />
        </Card>

        <View className="mt-6 items-center">
          <Text className="text-sm text-gray-500 dark:text-gray-400">고객센터 운영시간</Text>
          <Text className="mt-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            평일 09:00 - 18:00 (주말/공휴일 휴무)
          </Text>
          <Text className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            문의 접수 후 영업일 기준 1-2일 내 답변드려요
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
