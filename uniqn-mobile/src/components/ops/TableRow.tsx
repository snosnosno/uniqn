/**
 * ops 1b — 테이블 목록 행. Idx/이름/좌석·빈·착석 카운트 + lock/priority/status/딜러(1e) 배지.
 * 딜러 배지: assignedStaffId 있으면 로스터 이름(staffNameById 조회, SeatGrid.participantNameById 문형과 동일하게
 * "참조 id → 이름" 맵을 props로 주입 — tableId 가 아닌 assignedStaffId 로 조회) 표시, 로스터에 없으면 "외부 스태프" 폴백.
 * 행 컴포넌트는 훅을 호출하지 않고 부모(TablesTab)가 주입한 맵을 조회만 한다.
 */
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
  /** staffId → 로스터 이름 맵(useOpsStaff 파생, TablesTab이 주입). */
  staffNameById: Map<string, string>;
  onPress: () => void;
}

/** 배정된 staffId 가 로스터 맵에 없을 때 표시하는 폴백 라벨(TablesTab 딜러 버튼과 공유). */
export const FALLBACK_DEALER_NAME = '외부 스태프';

export function TableRow({ table, seatCount, filled, staffNameById, onPress }: TableRowProps) {
  const empty = Math.max(0, seatCount - filled);
  const lockLabel = LOCK_LABEL[table.lockType];
  const statusLabel = STATUS_LABEL[table.status];
  const dealerName = table.assignedStaffId
    ? (staffNameById.get(table.assignedStaffId) ?? FALLBACK_DEALER_NAME)
    : null;

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
        {dealerName ? <Badge text={`딜러 ${dealerName}`} /> : null}
        {typeof table.priority === 'number' && <Badge text={`우선 ${table.priority}`} />}
        {lockLabel ? <Badge text={lockLabel} /> : null}
        {statusLabel ? <Badge text={statusLabel} /> : null}
      </View>
    </Pressable>
  );
}

export default TableRow;
