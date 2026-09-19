/**
 * venueDayDetailMapping — get_venue_day_slots(VenueDaySlot) → ConfirmedStaff(Group) 순수 매퍼
 *
 * 날짜 상세(unit 6)에서 기존 ConfirmedStaffList(읽기전용)를 재사용하기 위해 RPC 슬롯 행을
 * ConfirmedStaff 모양으로 투영한다. RPC 응답에 없는 필드는 안전 기본값으로 채운다(불일치 흡수).
 * 렌더 없이 결정적으로 단위테스트 가능하도록 순수함수로 분리한다(불변성: 새 객체만 생성).
 */
import type { VenueDaySlot } from '@/repositories/workSchedule';
import type { ConfirmedStaff, ConfirmedStaffGroup } from '@/types';
import type { ConfirmedStaffStatus, PayrollStatus } from '@/shared/status';
import { getTodayString, formatDateWithDay } from '@/utils/date';

const VALID_STATUSES: readonly ConfirmedStaffStatus[] = [
  'scheduled',
  'checked_in',
  'checked_out',
  'completed',
  'cancelled',
  'no_show',
];

/** work_log status 문자열을 ConfirmedStaffStatus 로 안전 정규화(비정상 값은 scheduled 로 흡수). */
function normalizeStatus(raw: string | null | undefined): ConfirmedStaffStatus {
  return raw && (VALID_STATUSES as readonly string[]).includes(raw)
    ? (raw as ConfirmedStaffStatus)
    : 'scheduled';
}

const VALID_PAYROLL_STATUSES: readonly PayrollStatus[] = ['pending', 'completed', 'failed'];

/** payroll_status 문자열을 PayrollStatus 로 안전 정규화(모르는 값은 undefined = 판단 보류). */
function normalizePayrollStatus(raw: string | null | undefined): PayrollStatus | undefined {
  return raw && (VALID_PAYROLL_STATUSES as readonly string[]).includes(raw)
    ? (raw as PayrollStatus)
    : undefined;
}

/** 슬롯 1건 → ConfirmedStaff 투영(읽기전용 카드용). */
export function mapVenueDaySlotToConfirmedStaff(slot: VenueDaySlot, date: string): ConfirmedStaff {
  return {
    id: slot.workLogId,
    staffId: slot.staffId ?? '',
    staffName: slot.staffName ?? slot.staffNickname ?? '이름 미상',
    staffNickname: slot.staffNickname ?? undefined,
    staffPhotoURL: slot.staffPhotoUrl ?? undefined,
    role: slot.role ?? 'staff',
    customRole: slot.customRole ?? undefined,
    date,
    status: normalizeStatus(slot.status),
    timeSlot: slot.timeSlot ?? undefined,
    color: slot.color ?? undefined,
    notes: slot.notes ?? undefined,
    // 🔑 실적을 함께 싣는다. 이게 빠져 있으면 카드는 `timeSlot`(예정)만 보고 그리는데
    //    행을 탭해 열리는 통합 시트는 실적을 보여준다 — 같은 행이 두 가지 시각을 말한다.
    //    `checkInTs`/`checkOutTs` 는 ISO timestamptz 문자열이고 `TimeInput`(=DateInput)
    //    이 문자열을 받으므로 그대로 넘긴다.
    checkInTime: slot.checkInTs ?? undefined,
    checkOutTime: slot.checkOutTs ?? undefined,
    // ⚠️ 이 경로에서 `payrollStatus` 는 **현재 아무 게이트도 움직이지 않는다** —
    //    `VenueDayDetail` 이 `onEditTime`·`onCancelNoShow` 를 넘기지 않아
    //    `ConfirmedStaffCard` 의 두 게이트(`canEditTime`·`canCancelNoShow`)가 다 비활성이다.
    //    그래도 싣는 이유는 반대 방향의 사고를 막기 위해서다: 비워 두면 나중에 누가
    //    `onEditTime` 을 배선하는 순간 **정산 완료 건이 편집 가능한 것처럼** 보이고
    //    서버에서야 거부된다. 투영은 사실대로 하고, 게이트 개폐는 소비처가 정한다.
    payrollStatus: normalizePayrollStatus(slot.payrollStatus),
  };
}

/**
 * 하루치 슬롯 배열 → ConfirmedStaffList 가 소비하는 단일 그룹(없으면 null).
 * stats 는 ConfirmedStaffGroup.stats 계약(total/scheduled/checkedIn/completed/noShow)을 따른다.
 */
export function buildVenueDayGroup(
  slots: VenueDaySlot[],
  date: string
): ConfirmedStaffGroup | null {
  if (slots.length === 0) return null;

  const staff = slots.map((slot) => mapVenueDaySlotToConfirmedStaff(slot, date));
  const today = getTodayString();

  return {
    date,
    formattedDate: formatDateWithDay(date),
    staff,
    isToday: date === today,
    isPast: date < today,
    stats: {
      total: staff.length,
      scheduled: staff.filter((s) => s.status === 'scheduled').length,
      checkedIn: staff.filter((s) => s.status === 'checked_in').length,
      completed: staff.filter((s) => s.status === 'completed').length,
      noShow: staff.filter((s) => s.status === 'no_show').length,
    },
  };
}
