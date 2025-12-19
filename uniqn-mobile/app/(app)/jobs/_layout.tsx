/**
 * UNIQN Mobile - Jobs Layout (Authenticated)
 * 인증 필요한 구인 관련 화면 레이아웃
 *
 * @version 1.0.0
 */

import { Stack } from 'expo-router';

export default function JobsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  );
}
