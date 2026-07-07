/** ops 1b — 테이블 목록 행. Idx/이름/좌석·빈·착석 카운트 + lock/priority/status 배지. */
import { View, Text, Pressable } from 'react-native';
import type { OpsTable, OpsTableLockType, OpsTableStatus } from '@/types/ops';

const LOCK_LABEL: Record<OpsTableLockType, string> = {
  none: '',
  locked: '잠금',
  feature: '피처',
};
const STATUS_LABEL: Record<OpsTableStatus, string> = {
  open: '',
  standby: '대기',
  closed: '마감',
};

function Badge({ text }: { text: string }) {
  return (
    <View className="rounded-md bg-gray-100 px-2 py-0.5 dark:bg-gray-800">
      <Text className="text-xs text-content-primary dark:text-off-white">{text}</Text>
    </View>
  );
}

interface TableRowProps {
  table: OpsTable;
  seatCount: number;
  filled: number;
  onPress: () => void;
}

export function TableRow({ table, seatCount, filled, onPress }: TableRowProps) {
  const empty = Math.max(0, seatCount - filled);
  const lockLabel = LOCK_LABEL[table.lockType];
  const statusLabel = STATUS_LABEL[table.status];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="mb-2 flex-row items-center rounded-lg border border-gray-200 bg-white p-3 active:opacity-70 dark:border-gray-700 dark:bg-gray-900"
    >
      <Text className="w-10 font-sans-semibold text-content-primary dark:text-off-white">
        T{table.tableNo}
      </Text>
      <View className="flex-1">
        <Text
          numberOfLines={1}
          className="font-sans-semibold text-content-primary dark:text-off-white"
        >
          {table.name?.trim() ? table.name : `테이블 ${table.tableNo}`}
        </Text>
        <Text className="text-xs text-secondary-500 dark:text-secondary-400">
          좌석 {seatCount} · 빈 {empty} · 착석 {filled}
        </Text>
      </View>
      <View className="flex-row gap-1">
        {typeof table.priority === 'number' && <Badge text={`우선 ${table.priority}`} />}
        {lockLabel ? <Badge text={lockLabel} /> : null}
        {statusLabel ? <Badge text={statusLabel} /> : null}
      </View>
    </Pressable>
  );
}
