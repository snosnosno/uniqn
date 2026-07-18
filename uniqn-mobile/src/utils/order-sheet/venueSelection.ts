/**
 * venueSelection — 공고 작성 시 "지점 선택 칩" 노출 조건 + 제출 시 venueId 적용(B5)
 *
 * create.tsx 전체를 마운트하지 않고 격리 검증할 수 있도록 노출 조건·제출 적용 로직을
 * 순수 함수로 분리한다. 계약-헤비 OrderSheetScreen(1008줄)은 건드리지 않는다.
 */
import type { CreateJobPostingInput } from '@/types/jobPosting';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';

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
 * ⚠️ 대회(tournament) 가드 필수: B4 auto-link 서비스는 venueId가 이미 세팅되면 자동 연결만
 *    건너뛸 뿐 명시 venueId를 벗기지 않는다. 대회에 venueId를 세팅하면 job_postings.venue_id가
 *    써져 "대회 = venue_id NULL 유지" 불변식을 위반한다. 따라서 제출 단계에서 대회를 제외한다.
 * - 미선택(2개+인데 안 고름) → input 그대로 → B4가 다중 지점이라 미연결(venue_id 없음, 허용).
 */
export function applySelectedVenue(
  input: CreateJobPostingInput,
  selectedVenueId: string | undefined,
  postingType: OrderSheetValues['postingType']
): CreateJobPostingInput {
  if (selectedVenueId && postingType !== 'tournament') {
    return { ...input, venueId: selectedVenueId };
  }
  return input;
}
