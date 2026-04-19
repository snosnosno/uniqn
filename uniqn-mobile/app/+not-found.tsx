/**
 * UNIQN Mobile - Not Found Screen
 * 404 페이지
 */

import { View, Text } from 'react-native';
import { Link, Stack } from 'expo-router';
import { Button } from '@/components/ui';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: '페이지를 찾을 수 없습니다' }} />
      <View className="flex-1 items-center justify-center bg-surface-page dark:bg-surface px-6">
        <Text className="mb-2 text-6xl font-sans-bold text-secondary-300 dark:text-secondary-700">
          404
        </Text>
        <Text className="mb-2 text-xl font-display-semibold text-content-primary dark:text-secondary-100">
          페이지를 찾을 수 없습니다
        </Text>
        <Text className="mb-8 text-center text-secondary-500 dark:text-secondary-400 font-sans">
          요청하신 페이지가 존재하지 않거나{'\n'}이동되었을 수 있습니다
        </Text>
        <Link href="/" asChild>
          <Button>홈으로 돌아가기</Button>
        </Link>
      </View>
    </>
  );
}
