/**
 * ops 1e — STAFF 탭 로스터 행. 이름(닉네임) + source 구분 + 역할 배지 + 배정 테이블 배지(T{n}).
 * TableRow.tsx 문형 복제 — 행 컴포넌트는 훅을 호출하지 않고 부모(StaffTab)가 주입한 파생값만 조회한다.
 * StaffTab.tsx 가 800줄 제한을 지키기 위해 분리한 하위 컴포넌트(브리프 "시트/행 컴포넌트 분리" 지침).
 */
import { View, Text, Pressable } from 'react-native';
import { getStaffRoleLabel } from '@/types/role';
import type { OpsStaff } from '@/types/ops';

function Badge({ text, accent = false }: { text: string; accent?: boolean }) {
  return (
    <View
      className={`rounded-md px-2 py-0.5 ${
        accent ? 'bg-primary-100 dark:bg-primary-900' : 'bg-gray-100 dark:bg-gray-800'
      }`}
    >
      <Text
        className={`text-xs ${
          accent ? 'text-primary-700 dark:text-primary-300' : 'text-content-primary'
        }`}
      >
        {text}
      </Text>
    </View>
  );
}

interface StaffRowProps {
  staff: OpsStaff;
  /** 배정된 테이블 번호(useOpsTables 파생, StaffTab 이 주입). 미배정이면 null. */
  assignedTableNo: number | null;
  onPress: () => void;
}

export function StaffRow({ staff, assignedTableNo, onPress }: StaffRowProps) {
  const roleLabel = getStaffRoleLabel(staff.role, staff.customRole);
  const sourceLabel = staff.source === 'snapshot_import' ? '가져옴' : '수동';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="mb-2 flex-row items-center rounded-lg border border-gray-200 bg-white p-3 active:opacity-70 dark:border-gray-700 dark:bg-gray-900"
    >
      <View className="flex-1">
        <Text
          numberOfLines={1}
          className="font-sans-semibold text-content-primary dark:text-off-white"
        >
          {staff.staffName}
          {staff.staffNickname ? (
            <Text className="text-xs text-secondary-500 dark:text-secondary-400">{`  ${staff.staffNickname}`}</Text>
          ) : null}
        </Text>
        <Text className="text-xs text-secondary-500 dark:text-secondary-400">{sourceLabel}</Text>
      </View>
      <View className="flex-row gap-1">
        <Badge text={roleLabel} />
        {assignedTableNo !== null && <Badge text={`T${assignedTableNo}`} accent />}
      </View>
    </Pressable>
  );
}

export default StaffRow;
