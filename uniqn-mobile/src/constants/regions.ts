/**
 * UNIQN Mobile - 지역(region) 분류 상수 — 전국 3단계(도>시>구) 택소노미
 *
 * @description 공고 작성 시 선택하는 정규화된 지역 코드. 자유텍스트 주소(location.address)
 * 와 별개로 location.region 에 stable slug 를 저장해 지역 필터(eq/in)에 사용한다.
 *
 * 레벨: ①광역/도 그룹 → ②시·군(또는 광역시 단위) → ③구(일부 시). 구 항목은 parentSlug 로
 * 소속 시를 가리킨다("해운대구"→"부산"). 시 slug 는 필터에서 "시 전체"(시+소속 구) 의미로
 * 오버로드되므로 별도 토큰 타입이 없다(regionSelection 참고).
 *
 * 불변 계약:
 * - 기존 67개 slug 문자열은 절대 변경 금지(prod DB 저장값). 신규 slug 추가만 무손실 확장.
 * - slug 명명: 도 시·군 = `{도약칭} {시군}`, 광역시 구 = `{광역시} {구}`, 일반구 = `{시 slug} {구}`.
 * - 광역시 label 은 축약("부산광역시"→"부산"). slug·keyword 는 불변.
 *
 * 데이터 단일 소스: docs/planning/2026-07-14-region-taxonomy-3level-design.md §8 (2026-07 실측 조사).
 */

export type RegionGroup =
  | '서울'
  | '경기'
  | '인천'
  | '강원'
  | '충청'
  | '전라'
  | '경상'
  | '제주'
  | '기타';

export interface RegionOption {
  /** 저장/필터에 사용하는 stable id (변경 금지) */
  slug: string;
  /** 표시 라벨. 광역시는 축약("부산") */
  label: string;
  /** UI 그룹 */
  group: RegionGroup;
  /** 주소 텍스트 매칭용 키워드 (구/시 이름) */
  keyword: string;
  /** 그룹 내 소구분 (경기 남부/북부, 혼합 권역의 시·도 구분 — 우측 패널 소섹션) */
  subGroup?: string;
  /** 구(3레벨) 전용 — 소속 시 slug. 시·군 레벨 항목에는 없다 */
  parentSlug?: string;
}

export const REGION_GROUPS: readonly RegionGroup[] = [
  '서울',
  '경기',
  '인천',
  '강원',
  '충청',
  '전라',
  '경상',
  '제주',
  '기타',
];

// ---------------------------------------------------------------------------
// 빌더 — 스펙(이름 목록 + children 맵)을 RegionOption[] 로 flatten. 모두 불변(map/spread).
// ---------------------------------------------------------------------------

/** 단일 RegionOption 생성 — keyword 는 항상 label 과 동일(광역시 포함), 선택 필드는 조건부 스프레드 */
function makeOption(
  slug: string,
  label: string,
  group: RegionGroup,
  subGroup: string | undefined,
  parentSlug: string | undefined
): RegionOption {
  return {
    slug,
    label,
    group,
    keyword: label,
    ...(subGroup !== undefined ? { subGroup } : {}),
    ...(parentSlug !== undefined ? { parentSlug } : {}),
  };
}

/** 시(또는 광역시) 1개 + 소속 구를 flatten. 구 slug = `{시 slug} {구}`, parentSlug = 시 slug */
function flattenCity(
  slug: string,
  label: string,
  group: RegionGroup,
  subGroup: string | undefined,
  children: readonly string[] | undefined
): RegionOption[] {
  return [
    makeOption(slug, label, group, subGroup, undefined),
    ...(children ?? []).map((gu) => makeOption(`${slug} ${gu}`, gu, group, subGroup, slug)),
  ];
}

/** 도(道)별 시·군 목록을 flatten. 시 slug = `{prefix} {시군}`. 구는 childrenMap 으로 연결 */
function buildProvince(
  prefix: string,
  group: RegionGroup,
  subGroup: string | undefined,
  cities: readonly string[],
  childrenMap: Readonly<Record<string, readonly string[]>> = {}
): RegionOption[] {
  return cities.flatMap((name) =>
    flattenCity(`${prefix} ${name}`, name, group, subGroup, childrenMap[name])
  );
}

