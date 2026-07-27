/**
 * venueDayDetailMapping — get_venue_day_slots(VenueDaySlot) → ConfirmedStaff(Group) 순수 매퍼
 *
 * 날짜 상세(unit 6)에서 기존 ConfirmedStaffList(읽기전용)를 재사용하기 위해 RPC 슬롯 행을
 * ConfirmedStaff 모양으로 투영한다. RPC 응답에 없는 필드는 안전 기본값으로 채운다(불일치 흡수).
 * 렌더 없이 결정적으로 단위테스트 가능하도록 순수함수로 분리한다(불변성: 새 객체만 생성).
 */
import type { VenueDaySlot } from '@/repositories/workSchedule';
import type { ConfirmedStaff, ConfirmedStaffGroup } from '@/types';
import type { ConfirmedStaffStatus } from '@/shared/status';
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
  };
}

/**
 * 하루치 슬롯 배열 → ConfirmedStaffList 가 소비하는 단일 그룹(없으면 null).
 * stats 는 ConfirmedStaffGroup.stats 계약(total/checkedIn/completed/noShow)을 따른다.
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
      checkedIn: staff.filter((s) => s.status === 'checked_in').length,
      completed: staff.filter((s) => s.status === 'completed').length,
      noShow: staff.filter((s) => s.status === 'no_show').length,
    },
  };
}
