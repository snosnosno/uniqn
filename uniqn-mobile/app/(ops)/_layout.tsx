/**
 * 라이브 운영(ops) 라우트 그룹 레이아웃.
 * 게이트: authenticated 만 (역할 체크 없음 — 데이터 접근은 RLS 가 owner/workspace 로 통제).
 *
 * ─────────────────────────────────────────────────────────────────────
 * 🔒 결함⑥ 결정(2026-08-08): **`ops_hub_enabled` 게이트를 여기 걸지 않는다.**
 *
 * "플래그 OFF 인데 딥링크로 아무 로그인 사용자나 들어온다"는 관찰은 사실이지만, 결함이 아니다.
 * 플래그는 **발견 표면**(discovery) 게이트다 — 프로필 메뉴(`app/(app)/(tabs)/profile.tsx`),
 * 스케줄 빈상태 크로스링크(`schedule.tsx`), 1회성 안내 카드(`OpsHubIntroCard`)가 그것을 읽는다.
 * 라우트 접근은 권한이 아니다:
 *   1. 데이터 경계는 RLS 다 — 들어와도 `is_ops_member`(owner OR 워크스페이스 멤버 OR admin)가
 *      아닌 대회는 **한 행도 보이지 않고**, 만들 수 있는 것은 자기 대회뿐이다.
 *      즉 진입 자체로 얻는 것이 없다(권한 상승 아님).
 *   2. 게이트를 걸면 실질 손해가 생긴다. 플래그는 `app_config` **원격값**이라, 롤아웃 중
 *      잠깐 OFF 로 되돌리는 순간 **진행 중인 라이브 대회 운영이 화면째로 끊긴다.**
 *      라이브 운영 화면에 원격 킬스위치를 두는 건 위험 교환이 나쁘다.
 *   3. 플래그 ON 직전 QA·스토어 심사 리뷰어·이미 링크를 받은 운영자의 딥링크 진입이 막힌다.
 *
 * 공개뷰(전광판·플레이어뷰)는 `app/(public)/monitor` 로 이 그룹 밖에 있어 영향이 없다.
 * 기술 근거: `wiki/architecture/ops-engine.md` — "`(ops)` 라우트 자체는 플래그 무관하게
 * 접근 가능 — 발견 표면만 게이트". 이 주석과 `__tests__/OpsLayout.test.tsx` 가 계약이다.
 * ─────────────────────────────────────────────────────────────────────
 */
import { Stack, Redirect } from 'expo-router';
import { useAuthStore, selectProfile } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Loading } from '@/components/ui';
import { getLayoutColor } from '@/constants/colors';

function OpsStack() {
  const isDark = useThemeStore((s) => s.isDarkMode);
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        statusBarStyle: 'auto',
        statusBarBackgroundColor: 'transparent',
        contentStyle: {
          backgroundColor: getLayoutColor(isDark, 'content'),
        },
      }}
    />
  );
}

export default function OpsLayout() {
  const { isLoading, isAuthenticated } = useAuthStore();
  const profile = useAuthStore(selectProfile);

  // 로딩 또는 hydration 타이밍 방어
  if (isLoading || (isAuthenticated && !profile)) {
    return <Loading variant="layout" />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return <OpsStack />;
}
