/**
 * 충전 패키지 정보
 * 문서 기준: MODEL_B_CHIP_SYSTEM_FINAL.md
 */

/**
 * 충전 패키지 ID
 */
export type ChipPackageId = 'basic' | 'popular' | 'recommended' | 'best_value';

/**
 * 충전 패키지
 */
export interface ChipPackage {
  id: ChipPackageId;
  name: string;
  nameEn: string;
  price: number;              // 가격 (원)
  chipCount: number;          // 칩 개수
  pricePerChip: number;       // 칩당 가격 (원)
  discountRate: number;       // 할인율 (%)
  savings: number;            // 절약 금액 (원)
  badge?: string;             // 배지 (⭐, 🏆, 🔥)
  targetCustomer: string;     // 타겟 고객
  usageDuration: string;      // 사용 기간 예상
  isPopular: boolean;         // 인기 여부
  isRecommended: boolean;     // 추천 여부
  isBestValue: boolean;       // 최대 할인 여부
}

/**
 * 충전 패키지 설정 (중앙 관리)
 * 문서 출처: MODEL_B_CHIP_SYSTEM_FINAL.md 라인 46-51
 */
export const CHIP_PACKAGES: Record<ChipPackageId, ChipPackage> = {
  basic: {
    id: 'basic',
    name: '기본 패키지',
    nameEn: 'Basic Package',
    price: 4900,
    chipCount: 21,
    pricePerChip: 233,
    discountRate: 0,
    savings: 0,
    badge: '🥉',
    targetCustomer: '소형 펍 (1-2명 운영)',
    usageDuration: '약 1주일',
    isPopular: false,
    isRecommended: false,
    isBestValue: false,
  },
  popular: {
    id: 'popular',
    name: '인기 패키지',
    nameEn: 'Popular Package',
    price: 9900,
    chipCount: 50,
    pricePerChip: 198,
    discountRate: 15,
    savings: 735,
    badge: '⭐',
    targetCustomer: '중형 펍 (3-5명 운영)',
    usageDuration: '약 2주일',
    isPopular: true,
    isRecommended: false,
    isBestValue: false,
  },
  recommended: {
    id: 'recommended',
    name: '추천 패키지',
    nameEn: 'Recommended Package',
    price: 19900,
    chipCount: 115,
    pricePerChip: 173,
    discountRate: 26,
    savings: 3895,
    badge: '🏆',
    targetCustomer: '대형 펍 (6-10명 운영)',
    usageDuration: '약 1개월',
    isPopular: false,
    isRecommended: true,
    isBestValue: false,
  },
  best_value: {
    id: 'best_value',
    name: '최대 할인 패키지',
    nameEn: 'Best Value Package',
    price: 49900,
    chipCount: 310,
    pricePerChip: 161,
    discountRate: 31,
    savings: 22430,
    badge: '🔥',
    targetCustomer: '체인점 (10개 이상 지점)',
    usageDuration: '약 3개월',
    isPopular: false,
    isRecommended: false,
    isBestValue: true,
  },
};

/**
 * 패키지 ID 배열 (UI 렌더링 순서)
 */
export const CHIP_PACKAGE_IDS: ChipPackageId[] = [
  'basic',
  'popular',
  'recommended',
  'best_value',
];

/**
 * 패키지 ID로 패키지 정보 조회
 */
export const getChipPackage = (id: ChipPackageId): ChipPackage => {
  return CHIP_PACKAGES[id];
};

/**
 * 모든 패키지 목록 조회
 */
export const getAllChipPackages = (): ChipPackage[] => {
  return CHIP_PACKAGE_IDS.map(id => CHIP_PACKAGES[id]);
};
