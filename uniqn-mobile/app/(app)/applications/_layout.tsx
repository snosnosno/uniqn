/**
 * UNIQN Mobile - Applications Layout
 * 지원 관련 화면 레이아웃
 *
 * @version 1.0.0
 */

import { Stack } from 'expo-router';

export default function ApplicationsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  );
}
