/**
 * 입력 화면(근무표·정산)이 공유하는 익일 판정 + duration 프리뷰 순수 헬퍼.
 * 저장/표시의 진실 소스는 여전히 parseTimeSlotToDate + WorkTimeDisplay 다.
 * 이 헬퍼는 "입력 중"에 익일 여부·근무시간을 즉시 보여주기 위한 파생만 담당한다.
 */
const TIME_RE = /^(\d{1,2}):(\d{2})$/;
const MINUTES_PER_DAY = 24 * 60;

export interface OvernightPreview {
  valid: boolean;
  isNextDay: boolean;
  /** 시작 == 종료(같은 시각). 검증 오류 대상 — 24시간 근무 해석 안 함. */
  isEqual: boolean;
  durationMinutes: number;
  durationLabel: string;
}

const INVALID: OvernightPreview = {
  valid: false,
  isNextDay: false,
  isEqual: false,
  durationMinutes: 0,
  durationLabel: '-',
};

function parseMinutes(time: string): number | null {
  const m = time.match(TIME_RE);
  if (!m) return null;
  const hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  if (hour < 0 || hour > 47 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

/**
 * 근무 시간 라벨('8시간' · '4시간 30분'). 0 이하는 '-' 로 — 산정 불가와 0분을 같은 자리에 둔다.
 *
 * 🔑 export 인 이유: 통합 편집 시트(workLogEdit)는 실적을 'HH:mm' 이 아니라 **Date** 로 다뤄
 *    `deriveOvernightPreview` 를 그대로 쓸 수 없다. 그렇다고 라벨 포맷을 한 벌 더 만들면
 *    같은 화면의 두 배너가 서로 다른 표기('8시간' vs '8h')로 갈릴 수 있다 — 문자열만 공유한다.
 */
export function minutesToLabel(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours > 0 && minutes > 0) return `${hours}시간 ${minutes}분`;
  if (hours > 0) return `${hours}시간`;
  if (minutes > 0) return `${minutes}분`;
  return '-';
}

export function deriveOvernightPreview(startTime: string, endTime: string): OvernightPreview {
  const start = parseMinutes(startTime);
  const end = parseMinutes(endTime);
  if (start === null || end === null) return INVALID;

  const isEqual = end < MINUTES_PER_DAY && end === start;
  // 시작==종료는 검증 오류 상태 — 24시간으로 해석하지 않고 duration 미산정.
  if (isEqual) {
    return {
      valid: true,
      isNextDay: false,
      isEqual: true,
      durationMinutes: 0,
      durationLabel: '-',
    };
  }

  let endEffective = end;
  let isNextDay = false;
  if (end >= MINUTES_PER_DAY) {
    // 24+ 표기 = 이미 익일
    isNextDay = true;
  } else if (end <= start) {
    endEffective = end + MINUTES_PER_DAY;
    isNextDay = true;
  }

  const durationMinutes = endEffective - start;
  return {
    valid: true,
    isNextDay,
    isEqual,
    durationMinutes,
    durationLabel: minutesToLabel(durationMinutes),
  };
}
