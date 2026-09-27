/**
 * 비로그인(게스트) 둘러보기 범위.
 *
 * 게스트는 **구인구직 탭(공고 목록)만** 볼 수 있다. 공고 상세·다른 탭·지원은 로그인 유도
 * (웹은 앱 설치 유도)로 막는다 — 가입 전에 "여기 일이 있구나"를 보여 주는 것이 목적이다.
 *
 * 🔑 데이터 접근은 이 파일이 아니라 RLS 가 통제한다. `job_postings_select_all` 이 공개 상태
 *    공고를 anon 에게도 열어 두었고(2026-09-27 prod 실측), 목록이 부르는 RPC
 *    (`get_posting_filled_counts`·`get_regular_posting_date_counts`)도 anon 실행 가능하다.
 *    여기서 넓히는 것은 **라우트 가드**뿐이다.
 */

/** 게스트의 첫 화면 = 구인구직 탭 */
export const GUEST_HOME_ROUTE = '/(app)/(tabs)/home-jobs';

/**
 * 게스트가 머물러도 되는 라우트인가.
 *
 * `(tabs)` 그룹 루트(세그먼트 2개)는 `initialRouteName: 'home-jobs'` 로 해석되므로 함께 허용한다.
 * 그 밖의 `(app)` 라우트(공고 상세·스케줄·프로필 등)는 전부 로그인 대상이다.
 */
export function isGuestBrowsableRoute(segments: readonly string[]): boolean {
  if (segments[0] !== '(app)' || segments[1] !== '(tabs)') {
    return false;
  }

  return segments.length === 2 || (segments.length === 3 && segments[2] === 'home-jobs');
}
