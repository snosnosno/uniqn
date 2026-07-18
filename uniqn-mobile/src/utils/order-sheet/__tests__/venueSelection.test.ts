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

describe('applySelectedVenue', () => {
  // 헬퍼는 input을 읽고 스프레드만 하므로 최소 형상으로 캐스팅해도 로직 검증에 충분하다.
  const baseInput = { title: '테스트 공고' } as CreateJobPostingInput;

  it('비대회 + 선택 지점이 있으면 input.venueId를 선택값으로 설정한다', () => {
    const result = applySelectedVenue(baseInput, 'venue-2', 'regular');
    expect(result.venueId).toBe('venue-2');
  });

  it('대회(tournament)면 선택 지점이 있어도 venueId를 설정하지 않는다(대회=NULL 유지 불변식)', () => {
    const result = applySelectedVenue(baseInput, 'venue-2', 'tournament');
    expect(result.venueId).toBeUndefined();
  });

  it('선택 지점이 없으면 input을 그대로 반환한다', () => {
    const result = applySelectedVenue(baseInput, undefined, 'regular');
    expect(result).toBe(baseInput);
    expect(result.venueId).toBeUndefined();
  });

  it('원본 input을 변형하지 않는다(불변)', () => {
    applySelectedVenue(baseInput, 'venue-2', 'regular');
    expect(baseInput.venueId).toBeUndefined();
  });
});
