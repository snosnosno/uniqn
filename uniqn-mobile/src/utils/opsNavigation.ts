/**
 * ops(라이브 운영) 화면의 뒤로가기 안전망 — 구인자 맥락 보존 (S3-7).
 *
 * @description 사장이 공고 상세의 "라이브 운영" 카드로 ops 스택에 들어오면, 그 화면들의
 *   `fallbackHref` 는 ops 목록(또는 홈)을 가리킨다. 스택이 살아 있을 때는 문제가 없지만
 *   **콜드 진입·딥링크·웹 직접 URL** 처럼 되돌아갈 히스토리가 없으면 사장은 자기가 관리하던
 *   공고가 아니라 낯선 ops 목록에 떨어진다 — 다시 공고를 찾아 들어가야 한다.
 *
 * @remarks `HeaderBackButton` 은 `navigation.canGoBack()` 이 true 면 이 값을 **무시하고**
 *   `router.back()` 을 쓴다. 즉 이 헬퍼가 실제로 쓰이는 건 히스토리가 없는 진입뿐이고,
 *   그게 정확히 맥락을 잃는 경우다. 평상시 동작은 바뀌지 않는다.
 */
export function opsFallbackHref(
  jobPostingId: string | null | undefined,
  defaultHref: string
): string {
  return jobPostingId ? `/(employer)/my-postings/${jobPostingId}` : defaultHref;
}
