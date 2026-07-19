/**
 * venueSelection — 공고 작성 시 "지점 선택 칩" 노출 조건 + 제출 시 venueId 적용(B5)
 *
 * create.tsx 전체를 마운트하지 않고 격리 검증할 수 있도록 노출 조건·제출 적용 로직을
 * 순수 함수로 분리한다. 계약-헤비 OrderSheetScreen(1008줄)은 건드리지 않는다.
 */
import type { CreateJobPostingInput } from '@/types/jobPosting';

/**
 * 지점 선택 칩 노출 여부.
 * - 지점(운영처)이 2개 이상이어야 "고를 것"이 있다.
 * - 그리드 "공고 열기"(라우트 venueId)로 진입했다면 이미 지점이 정해져 칩은 불필요.
 */
export function shouldShowVenueChips(
  venueCount: number,
  routeVenueId: string | undefined
): boolean {
  return venueCount >= 2 && !routeVenueId;
}

/**
 * 제출 input에 선택 지점을 적용한다.
 *
 * 대회(tournament)도 포함한다 — 근무표에서 대회 기간 인원/부족을 집계하기 위해
 * 대회도 venue_id 를 갖는다(2026-07-19 결정, 기존 "대회 = venue_id NULL 유지" 반전).
 * 칩 노출 조건(shouldShowVenueChips)이 postingType 을 보지 않으므로 대회 선택 시에도
 * 칩이 렌더된다 — 여기서 걸러내면 사용자 선택이 조용히 증발한다.
 * - 미선택(2개+인데 안 고름) → input 그대로 → B4가 다중 지점이라 미연결(venue_id 없음, 허용).
 */
export function applySelectedVenue(
  input: CreateJobPostingInput,
  selectedVenueId: string | undefined
): CreateJobPostingInput {
  if (selectedVenueId) {
    return { ...input, venueId: selectedVenueId };
  }
  return input;
}
