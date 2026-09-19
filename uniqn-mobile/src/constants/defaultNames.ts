/**
 * defaultNames — 자동 생성되는 팀·지점 기본 이름의 단일 소스(SSOT).
 *
 * 왜 상수 파일까지 만드나: 실측 결과 기본명이 **5곳에서 제각각**이었다.
 *   ① hooks/workspace/useEnsureDefaultWorkspace  '내 팀'
 *   ② services/workspace/workspaceService        '내 팀'
 *   ③ app/(employer)/workspace/index.tsx         `${displayName} 팀`
 *   ④ DB handle_new_user 트리거                   `${이름|이메일로컬} 팀`  ← 아래 참조, 의도적 예외
 *   ⑤ services/jobs/jobManagementService         '기본 지점'
 * 그리고 지점은 `useEnsureDefaultVenue` 가 **워크스페이스 이름을 그대로 복사**해서,
 * 팀도 '내 팀' 지점도 '내 팀' 인 사용자가 만들어졌다. 팀과 지점은 다른 축인데 같은 이름이면
 * 화면에서 어느 쪽을 고르는 건지 알 수 없다.
 *
 * ⚠️ ④ 는 SSOT 밖에 남아 있지만 **결함이 아니라 의도적 예외다**(2026-08-01 prod 실측으로 정정).
 *   이 주석은 원래 "트리거가 여전히 `${닉네임} 워크스페이스` 를 만든다"고 적고 있었으나 그건
 *   stale 이었다. 실제 최신 정의(`20260719233000_team_terminology_unification.sql`)는
 *   `${raw_user_meta_data.name | 이메일로컬파트 | '내'} 팀` 을 만들고, 같은 마이그가
 *   `' 워크스페이스$' → ' 팀'` 소급 UPDATE 까지 이미 끝냈다. prod 에 `~워크스페이스` 는 0건이다.
 *   가입 시점엔 이름을 알 수 있으므로 `'홍길동 팀'` 이 `'내 팀'` 보다 낫다 — 협업자 목록에서
 *   팀이 구분된다. 그래서 트리거는 그대로 두기로 했다(3-D 결정). 두 경로가 갈라져 보이지만
 *   ④ 는 "이름을 아는 경로", 아래 상수는 "이름을 모르는 경로" 의 폴백이라 역할이 다르다.
 *
 * ⚠️ 지점 소급 rename(3-D)은 2026-08-01 에 완료됐다 —
 *   `20260801100000_rename_default_venue_containers.sql`. 대상 판별은 이 파일의 문자열이 아니라
 *   "title = 소속 워크스페이스 이름" + 레거시 기본값 목록이었다. 즉 `DEFAULT_WORKSPACE_NAME`
 *   은 더 이상 마이그의 판별 기준이 아니므로 그 이유로 고정할 필요는 없어졌다.
 */

/** 워크스페이스(팀) 기본 이름. 이름을 모르는 경로(클라 폴백)에서만 쓰인다 — ④ 트리거 참조. */
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
