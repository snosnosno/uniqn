import { TimeNormalizer, type TimeInput } from '@/shared/time';
import { formatDateShortWithDay } from '@/utils/date';

export function formatTime(value: TimeInput): string {
  const date = TimeNormalizer.parseTime(value);
  if (!date) return '--:--';

  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatDate(dateString: string): string {
  if (!dateString) return '-';

  const formatted = formatDateShortWithDay(dateString);
  return formatted === '-' ? dateString : formatted;
}

// ============================================================================
// 다음 근무 상대 시간 — "지금 나한테 얼마나 급한가"
// ============================================================================

export type NextShiftUrgency = 'working' | 'imminent' | 'today' | 'upcoming';

export interface NextShiftCountdown {
  /** 화면에 그대로 쓰는 한글 라벨 */
  label: string;
  /** 강조 수위 결정용 */
  urgency: NextShiftUrgency;
}

/** 자정 기준 남은 일수. 시각이 아니라 '날짜'로 세어 D-1 이 직관과 어긋나지 않게 한다. */
function daysUntil(shiftDate: string, nowDate: string): number {
  const toUtc = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    return Date.UTC(year, (month ?? 1) - 1, day ?? 1);
  };
  return Math.round((toUtc(shiftDate) - toUtc(nowDate)) / (24 * 60 * 60 * 1000));
}

/**
 * 다음 근무까지 남은 시간을 사람이 읽는 문장으로.
 *
 * 근무 직전에 앱을 켜는 단발 알바에게 "2026-08-03 20:00" 보다
 * "3시간 후 출근"·"D-3"이 먼저 답이 된다.
 *
 * @param shiftDate  근무일 (YYYY-MM-DD)
 * @param startAt    근무 시작 시각 (없으면 시간 미정 취급)
 * @param now        현재 시각
 * @param isWorking  이미 출근 처리된 상태인지
 */
export function describeNextShiftCountdown(
  shiftDate: string,
  startAt: Date | null,
  now: Date,
  isWorking: boolean
): NextShiftCountdown {
  if (isWorking) {
    return { label: '근무 중', urgency: 'working' };
  }

  const nowDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
  const dayGap = daysUntil(shiftDate, nowDate);

  if (dayGap > 0) {
    return { label: `D-${dayGap}`, urgency: 'upcoming' };
  }

  // 오늘(또는 이미 지난 날) 근무 — 시작 시각이 있으면 시/분 단위로 답한다.
  if (startAt) {
    const diffMinutes = Math.round((startAt.getTime() - now.getTime()) / 60_000);

    if (diffMinutes <= 0) {
      return { label: '출근 시간이에요', urgency: 'imminent' };
    }
    if (diffMinutes < 60) {
      return { label: `${diffMinutes}분 후 출근`, urgency: 'imminent' };
    }
    const hours = Math.floor(diffMinutes / 60);
    return { label: `${hours}시간 후 출근`, urgency: hours <= 3 ? 'imminent' : 'today' };
  }

  return { label: dayGap === 0 ? '오늘 근무' : '지난 근무', urgency: 'today' };
}

// ============================================================================
// 근무 시간 범위 표기 — 카드·상세가 같은 문장을 쓰게 하는 단일 출처
// ============================================================================

/**
 * 근무 시간 범위를 사람이 읽는 한 문장으로.
 *
 * 예전엔 호출부마다 표기가 달랐다 — 지원 카드는 시작 시각만 보여주고, 파싱 실패 시
 * `formatTime` 의 '--:--' 가 그대로 노출됐으며, 자정을 넘는 근무의 '익일' 표기는
 * 그룹 카드에만 있고 단일 카드·상세 탭에는 없었다.
 *
 * @param info WorkTimeDisplay.getDisplayInfo 결과
 * @param useEffective 실제 출퇴근 시각을 우선할지(true) 예정 시각을 볼지(false)
 */
export function formatWorkTimeRange(
  info: {
    effectiveStart: string;
    effectiveEnd: string;
    scheduledStart: string;
    scheduledEnd: string;
    isEndNextDay: boolean;
  },
  useEffective = true
): string {
  const start = useEffective ? info.effectiveStart : info.scheduledStart;
  const end = useEffective ? info.effectiveEnd : info.scheduledEnd;

  // '미정'/'--:--' 을 그대로 노출하지 않는다 — 시간이 안 정해진 공고라는 뜻이지
  // 데이터가 깨진 게 아니다.
  const isUnset = (value: string) => !value || value === '미정' || value === '--:--';

  if (isUnset(start) && isUnset(end)) return '시간 협의';
  if (isUnset(end)) return `${start} 시작`;
  if (isUnset(start)) return `${end} 종료`;

  return info.isEndNextDay ? `${start} – 익일 ${end}` : `${start} – ${end}`;
}
