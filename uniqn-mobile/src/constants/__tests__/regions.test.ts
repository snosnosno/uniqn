/**
 * UNIQN Mobile - regions 상수/헬퍼 테스트
 */

import {
  REGIONS,
  REGIONS_BY_GROUP,
  REGION_GROUPS,
  getRegionLabel,
  isRegionSlug,
  findRegionByAddress,
} from '../regions';

describe('REGIONS 분류', () => {
  it('서울 25개 구를 포함한다', () => {
    const seoul = REGIONS.filter((r) => r.group === '서울');
    expect(seoul).toHaveLength(25);
    expect(seoul.some((r) => r.label === '강남구')).toBe(true);
    expect(seoul.some((r) => r.label === '중랑구')).toBe(true);
  });

  it('7개 광역시를 단일 항목으로 포함한다', () => {
    const metro = REGIONS.filter((r) => r.group === '광역시');
    expect(metro).toHaveLength(7);
    expect(metro.map((r) => r.slug)).toEqual(
      expect.arrayContaining(['부산', '대구', '인천', '광주', '대전', '울산', '세종'])
    );
  });

  it('경기 주요시를 포함한다', () => {
    const gyeonggi = REGIONS.filter((r) => r.group === '경기');
    expect(gyeonggi.some((r) => r.label === '수원시')).toBe(true);
    expect(gyeonggi.some((r) => r.label === '성남시')).toBe(true);
  });

  it('제주(제주시·서귀포시)를 포함한다', () => {
    const jeju = REGIONS.filter((r) => r.group === '제주');
    expect(jeju.map((r) => r.label)).toEqual(['제주시', '서귀포시']);
  });

  it('기타 그룹에 기타 지역과 해외를 포함한다', () => {
    const etc = REGIONS.filter((r) => r.group === '기타');
    expect(etc.map((r) => r.slug)).toEqual(['기타', '해외']);
  });

  it('slug 는 전역에서 고유하다', () => {
    const slugs = REGIONS.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('REGIONS_BY_GROUP 가 REGION_GROUPS 순서대로 그룹핑한다', () => {
    const flattened = REGION_GROUPS.flatMap((g) => REGIONS_BY_GROUP[g]);
    expect(flattened).toHaveLength(REGIONS.length);
  });
});

describe('getRegionLabel / isRegionSlug', () => {
  it('알려진 slug 의 라벨을 반환한다', () => {
    expect(getRegionLabel('서울 강남구')).toBe('강남구');
    expect(getRegionLabel('부산')).toBe('부산광역시');
    expect(getRegionLabel('제주 제주시')).toBe('제주시');
    expect(getRegionLabel('해외')).toBe('해외');
  });

  it('알 수 없는 slug 는 undefined 를 반환한다', () => {
    expect(getRegionLabel('존재하지않음')).toBeUndefined();
    expect(isRegionSlug('서울 강남구')).toBe(true);
    expect(isRegionSlug('존재하지않음')).toBe(false);
  });
});

describe('findRegionByAddress (자동 제안)', () => {
  it('서울 주소에서 구를 추출한다', () => {
    expect(findRegionByAddress('서울특별시 강남구 역삼동 123-45')?.slug).toBe('서울 강남구');
    expect(findRegionByAddress('서울 마포구 합정동')?.slug).toBe('서울 마포구');
  });

  it('광역시 주소를 단일 광역시로 매칭한다', () => {
    expect(findRegionByAddress('부산광역시 해운대구 우동')?.slug).toBe('부산');
    expect(findRegionByAddress('대전 서구 둔산동')?.slug).toBe('대전');
  });

  it('경기 도시를 광역시 광주와 혼동하지 않는다', () => {
    expect(findRegionByAddress('경기도 광주시 역동')?.slug).toBe('경기 광주시');
    expect(findRegionByAddress('광주광역시 서구 치평동')?.slug).toBe('광주');
  });

  it('경기 주요시를 추출한다', () => {
    expect(findRegionByAddress('경기도 성남시 분당구 정자동')?.slug).toBe('경기 성남시');
  });

  it('제주 주소에서 시를 추출한다', () => {
    expect(findRegionByAddress('제주특별자치도 제주시 노형동')?.slug).toBe('제주 제주시');
    expect(findRegionByAddress('제주 서귀포시 중문동')?.slug).toBe('제주 서귀포시');
  });

  it('해외는 자동 매칭하지 않는다(수동 선택 전용)', () => {
    expect(findRegionByAddress('Las Vegas, Nevada, USA')).toBeUndefined();
  });

  it('도/시 접두 없는 구 이름은 서울 구로 폴백한다', () => {
    expect(findRegionByAddress('강남구 역삼동')?.slug).toBe('서울 강남구');
  });

  it('부산 강서구는 서울 강서구로 오인하지 않는다', () => {
    expect(findRegionByAddress('부산 강서구 명지동')?.slug).toBe('부산');
  });

  it('매칭 불가/빈 입력은 undefined 를 반환한다', () => {
    expect(findRegionByAddress('')).toBeUndefined();
    expect(findRegionByAddress('알 수 없는 행성 어딘가')).toBeUndefined();
    expect(findRegionByAddress(undefined)).toBeUndefined();
  });
});
