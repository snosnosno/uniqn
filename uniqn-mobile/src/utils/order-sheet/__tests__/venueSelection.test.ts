/**
 * venueSelection — 지점 선택 칩 노출 조건 + 제출 시 venueId 적용 헬퍼 단위 테스트(B5)
 *
 * create.tsx 전체 마운트(OrderSheetScreen 1008줄, react-hook-form)를 피하고
 * 노출 조건·제출 적용 로직을 순수 함수로 분리해 격리 검증한다.
 */
import { shouldShowVenueChips, applySelectedVenue } from '../venueSelection';
import type { CreateJobPostingInput } from '@/types/jobPosting';

describe('shouldShowVenueChips', () => {
  it('지점이 2개 이상이고 라우트 venueId가 없으면 노출한다', () => {
    expect(shouldShowVenueChips(2, undefined)).toBe(true);
  });

  it('지점이 1개면 노출하지 않는다', () => {
    expect(shouldShowVenueChips(1, undefined)).toBe(false);
  });

  it('지점이 0개면 노출하지 않는다', () => {
    expect(shouldShowVenueChips(0, undefined)).toBe(false);
  });

  it('그리드 진입(라우트 venueId 존재)이면 지점이 많아도 노출하지 않는다', () => {
    expect(shouldShowVenueChips(3, 'venue-1')).toBe(false);
  });
});

/**
 * 대회 전용 케이스가 없는 이유: postingType 파라미터를 제거해 헬퍼가 공고 종류를
 * 구분할 수단 자체를 없앴다. 여기서는 같은 인자로 두 번 호출하는 동어반복 테스트를
 * 두지 않는다.
 *
 * ⚠️ 다만 인자 축소는 인자 **개수**만 고정할 뿐 어떤 **값**이 흐르는지는 고정하지 못한다.
 * 호출부를 `applySelectedVenue(input, values.postingType === 'tournament' ? undefined :
 * selectedVenueId)` 로 되돌려도 인자는 2개 그대로라 tsc 도 이 파일도 전부 녹색이다.
 * B4(jobManagementService.venueAutolink)도 지점 0/1개 자동연결만 덮어 "지점 2개+ · 사용자
 * 칩 선택" 분기는 커버하지 않는다(같은 파일이 "지점 2개 이상 → 자동 연결하지 않는다"로 못박음).
 *
 * 대회 경로의 값 흐름(대회 + 지점 2개+ + 칩 선택 → venue_id)을 실제로 고정하는 것은
 * `app/(employer)/my-postings/__tests__/CreateJobPostingScreen.test.tsx` 의
 * "대회 지점칩 선택의 값 흐름(B5)" 스위트다 — 제출 경로에서 createJobPosting 이 받은
 * input.venueId 를 직접 검증한다.
 */
describe('applySelectedVenue', () => {
  // 헬퍼는 input을 읽고 스프레드만 하므로 최소 형상으로 캐스팅해도 로직 검증에 충분하다.
  const baseInput = { title: '테스트 공고' } as CreateJobPostingInput;

  it('선택 지점이 있으면 공고 종류와 무관하게 input.venueId를 선택값으로 설정한다', () => {
    const result = applySelectedVenue(baseInput, 'venue-2');
    expect(result.venueId).toBe('venue-2');
  });

  it('선택 지점이 없으면 input을 그대로 반환한다', () => {
    const result = applySelectedVenue(baseInput, undefined);
    expect(result).toBe(baseInput);
    expect(result.venueId).toBeUndefined();
  });

  it('원본 input을 변형하지 않는다(불변)', () => {
    applySelectedVenue(baseInput, 'venue-2');
    expect(baseInput.venueId).toBeUndefined();
  });
});
