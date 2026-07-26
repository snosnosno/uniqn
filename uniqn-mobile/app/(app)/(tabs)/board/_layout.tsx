import { Stack } from 'expo-router';

export default function BoardLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      {/*
       * 상단 칩(홈/공지/일정/자유/TDA/대타)은 라우트 replace 로 전환된다.
       * 탭 성격의 전환이므로 화면 전환 애니메이션을 제거해 즉시 전환되게 한다.
       * 글 상세·작성·수정은 기본 push 애니메이션 유지.
       */}
      <Stack.Screen name="index" options={{ animation: 'none' }} />
      <Stack.Screen name="[boardType]" options={{ animation: 'none' }} />
    </Stack>
  );
}
