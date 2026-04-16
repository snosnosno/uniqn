import { Text, View } from 'react-native';
import type { BoardType } from '@/types/board';

/**
 * 게시판 타입에 맞는 색상 뱃지 렌더링
 */

const COMPACT_LABELS: Record<BoardType, string> = {
  notice: '공지',
  schedule: '일정',
  free: '자유',
  tda: 'TDA',
  substitute: '대타',
};

const CONTAINER_STYLES: Record<BoardType, string> = {
  notice: 'bg-info-100 dark:bg-info-700/30',
  schedule: 'bg-success-100 dark:bg-success-700/30',
  free: 'bg-primary-100 dark:bg-primary-900/30',
  tda: 'bg-secondary-200 dark:bg-secondary-700/40',
  substitute: 'bg-error-100 dark:bg-error-700/30',
};

const TEXT_STYLES: Record<BoardType, string> = {
  notice: 'text-info-700 dark:text-info-500',
  schedule: 'text-success-700 dark:text-success-500',
  free: 'text-primary-700 dark:text-primary-300',
  tda: 'text-secondary-700 dark:text-secondary-200',
  substitute: 'text-error-700 dark:text-error-500',
};

interface BoardTypeBadgeProps {
  boardType: BoardType;
}

export function BoardTypeBadge({ boardType }: BoardTypeBadgeProps) {
  const label = COMPACT_LABELS[boardType];
  return (
    <View
      className={`rounded-sm px-1.5 py-0.5 ${CONTAINER_STYLES[boardType]}`}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${label} 게시판 배지`}
    >
      <Text className={`text-xs font-sans-semibold ${TEXT_STYLES[boardType]}`}>{label}</Text>
    </View>
  );
}

export default BoardTypeBadge;
