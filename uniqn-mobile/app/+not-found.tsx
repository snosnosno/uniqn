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
      <View className="flex-1 items-center justify-center bg-gray-50 px-6 dark:bg-surface-dark">
        <Text className="mb-2 text-6xl font-bold text-gray-300 dark:text-gray-700">404</Text>
        <Text className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
          페이지를 찾을 수 없습니다
        </Text>
        <Text className="mb-8 text-center text-gray-500 dark:text-gray-400">
          요청하신 페이지가 존재하지 않거나{'\n'}이동되었을 수 있습니다
        </Text>
        <Link href="/" asChild>
          <Button>홈으로 돌아가기</Button>
        </Link>
      </View>
    </>
  );
}
