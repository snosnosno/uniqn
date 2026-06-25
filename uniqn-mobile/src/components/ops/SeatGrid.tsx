/** ops 1b — 좌석 그리드(3열). 점유=참가자명, 빈=+. 이동모드 시 빈 좌석 강조. */
import { View, Text, Pressable } from 'react-native';
import type { OpsSeat } from '@/types/ops';

interface SeatGridProps {
  seats: readonly OpsSeat[];
  participantNameById: Map<string, string>;
  moveMode: boolean;
  moveFromSeatId?: string | null;
  onSeatPress: (seat: OpsSeat) => void;
}

export function SeatGrid({
  seats,
  participantNameById,
  moveMode,
  moveFromSeatId,
  onSeatPress,
}: SeatGridProps) {
  if (seats.length === 0) {
    return (
      <View className="items-center py-10">
        <Text className="text-secondary-500 dark:text-secondary-400">좌석이 없습니다.</Text>
      </View>
    );
  }

  const ordered = [...seats].sort((a, b) => a.seatNo - b.seatNo);

  return (
    <View className="flex-row flex-wrap">
      {ordered.map((seat) => {
        const occupied = !!seat.participantId;
        const isSource = seat.id === moveFromSeatId;
        const targetable = moveMode && !occupied && !isSource;
        const name = seat.participantId ? participantNameById.get(seat.participantId) : undefined;

        const cellClass = isSource
          ? 'border-primary-600 bg-gray-100 dark:bg-gray-700'
          : targetable
            ? 'border-dashed border-primary-500 bg-white dark:bg-gray-900'
            : occupied
              ? 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
              : 'border-dashed border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800';

        return (
          <View key={seat.id} className="w-1/3 p-1">
            <Pressable
              onPress={() => onSeatPress(seat)}
              accessibilityRole="button"
              style={{ minHeight: 64 }}
              className={`items-center justify-center rounded-lg border p-2 active:opacity-70 ${cellClass}`}
            >
              <Text className="text-xs text-secondary-500 dark:text-secondary-400">
                #{seat.seatNo}
              </Text>
              {occupied ? (
                <Text
                  numberOfLines={1}
                  className="mt-0.5 font-sans-semibold text-sm text-content-primary dark:text-off-white"
                >
                  {name ?? '점유'}
                </Text>
              ) : (
                <Text className="mt-0.5 text-lg text-secondary-400 dark:text-secondary-500">+</Text>
              )}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

export default SeatGrid;
