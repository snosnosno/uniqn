/**
 * 공고 공유 출처 (S3-5).
 *
 * 공유 링크에 `?src=` 로 실려 나가고, 열렸을 때 같은 값이 `analytics_events.props.src` 에 남는다.
 * 두 이벤트(job_share_created / job_share_opened)의 비(比)가 "이 경로의 공유가 실제로
 * 사람을 데려오는가"에 답한다.
 *
 * 🔑 **화이트리스트여야 하는 이유**
 *   자유 문자열을 URL 에 싣고 그대로 계측에 넣으면 두 가지가 동시에 망가진다:
 *     ① 집계 카디널리티가 터진다(오타·실험값이 영구히 쌓인다).
 *     ② 외부에서 조작한 값이 그대로 서버 기록에 들어간다 — `src` 는 URL 에 노출돼 있어
 *        누구나 바꿔 넣을 수 있다. 받는 쪽에서 화이트리스트로 거르지 않으면 계측이 오염된다.
 *   그래서 만들 때도, 읽을 때도 이 목록으로 검증한다.
 *
 * ⚠️ `useBulkShare` 의 `BulkShareSource('employer'|'admin')` 와 개념이 겹치지만 **다른 축**이다.
 *    그쪽은 "묶음 공유를 시작한 화면 권한", 이쪽은 "링크가 태어난 표면"이다. 값을 섞지 말 것.
 */

/** 링크에 붙는 쿼리 키. 받는 쪽(`useLocalSearchParams`)도 이 키로 읽는다. */
export const SHARE_SOURCE_QUERY_KEY = 'src';

export const SHARE_SOURCES = {
  /** 구인자 공고 상세의 공유 버튼 */
  employerDetail: 'employer_detail',
  /** 구인자 공고 목록 카드의 공유 버튼 */
  employerList: 'employer_list',
  /** 구직자 앱 내 공고 상세 */
  seekerDetail: 'seeker_detail',
  /** 로그인 없이 열리는 공개 공고 페이지 */
  publicDetail: 'public_detail',
  /** 사장이 띄운 지원 QR 을 찍고 들어온 경우 (S3-5) */
  applyQr: 'apply_qr',
} as const;

export type ShareSource = (typeof SHARE_SOURCES)[keyof typeof SHARE_SOURCES];

const SHARE_SOURCE_VALUES: readonly string[] = Object.values(SHARE_SOURCES);

/** URL 에서 읽은 값을 신뢰하기 전에 통과시킨다. 모르는 값은 계측에 넣지 않는다. */
export function isShareSource(value: unknown): value is ShareSource {
  return typeof value === 'string' && SHARE_SOURCE_VALUES.includes(value);
}

/**
 * `useLocalSearchParams` 결과에서 출처를 뽑는다.
 * expo-router 는 같은 키가 여러 번 오면 배열을 준다 — 첫 값만 본다.
 */
export function readShareSource(raw: string | string[] | undefined): ShareSource | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return isShareSource(value) ? value : undefined;
}
