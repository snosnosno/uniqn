/**
 * PostgREST `.or()` 필터 값에 넣을 사용자 검색어를 안전화한다.
 *
 * `,` `(` `)` 는 PostgREST 논리 트리 구분자라 그대로 두면 필터 인젝션·문법오류가 되고,
 * `%` 는 LIKE 와일드카드라 의도치 않은 광역 매칭을 유발한다(부분일치는 우리가 %..%로 감싼다).
 * `*` 는 PostgREST 가 ilike 값에서 `%` 로 치환하는 와일드카드 별칭이라, 남겨두면 리터럴 부분일치 보증이 깨진다.
 * `"` `\` 는 PostgREST 값 인용/이스케이프 문자라 파싱을 깨뜨릴 수 있다.
 * 위 문자를 모두 제거해 리터럴 부분일치만 남긴다. 남는 문자가 없으면 빈 문자열.
 */
export function sanitizeOrFilterTerm(raw: string): string {
  return raw.replace(/[%*(),"\\]/g, '').trim();
}

/** PostgREST 구분자·인용 문자와 ILIKE 와일드카드(`%` `_`, 별칭 `*`) — 서버 검색 조각의 경계. */
const SEARCH_TOKEN_BOUNDARY = /[%*_(),"\\]+/;

/**
 * 공고 검색어에서 서버 ilike 에 보낼 조각 하나를 고른다 — 특수문자를 경계로 나눈 조각 중 가장 긴 것.
 *
 * sanitizeOrFilterTerm 처럼 특수문자를 "지우면" `(주)포커` 가 `주포커` 로 붙어 `(주)포커엔터` 와
 * 연속 일치하지 않는다. 조각 하나로 넓게 후보를 받고, 원문 일치 판정은 호출자가 클라이언트에서 한다.
 */
export function pickServerSearchToken(raw: string): string {
  return raw
    .split(SEARCH_TOKEN_BOUNDARY)
    .map((token) => token.trim())
    .reduce((longest, token) => (token.length > longest.length ? token : longest), '');
}