// ---------------------------------------------------------------------------
// 서울 (기존 25 구 불변, flat)
// ---------------------------------------------------------------------------

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

const SEOUL_REGIONS: RegionOption[] = SEOUL_GU.map((gu) =>
  makeOption(`서울 ${gu}`, gu, '서울', undefined, undefined)
);

// ---------------------------------------------------------------------------
// 경기 (기존 31 시·군 불변 + 일반구 children 24). subGroup 남부/북부, children 은 부모 시 상속
// ---------------------------------------------------------------------------

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

// 경기 북부 — 경기도 북부청사 관할 10개 시군 기준. 나머지는 남부.
const GYEONGGI_NORTH = new Set([
  '고양시',
  '구리시',
  '남양주시',
  '동두천시',
  '양주시',
  '연천군',
  '의정부시',
  '파주시',
  '포천시',
  '가평군',
]);

const GYEONGGI_CHILDREN: Readonly<Record<string, readonly string[]>> = {
  수원시: ['장안구', '권선구', '팔달구', '영통구'],
  성남시: ['수정구', '중원구', '분당구'],
  고양시: ['덕양구', '일산동구', '일산서구'],
  용인시: ['처인구', '기흥구', '수지구'],
  부천시: ['원미구', '소사구', '오정구'],
  안산시: ['상록구', '단원구'],
  안양시: ['만안구', '동안구'],
  화성시: ['동탄구', '병점구', '만세구', '효행구'],
};

const GYEONGGI_REGIONS: RegionOption[] = GYEONGGI_SI.flatMap((si) =>
  flattenCity(
    `경기 ${si}`,
    si,
    '경기',
    GYEONGGI_NORTH.has(si) ? '북부' : '남부',
    GYEONGGI_CHILDREN[si]
  )
);

// ---------------------------------------------------------------------------
// 인천 (기존 시 단위 `인천` + 신구명 구·군 children 11, flat). 2026-07 개편 신규 명칭만 생성
// ---------------------------------------------------------------------------

const INCHEON_GU = [
  '미추홀구',
  '연수구',
  '남동구',
  '부평구',
  '계양구',
  '제물포구',
  '영종구',
  '서해구',
  '검단구',
  '강화군',
  '옹진군',
] as const;

const INCHEON_REGIONS: RegionOption[] = flattenCity('인천', '인천', '인천', undefined, INCHEON_GU);

// ---------------------------------------------------------------------------
// 강원 (신규 18 시·군, flat, children 없음)
// ---------------------------------------------------------------------------

const GANGWON_CITIES = [
  '춘천시',
  '원주시',
  '강릉시',
  '동해시',
  '태백시',
  '속초시',
  '삼척시',
  '홍천군',
  '횡성군',
  '영월군',
  '평창군',
  '정선군',
  '철원군',
  '화천군',
  '양구군',
  '인제군',
  '고성군',
  '양양군',
] as const;

const GANGWON_REGIONS: RegionOption[] = buildProvince('강원', '강원', undefined, GANGWON_CITIES);

// ---------------------------------------------------------------------------
// 충청 (subGroup: 대전·세종 / 충북 / 충남)
// ---------------------------------------------------------------------------

const DAEJEON_GU = ['동구', '중구', '서구', '유성구', '대덕구'] as const;

const CHUNGBUK_CITIES = [
  '청주시',
  '충주시',
  '제천시',
  '보은군',
  '옥천군',
  '영동군',
  '증평군',
  '진천군',
  '괴산군',
  '음성군',
  '단양군',
] as const;
const CHUNGBUK_CHILDREN: Readonly<Record<string, readonly string[]>> = {
  청주시: ['상당구', '서원구', '흥덕구', '청원구'],
};

const CHUNGNAM_CITIES = [
  '천안시',
  '공주시',
  '보령시',
  '아산시',
  '서산시',
  '논산시',
  '계룡시',
  '당진시',
  '금산군',
  '부여군',
  '서천군',
  '청양군',
  '홍성군',
  '예산군',
  '태안군',
] as const;
const CHUNGNAM_CHILDREN: Readonly<Record<string, readonly string[]>> = {
  천안시: ['동남구', '서북구'],
};

