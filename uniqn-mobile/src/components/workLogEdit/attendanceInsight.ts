/**
 * attendanceInsight — 실적(출퇴근) 입력에서 파생되는 총 근무 시간 · 경고 · 차단 판정
 *
 * 🔴 여기 담긴 4종은 **폐기될 `WorkTimeEditor` 에만 있던 것**이다. Task 5(WorkTimeFields)의
 *    범위가 아니어서 지금 앱 어디에도 없다 — 시트가 붙이지 않으면 기능 후퇴다.
 *      · 총 근무 시간 표시(구 :474-482)
 *      · 12시간 초과 경고(구 `isLongShift`:246-249)
 *      · 시작 == 종료 차단(구 `isValidTimeOrder`:240-243)
 *      · 익일 안내(구 :455-462)
 *
 * 🔑 구 편집기는 'HH:mm' 문자열 축에서 판정했지만(`deriveOvernightPreview`) 이 시트의 실적은
 *    **Date** 다. Date → 'HH:mm' 로 되돌려 판정하면 `applyPickedTime` 이 이미 적용한 익일
 *    보정과 이중으로 얽힌다(02:00 이 이른 새벽인지 익일인지 문자열만 봐선 알 수 없다).
 *    그래서 판정을 **두 Date 의 차이 하나**로 모은다.
 */
import { minutesToLabel } from '@/shared/time';

/** 비차단 강조 경계 — 이 값을 **넘을 때만** 경고한다(정확히 12시간은 정상 근무다). */
const LONG_SHIFT_MINUTES = 12 * 60;

const MINUTE_MS = 60 * 1000;

export interface AttendanceInsight {
  /** 총 근무 시간(분). 산정할 수 없으면 null — 0 으로 단정하지 않는다. */
  durationMinutes: number | null;
  /** 총 근무 시간 라벨('8시간'). 산정 불가면 null. */
  durationLabel: string | null;
  /** 출근 == 퇴근. 24시간 근무가 아니라 **입력 오류**다(구 편집기와 같은 판정). */
  isEqual: boolean;
  /** 퇴근이 출근보다 이르다. 저장되면 음수 근무 시간이 되어 정산이 틀어진다. */
  isReversed: boolean;
  /** 저장을 막아야 하는 상태(isEqual | isReversed). */
  hasBlockingError: boolean;
  /** 퇴근이 출근보다 뒤 달력일 — 안내(비차단). */
  isNextDay: boolean;
  /** 12시간 초과 — 경고(비차단). */
  isLongShift: boolean;
}

const EMPTY: AttendanceInsight = {
  durationMinutes: null,
  durationLabel: null,
  isEqual: false,
  isReversed: false,
  hasBlockingError: false,
  isNextDay: false,
  isLongShift: false,
};

/** 두 Date 가 서로 다른 달력 날짜인가(시각 비교가 아니라 날짜 비교다). */
function isLaterCalendarDay(target: Date, base: Date): boolean {
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const baseDay = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  return targetDay.getTime() > baseDay.getTime();
}

/**
 * 실적 두 값에서 표시·검증에 필요한 파생을 한 번에 구한다.
 *
 * 한쪽이라도 없으면 아무것도 판정하지 않는다 — "출근만 찍힌 근무"는 오류가 아니라
 * 아직 퇴근하지 않은 정상 상태라, 여기서 경고하면 매일 저녁 전 직원이 경고를 본다.
 */
export function deriveAttendanceInsight(
  checkIn: Date | null,
  checkOut: Date | null
): AttendanceInsight {
  if (!checkIn || !checkOut) return EMPTY;

  const diffMs = checkOut.getTime() - checkIn.getTime();
  const isNextDay = isLaterCalendarDay(checkOut, checkIn);

  // 🔴 같음은 24시간이 아니라 오류다. `applyPickedTime` 이 등호를 익일 보정에서 **뺀** 이유가
  //    이 판정을 살려 두기 위해서다 — 여기서 24h 로 접으면 그 설계가 무의미해진다.
  if (diffMs === 0) {
    return { ...EMPTY, isEqual: true, hasBlockingError: true, isNextDay };
  }

  // 퇴근을 먼저 찍고 나중에 출근을 더 늦게 고치면 도달한다(익일 보정은 퇴근을 고를 때만 걸린다).
  if (diffMs < 0) {
    return { ...EMPTY, isReversed: true, hasBlockingError: true, isNextDay };
  }

  const durationMinutes = Math.round(diffMs / MINUTE_MS);

  return {
    durationMinutes,
    durationLabel: minutesToLabel(durationMinutes),
    isEqual: false,
    isReversed: false,
    hasBlockingError: false,
    isNextDay,
    isLongShift: durationMinutes > LONG_SHIFT_MINUTES,
  };
}
