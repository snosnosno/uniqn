/**
 * UNIQN Mobile - Public Routes Layout
 * 인증 불필요 화면 레이아웃
 *
 * @version 1.0.0
 */

import { Stack } from 'expo-router';

export default function PublicLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  );
}
