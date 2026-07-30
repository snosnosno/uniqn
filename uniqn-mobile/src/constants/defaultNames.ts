/**
 * defaultNames — 자동 생성되는 팀·지점 기본 이름의 단일 소스(SSOT).
 *
 * 왜 상수 파일까지 만드나: 실측 결과 기본명이 **5곳에서 제각각**이었다.
 *   ① hooks/workspace/useEnsureDefaultWorkspace  '내 팀'
 *   ② services/workspace/workspaceService        '내 팀'
 *   ③ app/(employer)/workspace/index.tsx         `${displayName} 팀`
 *   ④ DB handle_new_user 트리거                   `${닉네임} 워크스페이스`  ← 마이그 필요, 여기 범위 밖
 *   ⑤ services/jobs/jobManagementService         '기본 지점'
 * 그리고 지점은 `useEnsureDefaultVenue` 가 **워크스페이스 이름을 그대로 복사**해서,
 * 팀도 '내 팀' 지점도 '내 팀' 인 사용자가 만들어졌다. 팀과 지점은 다른 축인데 같은 이름이면
 * 화면에서 어느 쪽을 고르는 건지 알 수 없다.
 *
 * ⚠️ 워크스페이스 기본명을 '내 팀' 고정으로 되돌린 것은 취향이 아니다 — 후속 일괄 rename
 *   마이그(3-D)가 "사용자가 손대지 않은 기본값만" 대상으로 삼는데, 그 판별 기준이 이 문자열이다.
 *   클라가 계속 '내 팀' 을 만들어야 대상 판별이 성립한다.
 * ⚠️ ④ DB 트리거는 여전히 `${닉네임} 워크스페이스` 를 만든다. 신규 가입자의 실제 기본
 *   워크스페이스명은 그쪽이므로, 유입을 끊으려면 3-D 에 트리거 수정이 포함돼야 한다.
 */

/** 워크스페이스(팀) 기본 이름. 3-D 일괄 rename 의 대상 판별 기준이므로 바꾸지 말 것. */
export const DEFAULT_WORKSPACE_NAME = '내 팀';

/** 닉네임을 모를 때 쓰는 지점 기본 이름. */
export const FALLBACK_VENUE_NAME = '내 지점';

/**
 * 지점(운영처 컨테이너) 기본 이름. 워크스페이스 이름을 복사하지 않는다 — 팀과 지점이
 * 같은 이름이 되는 것이 혼란의 원인이었다.
 * 서버 컨텍스트 등 닉네임을 모르는 경로는 인자 없이 호출해 폴백을 받는다.
 */
export function defaultVenueName(displayName?: string | null): string {
  const trimmed = displayName?.trim();
  return trimmed ? `${trimmed}의 지점` : FALLBACK_VENUE_NAME;
}
