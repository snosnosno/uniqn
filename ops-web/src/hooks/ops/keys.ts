/**
 * ops 쿼리 키 — 모바일 `queryKeys.ops` 와 같은 모양(무효화 범위를 같게 추론할 수 있게).
 * 계정이 바뀌면 AuthProvider 가 캐시를 통째로 비우므로 키에 사용자 id 를 넣지 않는다.
 * 🔑 대회 단위 키는 모두 tournamentId 를 포함한다 — useResyncOnReturn 이 그걸로 한꺼번에 무효화한다.
 */
export const opsKeys = {
  all: ['ops'] as const,
  tournaments: () => [...opsKeys.all, 'tournaments'] as const,
  tournamentDetail: (id: string) => [...opsKeys.all, 'tournament', id] as const,
  forPosting: (postingId: string) => [...opsKeys.all, 'forPosting', postingId] as const,
  managedPostings: () => [...opsKeys.all, 'managedPostings'] as const,
  events: (id: string) => [...opsKeys.all, 'events', id] as const,
  staff: (id: string) => [...opsKeys.all, 'staff', id] as const,
  participants: (id: string) => [...opsKeys.all, 'participants', id] as const,
  clock: (id: string) => [...opsKeys.all, 'clock', id] as const,
  blindLevels: (id: string) => [...opsKeys.all, 'blindLevels', id] as const,
  liveStats: (id: string) => [...opsKeys.all, 'liveStats', id] as const,
  tables: (id: string) => [...opsKeys.all, 'tables', id] as const,
  seats: (id: string) => [...opsKeys.all, 'seats', id] as const,
  prizes: (id: string) => [...opsKeys.all, 'prizes', id] as const,
};
