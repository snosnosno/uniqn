/**
 * 허브 재개 카드 선택 (순수, S1 A2 — 규칙 D8 확정).
 *
 * 우선순위: active 최신(updatedAt) 1건 > 당일(KST) upcoming 최신(createdAt) 1건 > null(카드 미노출).
 * "당일" 판정은 KST(UTC+9) 고정 — 기기 로컬 TZ 비의존(UTC epoch 산술만 사용).
 * ⚠️ KST 00~09시 = UTC 전날 15~24시: toISOString 직접 사용 시 날짜가 하루 밀리는 알려진 플레이크
 *   → +9h 시프트 후 UTC 렌즈로 자르는 방식으로 고정(테스트가 이 구간을 고정 시계로 커버).
 */
import type { OpsTournament } from '@/types/ops';

/** KST(UTC+9) 기준 날짜 문자열(YYYY-MM-DD). */
export function kstDateString(nowMs: number): string {
  return new Date(nowMs + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export function selectResumeTournament(
  tournaments: readonly OpsTournament[],
  nowMs: number
): OpsTournament | null {
  const actives = tournaments.filter((t) => t.status === 'active');
  if (actives.length > 0) {
    return (
      [...actives].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0] ?? null
    );
  }
  const today = kstDateString(nowMs);
  const todaysUpcoming = tournaments.filter(
    (t) => t.status === 'upcoming' && t.eventDate === today
  );
  if (todaysUpcoming.length > 0) {
    return (
      [...todaysUpcoming].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ??
      null
    );
  }
  return null;
}
