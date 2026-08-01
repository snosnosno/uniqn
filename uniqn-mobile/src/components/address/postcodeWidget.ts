/**
 * UNIQN Mobile - 다음(카카오) 우편번호 위젯 공용 상수
 *
 * @description 스크립트 URL·임베드 옵션처럼 웹/네이티브 두 구현이 반드시 같아야 하는 값만 둔다.
 *
 * ⚠️ 웹에서 이 스크립트를 로드하려면 `public/_headers` CSP 가 열려 있어야 한다:
 * `script-src` 에 `https://t1.daumcdn.net`, `frame-src` 에 `https://postcode.map.kakao.com`.
 * 위젯이 만드는 iframe 오리진은 공식 문서에 나오는 `daum.net` 이 아니라 **kakao.com** 이다
 * (postcode.v2.js 실물에서 확인). CSP 위반은 에러 없이 **빈 화면**이라 정적 검사로 안 잡힌다.
 */

/** 벤더 스크립트. API 키·도메인 등록 불필요(공식 가이드: 상업적 사용 포함 무료·무제한) */
export const POSTCODE_SCRIPT_SRC =
  'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';

/** 위젯이 iframe 을 붙이는 오리진 — CSP `frame-src` 에 등록해야 하는 값 */
export const POSTCODE_FRAME_ORIGIN = 'https://postcode.map.kakao.com';

/**
 * 임베드 옵션.
 * - `autoClose: false` — 선택 직후 위젯이 스스로 컨테이너를 걷어내면 언마운트 순서가 꼬인다.
 *   닫기는 호출부(모드 전환)가 한다.
 * - `submitMode: false` — 검색 입력에서 엔터가 페이지 폼 제출로 새지 않게 한다.
 */
export const POSTCODE_EMBED_OPTIONS = { autoClose: false } as const;
export const POSTCODE_WIDGET_OPTIONS = {
  width: '100%',
  height: '100%',
  submitMode: false,
} as const;
