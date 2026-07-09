/**
 * ops 1e — 딜러 지정 피커 시트.
 * 로스터(useOpsStaff)를 딜러 우선 그룹핑(role==='dealer' 상단, 이하 역할 순서)해 SelectBottomSheet 로 노출.
 * 현재 배정자(currentStaffId)가 있으면 "배정 해제"(destructive) 옵션을 최상단에 추가(멱등 해제).
 * 선택 시 useAssignTableStaff({tableId, staffId})로 위임(SelectBottomSheet 가 onSelect 후 onClose 를
 * 자체 호출하므로 이 컴포넌트가 다시 onClose 를 호출하지 않는다 — TablesTab 잠금/우선순위 피커와 동일 문형).
 * tableId 고정 배정(TABLES 탭)뿐 아니라 Task 8(STAFF 탭 행 액션 "테이블 지정")도 재사용 대상.
 */
import { useMemo } from 'react';
import { SelectBottomSheet } from '@/components/ui';
import { useOpsStaff, useAssignTableStaff } from '@/hooks/ops';
import { getStaffRoleLabel } from '@/types/role';
import type { StaffRole } from '@/types/role';

/** 딜러 우선 정렬 순서. 목록에 없는 역할은 배열 끝으로 밀린다. */
const ROLE_ORDER: readonly StaffRole[] = [
  'dealer',
  'floor',
  'serving',
  'manager',
  'staff',
  'other',
];

const UNASSIGN_VALUE = '__unassign';
const NONE_VALUE = '__none';

export interface DealerPickerSheetProps {
  visible: boolean;
  tournamentId: string;
  tableId: string;
  /** 현재 배정된 딜러의 staffId(ops_staff.staff_id). null/undefined 면 미배정. */
  currentStaffId?: string | null;
  onClose: () => void;
}

export function DealerPickerSheet({
  visible,
  tournamentId,
  tableId,
  currentStaffId,
  onClose,
}: DealerPickerSheetProps) {
  const { data: roster } = useOpsStaff(tournamentId);
  const assignMut = useAssignTableStaff(tournamentId);

  const options = useMemo(() => {
    const sorted = [...(roster ?? [])].sort((a, b) => {
      const roleDiff = ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);
      if (roleDiff !== 0) return roleDiff;
      return a.staffName.localeCompare(b.staffName, 'ko');
    });

    const staffOptions = sorted.map((s) => ({
      label: `${getStaffRoleLabel(s.role, s.customRole)} · ${s.staffName}${
        s.staffId === currentStaffId ? ' (현재)' : ''
      }`,
      value: s.staffId,
    }));

    const rosterOptions =
      staffOptions.length > 0
        ? staffOptions
        : [{ label: '등록된 로스터가 없습니다', value: NONE_VALUE, disabled: true }];

    return currentStaffId
      ? [{ label: '배정 해제', value: UNASSIGN_VALUE, destructive: true }, ...rosterOptions]
      : rosterOptions;
  }, [roster, currentStaffId]);

  return (
    <SelectBottomSheet
      visible={visible}
      onClose={onClose}
      title="딜러 지정"
      options={options}
      snapPoints={['60%', '90%']}
      scrollable
      onSelect={(value) => {
        if (value === NONE_VALUE) return;
        const staffId = value === UNASSIGN_VALUE ? null : value;
        assignMut.mutate({ tableId, staffId });
      }}
    />
  );
}

export default DealerPickerSheet;