const DAEJEON_REGIONS: RegionOption[] = flattenCity(
  '대전',
  '대전',
  '충청',
  '대전·세종',
  DAEJEON_GU
);
const SEJONG_REGIONS: RegionOption[] = flattenCity('세종', '세종', '충청', '대전·세종', undefined);
const CHUNGBUK_REGIONS: RegionOption[] = buildProvince(
  '충북',
  '충청',
  '충북',
  CHUNGBUK_CITIES,
  CHUNGBUK_CHILDREN
);
const CHUNGNAM_REGIONS: RegionOption[] = buildProvince(
  '충남',
  '충청',
  '충남',
  CHUNGNAM_CITIES,
  CHUNGNAM_CHILDREN
);

const CHUNGCHEONG_REGIONS: RegionOption[] = [
  ...DAEJEON_REGIONS,
  ...SEJONG_REGIONS,
  ...CHUNGBUK_REGIONS,
  ...CHUNGNAM_REGIONS,
];

// ---------------------------------------------------------------------------
// 전라 (subGroup: 광주 / 전북 / 전남)
// ---------------------------------------------------------------------------

const GWANGJU_GU = ['동구', '서구', '남구', '북구', '광산구'] as const;

const JEONBUK_CITIES = [
  '전주시',
  '군산시',
  '익산시',
  '정읍시',
  '남원시',
  '김제시',
  '완주군',
  '진안군',
  '무주군',
  '장수군',
  '임실군',
  '순창군',
  '고창군',
  '부안군',
] as const;
const JEONBUK_CHILDREN: Readonly<Record<string, readonly string[]>> = {
  전주시: ['완산구', '덕진구'],
};

const JEONNAM_CITIES = [
  '목포시',
  '여수시',
  '순천시',
  '나주시',
  '광양시',
  '담양군',
  '곡성군',
  '구례군',
  '고흥군',
  '보성군',
  '화순군',
  '장흥군',
  '강진군',
  '해남군',
  '영암군',
  '무안군',
  '함평군',
  '영광군',
  '장성군',
  '완도군',
  '진도군',
  '신안군',
] as const;

const GWANGJU_REGIONS: RegionOption[] = flattenCity('광주', '광주', '전라', '광주', GWANGJU_GU);
const JEONBUK_REGIONS: RegionOption[] = buildProvince(
  '전북',
  '전라',
  '전북',
  JEONBUK_CITIES,
  JEONBUK_CHILDREN
);
const JEONNAM_REGIONS: RegionOption[] = buildProvince('전남', '전라', '전남', JEONNAM_CITIES);

const JEOLLA_REGIONS: RegionOption[] = [...GWANGJU_REGIONS, ...JEONBUK_REGIONS, ...JEONNAM_REGIONS];

// ---------------------------------------------------------------------------
// 경상 (subGroup: 부산·대구·울산 / 경북 / 경남). 군위군은 대구 children(경북 제외)
// ---------------------------------------------------------------------------

const BUSAN_GU = [
  '중구',
  '서구',
  '동구',
  '영도구',
  '부산진구',
  '동래구',
  '남구',
  '북구',
  '해운대구',
  '사하구',
  '금정구',
  '강서구',
  '연제구',
  '수영구',
  '사상구',
  '기장군',
] as const;
const DAEGU_GU = [
  '중구',
  '동구',
  '서구',
  '남구',
  '북구',
  '수성구',
  '달서구',
  '달성군',
  '군위군',
] as const;
const ULSAN_GU = ['중구', '남구', '동구', '북구', '울주군'] as const;

const GYEONGBUK_CITIES = [
  '포항시',
  '경주시',
  '김천시',
  '안동시',
  '구미시',
  '영주시',
  '영천시',
  '상주시',
  '문경시',
  '경산시',
  '의성군',
  '청송군',
  '영양군',
  '영덕군',
  '청도군',
  '고령군',
  '성주군',
  '칠곡군',
  '예천군',
  '봉화군',
  '울진군',
  '울릉군',
] as const;
const GYEONGBUK_CHILDREN: Readonly<Record<string, readonly string[]>> = {
  포항시: ['남구', '북구'],
};

