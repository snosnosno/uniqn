/**
 * UNIQN Mobile - regions 상수/헬퍼 테스트
 *
 * 핵심 계약: 기존 67 slug 불변(prod DB location->>region 저장값) + 전국 3단계 택소노미(도>시>구).
 */

import {
  REGIONS,
  REGIONS_BY_GROUP,
  REGION_GROUPS,
  type RegionGroup,
  getRegionLabel,
  isRegionSlug,
  findRegionByAddress,
} from '../regions';

/**
 * 개편 전부터 존재하던 67개 slug — prod DB 에 저장돼 있어 한 글자도 바뀌면 안 된다.
 * 이 배열은 slug 불변 계약의 기계 가드(스냅샷).
 */
const LEGACY_67_SLUGS: readonly string[] = [
  // 서울 25
  '서울 강남구',
  '서울 강동구',
  '서울 강북구',
  '서울 강서구',
  '서울 관악구',
  '서울 광진구',
  '서울 구로구',
  '서울 금천구',
  '서울 노원구',
  '서울 도봉구',
  '서울 동대문구',
  '서울 동작구',
  '서울 마포구',
  '서울 서대문구',
  '서울 서초구',
  '서울 성동구',
  '서울 성북구',
  '서울 송파구',
  '서울 양천구',
  '서울 영등포구',
  '서울 용산구',
  '서울 은평구',
  '서울 종로구',
  '서울 중구',
  '서울 중랑구',
  // 경기 31 (시·군)
  '경기 수원시',
  '경기 성남시',
  '경기 고양시',
  '경기 용인시',
  '경기 부천시',
  '경기 안산시',
  '경기 안양시',
  '경기 남양주시',
  '경기 화성시',
  '경기 평택시',
  '경기 의정부시',
  '경기 시흥시',
  '경기 파주시',
  '경기 김포시',
  '경기 광명시',
  '경기 광주시',
  '경기 군포시',
  '경기 하남시',
  '경기 오산시',
  '경기 양주시',
  '경기 이천시',
  '경기 구리시',
  '경기 안성시',
  '경기 포천시',
  '경기 의왕시',
  '경기 여주시',
  '경기 동두천시',
  '경기 과천시',
  '경기 가평군',
  '경기 양평군',
  '경기 연천군',
  // 광역시 7 (시 단위)
  '부산',
  '대구',
  '인천',
  '광주',
  '대전',
  '울산',
  '세종',
  // 제주 2
  '제주 제주시',
  '제주 서귀포시',
  // 기타 2
  '기타',
  '해외',
];

/** §8-2 검산표 — 그룹별 slug 개수(시-레벨 + children) */
const GROUP_COUNTS: Record<RegionGroup, number> = {
  서울: 25,
  경기: 55,
  인천: 12,
  강원: 18,
  충청: 39,
  전라: 44,
  경상: 80,
  제주: 2,
  기타: 2,
};

/** subGroup 을 전 항목에 부여해야 하는 혼합 그룹(하나라도 빠지면 시트 렌더에서 증발) */
const MIXED_GROUPS: readonly RegionGroup[] = ['경기', '충청', '전라', '경상'];
/** subGroup 이 없어야 하는 flat 그룹 */
const FLAT_GROUPS: readonly RegionGroup[] = ['서울', '인천', '강원', '제주', '기타'];

