/**
 * ops 1e — STAFF 탭 로스터 행. 이름(닉네임) + source 구분 + 역할 배지 + 배정 테이블 배지(T{n}).
 * TableRow.tsx 문형 복제 — 행 컴포넌트는 훅을 호출하지 않고 부모(StaffTab)가 주입한 파생값만 조회한다.
 * StaffTab.tsx 가 800줄 제한을 지키기 위해 분리한 하위 컴포넌트(브리프 "시트/행 컴포넌트 분리" 지침).
 */
import { View, Text, Pressable } from 'react-native';
import { getStaffRoleLabel } from '@/types/role';
import type { OpsStaff, OpsStaffWorkLogLink } from '@/types/ops';

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
  /** 해석기 결과(⑦-2). 아직 안 왔으면 null — 그때는 근태 배지를 아예 그리지 않는다. */
  attendance: OpsStaffWorkLogLink | null;
  onPress: () => void;
}

/**
 * 근태 요약 라벨. 로딩 중(null)과 "기록 없음"을 구분한다 — 빈 상태를 "미출근" 으로 그리면
 * 아직 안 온 데이터를 사실로 보여주게 된다.
 * 사유가 `ok`/`settled` 가 아니면 시각 자체가 없으므로(work_log 미해석) 배지를 그리지 않는다.
 */
function attendanceLabel(link: OpsStaffWorkLogLink): string | null {
  if (link.reason !== 'ok' && link.reason !== 'settled') return null;
  if (link.checkOutTs) return '퇴근';
  if (link.checkInTs) return '출근';
  return null;
}

export function StaffRow({ staff, assignedTableNo, attendance, onPress }: StaffRowProps) {
  const roleLabel = getStaffRoleLabel(staff.role, staff.customRole);
  const sourceLabel = staff.source === 'snapshot_import' ? '가져옴' : '수동';
  const attLabel = attendance ? attendanceLabel(attendance) : null;

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
        {attLabel !== null && <Badge text={attLabel} accent />}
        <Badge text={roleLabel} />
        {assignedTableNo !== null && <Badge text={`T${assignedTableNo}`} accent />}
      </View>
    </Pressable>
  );
}