const GYEONGNAM_CITIES = [
  '창원시',
  '진주시',
  '통영시',
  '사천시',
  '김해시',
  '밀양시',
  '거제시',
  '양산시',
  '의령군',
  '함안군',
  '창녕군',
  '고성군',
  '남해군',
  '하동군',
  '산청군',
  '함양군',
  '거창군',
  '합천군',
] as const;
const GYEONGNAM_CHILDREN: Readonly<Record<string, readonly string[]>> = {
  창원시: ['의창구', '성산구', '마산합포구', '마산회원구', '진해구'],
};

const BUSAN_REGIONS: RegionOption[] = flattenCity(
  '부산',
  '부산',
  '경상',
  '부산·대구·울산',
  BUSAN_GU
);
const DAEGU_REGIONS: RegionOption[] = flattenCity(
  '대구',
  '대구',
  '경상',
  '부산·대구·울산',
  DAEGU_GU
);
const ULSAN_REGIONS: RegionOption[] = flattenCity(
  '울산',
  '울산',
  '경상',
  '부산·대구·울산',
  ULSAN_GU
);
const GYEONGBUK_REGIONS: RegionOption[] = buildProvince(
  '경북',
  '경상',
  '경북',
  GYEONGBUK_CITIES,
  GYEONGBUK_CHILDREN
);
const GYEONGNAM_REGIONS: RegionOption[] = buildProvince(
  '경남',
  '경상',
  '경남',
  GYEONGNAM_CITIES,
  GYEONGNAM_CHILDREN
);

const GYEONGSANG_REGIONS: RegionOption[] = [
  ...BUSAN_REGIONS,
  ...DAEGU_REGIONS,
  ...ULSAN_REGIONS,
  ...GYEONGBUK_REGIONS,
  ...GYEONGNAM_REGIONS,
];

// ---------------------------------------------------------------------------
// 제주 (기존 2, flat) — 서귀포시 우선 매칭으로 제주시 substring 충돌 방지
// ---------------------------------------------------------------------------

const JEJU_SI = ['제주시', '서귀포시'] as const;

const JEJU_REGIONS: RegionOption[] = JEJU_SI.map((si) =>
  makeOption(`제주 ${si}`, si, '제주', undefined, undefined)
);

// ---------------------------------------------------------------------------
// 기타 (기존 2 불변) — keyword 빈 문자열(find 스캔 제외, 수동 선택 전용)
// ---------------------------------------------------------------------------

const ETC_REGION: RegionOption = {
  slug: '기타',
  label: '기타 지역',
  group: '기타',
  keyword: '',
};

const OVERSEAS_REGION: RegionOption = {
  slug: '해외',
  label: '해외',
  group: '기타',
  keyword: '',
};

const ETC_REGIONS: RegionOption[] = [ETC_REGION, OVERSEAS_REGION];

// ---------------------------------------------------------------------------
// 집합/파생
// ---------------------------------------------------------------------------

export const REGIONS: readonly RegionOption[] = [
  ...SEOUL_REGIONS,
  ...GYEONGGI_REGIONS,
  ...INCHEON_REGIONS,
  ...GANGWON_REGIONS,
  ...CHUNGCHEONG_REGIONS,
  ...JEOLLA_REGIONS,
  ...GYEONGSANG_REGIONS,
  ...JEJU_REGIONS,
  ...ETC_REGIONS,
];

export const REGIONS_BY_GROUP: Record<RegionGroup, RegionOption[]> = {
  서울: SEOUL_REGIONS,
  경기: GYEONGGI_REGIONS,
  인천: INCHEON_REGIONS,
  강원: GANGWON_REGIONS,
  충청: CHUNGCHEONG_REGIONS,
  전라: JEOLLA_REGIONS,
  경상: GYEONGSANG_REGIONS,
  제주: JEJU_REGIONS,
  기타: ETC_REGIONS,
};

