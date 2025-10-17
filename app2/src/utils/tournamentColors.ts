/**
 * 토너먼트 색상 관리 유틸리티
 *
 * 토너먼트별로 고유한 색상을 할당하여 시각적으로 구분할 수 있도록 합니다.
 */

/**
 * 토너먼트 색상 팔레트 (6가지)
 */
export const TOURNAMENT_COLORS = [
  '#3B82F6', // 파랑 (Blue)
  '#10B981', // 초록 (Green)
  '#F59E0B', // 주황 (Orange)
  '#EF4444', // 빨강 (Red)
  '#8B5CF6', // 보라 (Purple)
  '#EC4899', // 핑크 (Pink)
] as const;

/**
 * 기본 테이블 색상
 */
export const UNASSIGNED_COLOR = '#D1D5DB'; // 회색 (Gray)

/**
 * 인덱스 기반으로 토너먼트 색상 반환
 *
 * @param index - 토너먼트 인덱스 (0부터 시작)
 * @returns HEX 색상 코드
 *
 * @example
 * getTournamentColor(0) // '#3B82F6' (파랑)
 * getTournamentColor(6) // '#3B82F6' (순환하여 파랑)
 */
export const getTournamentColor = (index: number): string => {
  return TOURNAMENT_COLORS[index % TOURNAMENT_COLORS.length] as string;
};

/**
 * 토너먼트 ID로부터 색상 가져오기
 *
 * @param tournamentId - 토너먼트 ID
 * @param tournaments - 전체 토너먼트 목록
 * @returns HEX 색상 코드 또는 undefined
 *
 * @example
 * getTournamentColorById('t1', tournaments) // tournaments[0].color 또는 자동 생성 색상
 */
export const getTournamentColorById = (
  tournamentId: string | null | undefined,
  tournaments: Array<{ id: string; color?: string }>
): string | undefined => {
  if (!tournamentId) return undefined;

  const tournament = tournaments.find(t => t.id === tournamentId);
  return tournament?.color;
};

/**
 * 토너먼트 색상의 밝기를 조정한 변형 색상 생성
 * (hover 효과, border 등에 사용)
 *
 * @param color - HEX 색상 코드
 * @param amount - 밝기 조정 값 (-255 ~ 255)
 * @returns 조정된 HEX 색상 코드
 */
export const adjustColorBrightness = (color: string, amount: number): string => {
  const hex = color.replace('#', '');
  const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount));

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

/**
 * 색상 이름 매핑 (UI 표시용)
 */
export const COLOR_NAMES: Record<string, string> = {
  '#3B82F6': '파랑',
  '#10B981': '초록',
  '#F59E0B': '주황',
  '#EF4444': '빨강',
  '#8B5CF6': '보라',
  '#EC4899': '핑크',
  '#D1D5DB': '회색',
};

/**
 * 색상 이모지 매핑 (UI 표시용)
 */
export const COLOR_EMOJIS: Record<string, string> = {
  '#3B82F6': '🔵',
  '#10B981': '🟢',
  '#F59E0B': '🟠',
  '#EF4444': '🔴',
  '#8B5CF6': '🟣',
  '#EC4899': '🩷',
  '#D1D5DB': '⚪',
};