describe('slug 불변 계약', () => {
  it('기존 67개 slug 가 전부 실존한다', () => {
    expect(LEGACY_67_SLUGS).toHaveLength(67);
    for (const slug of LEGACY_67_SLUGS) {
      expect(isRegionSlug(slug)).toBe(true);
    }
  });

  it('slug 는 한글+단일 공백만 사용한다 (or= 쿼리 조립·인용 안전성 계약 — 리뷰 M1)', () => {
    // repository applyRegionScope 가 slug 를 "…" 인용, 접두를 like 에 비인용 삽입하는 전제:
    // 따옴표·쉼표·괄호·와일드카드(*, %, _)가 slug 에 절대 없어야 한다.
    for (const region of REGIONS) {
      expect(region.slug).toMatch(/^[가-힣]+( [가-힣]+)*$/);
    }
  });

  it('slug 는 전역에서 고유하다', () => {
    const slugs = REGIONS.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe('그룹 구성 (전국 9권역)', () => {
  it('REGION_GROUPS 는 8권역+기타 9개이며 광역시 그룹이 없다', () => {
    expect(REGION_GROUPS).toEqual([
      '서울',
      '경기',
      '인천',
      '강원',
      '충청',
      '전라',
      '경상',
      '제주',
      '기타',
    ]);
    expect(REGION_GROUPS).not.toContain('광역시');
  });

  it('그룹별 slug 개수가 §8-2 검산표와 일치하고 총합은 277이다', () => {
    let total = 0;
    for (const group of REGION_GROUPS) {
      const count = REGIONS.filter((r) => r.group === group).length;
      expect(count).toBe(GROUP_COUNTS[group]);
      total += count;
    }
    expect(total).toBe(277);
    expect(REGIONS).toHaveLength(277);
  });

  it('서울 25개 구를 flat 으로 포함한다', () => {
    const seoul = REGIONS.filter((r) => r.group === '서울');
    expect(seoul).toHaveLength(25);
    expect(seoul.some((r) => r.label === '강남구')).toBe(true);
    expect(seoul.some((r) => r.label === '중랑구')).toBe(true);
  });

  it('인천은 시 단위 1개 + 신구명 구·군 11개(제물포/영종/서해/검단 포함)', () => {
    const incheon = REGIONS.filter((r) => r.group === '인천');
    expect(incheon).toHaveLength(12);
    expect(isRegionSlug('인천 제물포구')).toBe(true);
    expect(isRegionSlug('인천 영종구')).toBe(true);
    expect(isRegionSlug('인천 서해구')).toBe(true);
    expect(isRegionSlug('인천 검단구')).toBe(true);
  });

  it('대구는 군위군을 children 으로 포함하고 경북에는 군위군이 없다', () => {
    expect(isRegionSlug('대구 군위군')).toBe(true);
    const gyeongbuk = REGIONS.filter((r) => r.group === '경상' && r.slug.startsWith('경북 '));
    expect(gyeongbuk.some((r) => r.label === '군위군')).toBe(false);
  });

  it('화성시는 동탄·병점·만세·효행 4구를 children 으로 포함한다', () => {
    for (const gu of ['동탄구', '병점구', '만세구', '효행구']) {
      expect(isRegionSlug(`경기 화성시 ${gu}`)).toBe(true);
    }
  });

  it('제주(제주시·서귀포시)를 순서대로 포함한다', () => {
    const jeju = REGIONS.filter((r) => r.group === '제주');
    expect(jeju.map((r) => r.label)).toEqual(['제주시', '서귀포시']);
  });

  it('기타 그룹에 기타/해외를 포함한다', () => {
    const etc = REGIONS.filter((r) => r.group === '기타');
    expect(etc.map((r) => r.slug)).toEqual(['기타', '해외']);
  });

  it('REGIONS_BY_GROUP 가 REGION_GROUPS 순서대로 REGIONS 를 남김없이 그룹핑한다', () => {
    const flattened = REGION_GROUPS.flatMap((g) => REGIONS_BY_GROUP[g]);
    expect(flattened).toHaveLength(REGIONS.length);
    expect(flattened.map((r) => r.slug)).toEqual(REGIONS.map((r) => r.slug));
  });
});

describe('parentSlug 무결성 (구 → 시)', () => {
  it('모든 parentSlug 는 실존 slug 이고 같은 그룹의 시-레벨(부모 parentSlug 없음)을 가리킨다', () => {
    const bySlug = new Map(REGIONS.map((r) => [r.slug, r]));
    const children = REGIONS.filter((r) => r.parentSlug !== undefined);
    expect(children.length).toBeGreaterThan(0);
    for (const child of children) {
      const parent = bySlug.get(child.parentSlug!);
      expect(parent).toBeDefined();
      expect(parent!.group).toBe(child.group);
      // 부모는 시·군 레벨이어야 한다(3레벨 초과 금지)
      expect(parent!.parentSlug).toBeUndefined();
    }
  });

  it('구 slug 는 "부모시 slug + 공백 + 구명" 규칙을 따른다', () => {
    const child = REGIONS.find((r) => r.slug === '경기 수원시 장안구');
    expect(child?.parentSlug).toBe('경기 수원시');
    expect(child?.label).toBe('장안구');
    expect(child?.keyword).toBe('장안구');
    const busanGu = REGIONS.find((r) => r.slug === '부산 해운대구');
    expect(busanGu?.parentSlug).toBe('부산');
    const cheongjuGu = REGIONS.find((r) => r.slug === '충북 청주시 상당구');
    expect(cheongjuGu?.parentSlug).toBe('충북 청주시');
  });
});

describe('subGroup 계약', () => {
  it('혼합 그룹은 전 항목(children 포함)에 subGroup 을 보유한다', () => {
    for (const group of MIXED_GROUPS) {
      const opts = REGIONS.filter((r) => r.group === group);
      expect(opts.length).toBeGreaterThan(0);
      expect(opts.every((r) => !!r.subGroup)).toBe(true);
    }
  });

  it('flat 그룹은 subGroup 을 갖지 않는다', () => {
    for (const group of FLAT_GROUPS) {
      const opts = REGIONS.filter((r) => r.group === group);
      expect(opts.every((r) => r.subGroup === undefined)).toBe(true);
    }
  });

  it('혼합 그룹 subGroup 값이 설계 소섹션과 일치한다', () => {
    const subGroupsOf = (group: RegionGroup) =>
      new Set(REGIONS.filter((r) => r.group === group).map((r) => r.subGroup));
    expect(subGroupsOf('충청')).toEqual(new Set(['대전·세종', '충북', '충남']));
    expect(subGroupsOf('전라')).toEqual(new Set(['광주', '전북', '전남']));
    expect(subGroupsOf('경상')).toEqual(new Set(['부산·대구·울산', '경북', '경남']));
    expect(subGroupsOf('경기')).toEqual(new Set(['남부', '북부']));
  });
});

describe('getRegionLabel / isRegionSlug (광역시 라벨 축약)', () => {
  it('알려진 slug 의 라벨을 반환한다', () => {
    expect(getRegionLabel('서울 강남구')).toBe('강남구');
    expect(getRegionLabel('제주 제주시')).toBe('제주시');
    expect(getRegionLabel('해외')).toBe('해외');
  });

  it('광역시 라벨은 축약형(광역시/특별자치시 접미 제거)이다', () => {
    expect(getRegionLabel('부산')).toBe('부산');
    expect(getRegionLabel('대구')).toBe('대구');
    expect(getRegionLabel('인천')).toBe('인천');
    expect(getRegionLabel('광주')).toBe('광주');
    expect(getRegionLabel('대전')).toBe('대전');
    expect(getRegionLabel('울산')).toBe('울산');
    expect(getRegionLabel('세종')).toBe('세종');
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

  it('광역시 주소는 구까지 하강 매칭한다', () => {
    expect(findRegionByAddress('부산광역시 해운대구 우동')?.slug).toBe('부산 해운대구');
    expect(findRegionByAddress('대전 서구 둔산동')?.slug).toBe('대전 서구');
  });

  it('광역시 keyword 만 있고 구가 없으면 광역시 slug 로 폴백한다', () => {
    expect(findRegionByAddress('광주광역시 치평동')?.slug).toBe('광주');
    expect(findRegionByAddress('부산광역시')?.slug).toBe('부산');
  });

  it('경기 광주시와 광주광역시를 혼동하지 않는다', () => {
    expect(findRegionByAddress('경기도 광주시 역동')?.slug).toBe('경기 광주시');
    expect(findRegionByAddress('광주광역시 서구 치평동')?.slug).toBe('광주 서구');
  });

  it('경기 주소는 일반구까지 하강 매칭한다', () => {
    expect(findRegionByAddress('경기도 성남시 분당구 정자동')?.slug).toBe('경기 성남시 분당구');
  });

  it('구 이름이 부분문자열이어도 더 긴 구를 우선한다(부산 강서구 vs 서구/서울 강서구)', () => {
    expect(findRegionByAddress('부산 강서구 명지동')?.slug).toBe('부산 강서구');
  });

  it('도명 명시 주소는 해당 도로 한정해 시·구를 추출한다', () => {
    expect(findRegionByAddress('강원특별자치도 원주시')?.slug).toBe('강원 원주시');
    expect(findRegionByAddress('충청북도 청주시 서원구')?.slug).toBe('충북 청주시 서원구');
    expect(findRegionByAddress('경남 고성군')?.slug).toBe('경남 고성군');
  });

  it('도명 없는 동명 군은 매칭하지 않는다(강원 vs 경남 고성군)', () => {
    expect(findRegionByAddress('고성군')).toBeUndefined();
  });

  it('광역시 branch 가 도명 branch 보다 먼저다(전남광주통합특별시 광산구 → 광주 광산구)', () => {
    expect(findRegionByAddress('전남광주통합특별시 광산구')?.slug).toBe('광주 광산구');
  });

  it('통합시 주소의 전남 시·군은 광주로 오매칭하지 않고 도명 branch 로 폴스루한다(리뷰 M2)', () => {
    expect(findRegionByAddress('전남광주통합특별시 목포시')?.slug).toBe('전남 목포시');
    expect(findRegionByAddress('전남광주통합특별시 신안군')?.slug).toBe('전남 신안군');
    // 도명 없는 광역시 단독 표기는 기존대로 시 폴백 유지
    expect(findRegionByAddress('광주광역시 치평동')?.slug).toBe('광주');
  });

  it('제주 주소에서 시를 추출한다(서귀포 우선)', () => {
    expect(findRegionByAddress('제주특별자치도 제주시 노형동')?.slug).toBe('제주 제주시');
    expect(findRegionByAddress('제주 서귀포시 중문동')?.slug).toBe('제주 서귀포시');
  });

  it('해외는 자동 매칭하지 않는다(수동 선택 전용)', () => {
    expect(findRegionByAddress('Las Vegas, Nevada, USA')).toBeUndefined();
  });

  it('도/시 접두 없는 구 이름은 서울 구로 폴백한다', () => {
    expect(findRegionByAddress('강남구 역삼동')?.slug).toBe('서울 강남구');
  });

  it('매칭 불가/빈 입력은 undefined 를 반환한다', () => {
    expect(findRegionByAddress('')).toBeUndefined();
    expect(findRegionByAddress('알 수 없는 행성 어딘가')).toBeUndefined();
    expect(findRegionByAddress(undefined)).toBeUndefined();
  });
});
