/**
 * 칩 가격 설정 인터페이스
 * 중앙 집중식 칩 비용 관리
 */
export interface ChipPricing {
  postingType: 'fixed' | 'urgent'; // 유료 타입만 (regular, tournament는 무료)
  durationDays?: 7 | 30 | 90; // fixed 타입일 때만 (기간별 가격)
  chipCost: number; // 칩 비용
}