/**
 * 그룹 전체 선택의 쿼리 접두 목록 — slug 명명 규칙(첫 토큰 = 시·도 축)에서 파생.
 * 그룹 확장을 slug 전수 나열(in) 대신 like 접두 몇 개로 압축해 URL 길이 폭발을 막는다.
 * (실측: 그룹 4개 이상 선택 시 in() 160+ 나열이 게이트웨이 URL 한도로 ERR_FAILED)
 * 안전성 불변식: 어떤 slug 도 다른 그룹의 접두와 매칭되지 않는다 — regionSelection.test
 * ("접두 파티션 안전성")가 가드.
 */
export const REGION_GROUP_QUERY_PREFIXES: Record<RegionGroup, readonly string[]> =
  REGION_GROUPS.reduce(
    (acc, group) => ({
      ...acc,
      [group]: Array.from(
        new Set(REGIONS_BY_GROUP[group].map((r) => r.slug.split(' ')[0] as string))
      ),
    }),
    {} as Record<RegionGroup, readonly string[]>
  );

const REGION_BY_SLUG: ReadonlyMap<string, RegionOption> = new Map(REGIONS.map((r) => [r.slug, r]));

// 구(하위) 레벨 역참조 — parentSlug 를 가진 항목을 부모 시 slug 로 묶는다.
const CHILDREN_BY_PARENT: ReadonlyMap<string, RegionOption[]> = REGIONS.reduce((map, r) => {
  if (r.parentSlug) {
    map.set(r.parentSlug, [...(map.get(r.parentSlug) ?? []), r]);
  }
  return map;
}, new Map<string, RegionOption[]>());

/** 시 slug 의 소속 구 목록 (구 없는 시·군은 빈 배열) */
export function getRegionChildren(slug: string | null | undefined): readonly RegionOption[] {
  if (!slug) return [];
  return CHILDREN_BY_PARENT.get(slug) ?? [];
}

/** 구 보유 시 여부 — 필터 시트의 확장 칩 판별용 */
export function hasRegionChildren(slug: string | null | undefined): boolean {
  return getRegionChildren(slug).length > 0;
}

export function isRegionSlug(slug: string | null | undefined): boolean {
  return !!slug && REGION_BY_SLUG.has(slug);
}

export function getRegionLabel(slug: string | null | undefined): string | undefined {
  if (!slug) return undefined;
  return REGION_BY_SLUG.get(slug)?.label;
}

export function getRegionOption(slug: string | null | undefined): RegionOption | undefined {
  if (!slug) return undefined;
  return REGION_BY_SLUG.get(slug);
}

/**
 * 지역 검색 — 시트 내 빠른 찾기용. label/keyword/slug 부분 일치, REGIONS 순서 유지.
 * 빈 질의는 빈 배열(검색 모드 아님).
 */
export function searchRegions(query: string): RegionOption[] {
  const q = query.trim();
  if (!q) return [];
  return REGIONS.filter(
    (r) => r.label.includes(q) || r.slug.includes(q) || (r.keyword !== '' && r.keyword.includes(q))
  );
}

// ---------------------------------------------------------------------------
// 주소 → 지역 best-effort 추출 (작성 폼 자동 제안)
// ---------------------------------------------------------------------------

/** 광역시 slug 목록 (주소에 keyword 로 등장 시 그 광역시로 한정) */
const METRO_SLUGS: readonly string[] = ['부산', '대구', '인천', '광주', '대전', '울산', '세종'];

/** 도명 명시 branch — 약칭과 전체명을 모두 인식(‘충북’ includes 로는 ‘충청북도’를 못 잡으므로 둘 다) */
const PROVINCE_BRANCHES: readonly (readonly [readonly string[], readonly RegionOption[]])[] = [
  [['강원'], GANGWON_REGIONS], // 강원특별자치도는 '강원' 포함
  [['충북', '충청북도'], CHUNGBUK_REGIONS],
  [['충남', '충청남도'], CHUNGNAM_REGIONS],
  [['전북', '전라북도'], JEONBUK_REGIONS],
  [['전남', '전라남도'], JEONNAM_REGIONS],
  [['경북', '경상북도'], GYEONGBUK_REGIONS],
  [['경남', '경상남도'], GYEONGNAM_REGIONS],
];

