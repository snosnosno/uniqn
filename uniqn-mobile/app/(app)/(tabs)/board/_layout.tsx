import { Stack } from 'expo-router';

export default function BoardLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* 일정/공지 전환은 탭 성격이므로 화면 전환 애니메이션을 제거한다. */}
      <Stack.Screen name="index" options={{ animation: 'none' }} />
      <Stack.Screen name="[boardType]" options={{ animation: 'none' }} />
    </Stack>
  );
}
