/**
 * UNIQN Mobile - 공고 상세 레이아웃
 * 모든 공고 상세 하위 화면에 공고 제목 배너 표시
 *
 * @description 헤더 아래에 공고 제목을 표시하여 현재 어떤 공고를 보고 있는지 명확히 함
 * @version 1.0.0
 */

import { Stack, useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { View, Text, Pressable, useColorScheme } from 'react-native';
import { useJobDetail } from '@/hooks/useJobDetail';
import { ChevronLeftIcon } from '@/components/icons';

/**
 * 커스텀 뒤로가기 버튼
 */
function HeaderBackButton({ tintColor }: { tintColor: string }) {
  const router = useRouter();
  const navigation = useNavigation();

  const handleBack = () => {
    if (navigation.canGoBack()) {
      router.back();
    } else {
      router.replace('/(app)/(tabs)/employer');
    }
  };

  return (
    <Pressable onPress={handleBack} hitSlop={8} className="p-2 -ml-2">
      <ChevronLeftIcon size={24} color={tintColor} />
    </Pressable>
  );
}

/**
 * 공고 제목 배너 컴포넌트
 */
function PostingTitleBanner({ title }: { title?: string }) {
  return (
    <View className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <Text
        className="text-base font-semibold text-gray-900 dark:text-white"
        numberOfLines={1}
      >
        {title || '공고'}
      </Text>
    </View>
  );
}

export default function JobPostingDetailLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { job, isLoading } = useJobDetail(id || '');

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900">
      {/* 공고 제목 배너 (로딩 중에도 플레이스홀더 표시) */}
      <PostingTitleBanner title={isLoading ? '불러오는 중...' : job?.title} />

      {/* 하위 화면 렌더링 */}
      <View className="flex-1">
        <Stack
          screenOptions={{
            headerShown: true,
            headerStyle: {
              backgroundColor: isDark ? '#111827' : '#ffffff',
            },
            headerTintColor: isDark ? '#ffffff' : '#111827',
            headerTitleStyle: {
              fontWeight: '600',
            },
            animation: 'slide_from_right',
            contentStyle: {
              backgroundColor: isDark ? '#111827' : '#f9fafb',
            },
            headerLeft: () => <HeaderBackButton tintColor={isDark ? '#ffffff' : '#111827'} />,
          }}
        >
          <Stack.Screen
            name="index"
            options={{
              title: '공고 상세',
            }}
          />
          <Stack.Screen
            name="applicants"
            options={{
              title: '지원자 관리',
            }}
          />
          <Stack.Screen
            name="settlements"
            options={{
              title: '스태프 / 정산 관리',
            }}
          />
          <Stack.Screen
            name="edit"
            options={{
              title: '공고 수정',
            }}
          />
          <Stack.Screen
            name="cancellation-requests"
            options={{
              title: '취소 요청 관리',
            }}
          />
        </Stack>
      </View>
    </View>
  );
}