/**
 * keyword 가 주소에 포함된 항목 중 가장 긴 keyword 우선 매칭.
 * '강서구' 가 '서구'(부분문자열)보다, '남양주시' 가 '양주시'보다 먼저 잡히게 한다.
 */
function findByKeywordLongestFirst(
  regions: readonly RegionOption[],
  text: string
): RegionOption | undefined {
  return [...regions]
    .sort((a, b) => b.keyword.length - a.keyword.length)
    .find((r) => r.keyword !== '' && text.includes(r.keyword));
}

/** 한 도(그룹/광역시) 안에서 구 우선 → 시·군 매칭. 실패 시 undefined(한정 후 hard return) */
function findInProvince(regions: readonly RegionOption[], text: string): RegionOption | undefined {
  const gu = findByKeywordLongestFirst(
    regions.filter((r) => r.parentSlug !== undefined),
    text
  );
  if (gu) return gu;
  return findByKeywordLongestFirst(
    regions.filter((r) => r.parentSlug === undefined),
    text
  );
}

/**
 * 자유텍스트 주소에서 가장 적합한 지역을 best-effort 로 추출한다.
 *
 * @description 작성 폼에서 주소 입력 시 지역 드롭다운 자동 선택용. 결과는 사용자가
 * 수정 가능하므로 정확도보다 충돌 회피(경기 광주 vs 광주광역시, 부산 강서구 vs 서울 강서구)에
 * 무게를 둔다. 매칭 실패 시 undefined → 사용자가 직접 선택.
 *
 * 우선순위: ①경기 ②광역시(구 우선) ③제주 ④도명(구 우선) ⑤서울 ⑥폴백(서울 구 가정).
 * ②광역시가 ④도명보다 먼저 — "전남광주통합특별시 광산구"가 광주 구로 매칭되도록.
 */
export function findRegionByAddress(address: string | null | undefined): RegionOption | undefined {
  const text = (address ?? '').trim();
  if (!text) return undefined;

  // ① 경기 명시 — 경기 한정(구 우선 → 시·군). 광역시 광주와 혼동 방지.
  if (text.includes('경기')) {
    return findInProvince(GYEONGGI_REGIONS, text);
  }

  // ② 광역시 keyword 명시 — 그 광역시의 구·군 우선, 없으면 광역시 slug.
  // 단, 구 미매칭인데 도명도 함께 있으면(예: "전남광주통합특별시 목포시") 광역시 하드 반환이
  // 도 시·군 매칭을 가리므로 ④로 폴스루한다(리뷰 M2).
  for (const metroSlug of METRO_SLUGS) {
    if (text.includes(metroSlug)) {
      const gu = findByKeywordLongestFirst(getRegionChildren(metroSlug), text);
      if (gu) return gu;
      const provinceAlsoNamed = PROVINCE_BRANCHES.some(([keywords]) =>
        keywords.some((k) => text.includes(k))
      );
      if (!provinceAlsoNamed) return getRegionOption(metroSlug);
    }
  }

  // ③ 제주 — 서귀포시 먼저(제주시 substring 충돌 방지)
  if (text.includes('서귀포')) return getRegionOption('제주 서귀포시');
  if (text.includes('제주')) return getRegionOption('제주 제주시');

  // ④ 도명 명시 — 해당 도 한정(구 우선 → 시·군). 매칭 실패 시 undefined(hard return).
  for (const [keywords, regions] of PROVINCE_BRANCHES) {
    if (keywords.some((k) => text.includes(k))) {
      return findInProvince(regions, text);
    }
  }

  // ⑤ 서울 명시 — 서울 구 매칭
  if (text.includes('서울')) {
    return findByKeywordLongestFirst(SEOUL_REGIONS, text);
  }

  // ⑥ 폴백 — 도/시 접두 없는 구 이름은 서울 구로 가정(target market = 수도권 집중)
  return findByKeywordLongestFirst(SEOUL_REGIONS, text);
}
