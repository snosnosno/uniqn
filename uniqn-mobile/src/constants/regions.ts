/**
 * UNIQN Mobile - 지역(region) 분류 상수
 *
 * @description 공고 작성 시 선택하는 정규화된 지역 코드. 자유텍스트 주소(location.address)
 * 와 별개로 location.region 에 stable slug 를 저장해 지역 필터(eq)에 사용한다.
 *
 * 범위: 서울 25개 구(개별) + 7개 광역시(시 단위) + 경기 주요시 + 제주 + 기타/해외.
 * 추후 확장은 이 상수에 항목 추가만으로 무손실 가능(slug 는 변경 금지).
 */

export type RegionGroup = '서울' | '경기' | '광역시' | '제주' | '기타';

export interface RegionOption {
  /** 저장/필터에 사용하는 stable id (변경 금지) */
  slug: string;
  /** 표시 라벨 */
  label: string;
  /** UI 그룹 */
  group: RegionGroup;
  /** 주소 텍스트 매칭용 키워드 (구/시 이름) */
  keyword: string;
}

export const REGION_GROUPS: readonly RegionGroup[] = ['서울', '경기', '광역시', '제주', '기타'];

const SEOUL_GU = [
  '강남구',
  '강동구',
  '강북구',
  '강서구',
  '관악구',
  '광진구',
  '구로구',
  '금천구',
  '노원구',
  '도봉구',
  '동대문구',
  '동작구',
  '마포구',
  '서대문구',
  '서초구',
  '성동구',
  '성북구',
  '송파구',
  '양천구',
  '영등포구',
  '용산구',
  '은평구',
  '종로구',
  '중구',
  '중랑구',
] as const;

const GYEONGGI_SI = [
  '수원시',
  '성남시',
  '고양시',
  '용인시',
  '부천시',
  '안산시',
  '안양시',
  '남양주시',
  '화성시',
  '평택시',
  '의정부시',
  '시흥시',
  '파주시',
  '김포시',
  '광명시',
  '광주시',
  '군포시',
  '하남시',
  '오산시',
  '양주시',
  '이천시',
  '구리시',
  '안성시',
  '포천시',
  '의왕시',
  '여주시',
  '동두천시',
  '과천시',
  '가평군',
  '양평군',
  '연천군',
] as const;

const METRO: readonly { slug: string; label: string; keyword: string }[] = [
  { slug: '부산', label: '부산광역시', keyword: '부산' },
  { slug: '대구', label: '대구광역시', keyword: '대구' },
  { slug: '인천', label: '인천광역시', keyword: '인천' },
  { slug: '광주', label: '광주광역시', keyword: '광주' },
  { slug: '대전', label: '대전광역시', keyword: '대전' },
  { slug: '울산', label: '울산광역시', keyword: '울산' },
  { slug: '세종', label: '세종특별자치시', keyword: '세종' },
];

// 제주특별자치도 — 시 단위(서귀포시 우선 매칭으로 제주시 substring 충돌 방지)
const JEJU_SI = ['제주시', '서귀포시'] as const;

const SEOUL_REGIONS: RegionOption[] = SEOUL_GU.map((gu) => ({
  slug: `서울 ${gu}`,
  label: gu,
  group: '서울',
  keyword: gu,
}));

const GYEONGGI_REGIONS: RegionOption[] = GYEONGGI_SI.map((si) => ({
  slug: `경기 ${si}`,
  label: si,
  group: '경기',
  keyword: si,
}));

const METRO_REGIONS: RegionOption[] = METRO.map((m) => ({
  slug: m.slug,
  label: m.label,
  group: '광역시',
  keyword: m.keyword,
}));

const JEJU_REGIONS: RegionOption[] = JEJU_SI.map((si) => ({
  slug: `제주 ${si}`,
  label: si,
  group: '제주',
  keyword: si,
}));

const ETC_REGION: RegionOption = {
  slug: '기타',
  label: '기타 지역',
  group: '기타',
  keyword: '',
};

// 해외 — 자동 매칭 대상 아님(keyword 빈 문자열, find 스캔에서 제외). 수동 선택 전용.
const OVERSEAS_REGION: RegionOption = {
  slug: '해외',
  label: '해외',
  group: '기타',
  keyword: '',
};

export const REGIONS: readonly RegionOption[] = [
  ...SEOUL_REGIONS,
  ...GYEONGGI_REGIONS,
  ...METRO_REGIONS,
  ...JEJU_REGIONS,
  ETC_REGION,
  OVERSEAS_REGION,
];

export const REGIONS_BY_GROUP: Record<RegionGroup, RegionOption[]> = {
  서울: SEOUL_REGIONS,
  경기: GYEONGGI_REGIONS,
  광역시: METRO_REGIONS,
  제주: JEJU_REGIONS,
  기타: [ETC_REGION, OVERSEAS_REGION],
};

const REGION_BY_SLUG: ReadonlyMap<string, RegionOption> = new Map(REGIONS.map((r) => [r.slug, r]));

export function isRegionSlug(slug: string | null | undefined): boolean {
  return !!slug && REGION_BY_SLUG.has(slug);
}

export function getRegionLabel(slug: string | null | undefined): string | undefined {
  if (!slug) return undefined;
  return REGION_BY_SLUG.get(slug)?.label;
}

/**
 * 자유텍스트 주소에서 가장 적합한 지역을 best-effort 로 추출한다.
 *
 * @description 작성 폼에서 주소 입력 시 지역 드롭다운 자동 선택용. 결과는 사용자가
 * 수정 가능하므로 정확도보다 충돌 회피(경기 광주 vs 광주광역시, 부산 강서구 vs 서울 강서구)에
 * 무게를 둔다. 매칭 실패 시 undefined → 사용자가 직접 선택.
 */
export function findRegionByAddress(address: string | null | undefined): RegionOption | undefined {
  const text = (address ?? '').trim();
  if (!text) return undefined;

  // 1) 경기 우선 — '경기' 명시 시 경기 도시로 한정(광역시 광주와 혼동 방지)
  if (text.includes('경기')) {
    return GYEONGGI_REGIONS.find((r) => text.includes(r.keyword));
  }

  // 2) 광역시 — 시 단위 명시 매칭
  const metro = METRO_REGIONS.find((r) => text.includes(r.keyword));
  if (metro) return metro;

  // 2-1) 제주 — 서귀포시 먼저(제주시 substring 충돌 방지)
  if (text.includes('서귀포')) {
    return JEJU_REGIONS.find((r) => r.keyword === '서귀포시');
  }
  if (text.includes('제주')) {
    return JEJU_REGIONS.find((r) => r.keyword === '제주시');
  }

  // 3) 서울 — '서울' 명시 시 구 매칭
  if (text.includes('서울')) {
    return SEOUL_REGIONS.find((r) => text.includes(r.keyword));
  }

  // 4) 폴백 — 도/시 접두 없는 구 이름은 서울 구로 가정(target market = 수도권 집중)
  return SEOUL_REGIONS.find((r) => text.includes(r.keyword));
}
