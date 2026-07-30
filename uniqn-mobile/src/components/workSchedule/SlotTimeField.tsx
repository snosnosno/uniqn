/**
 * SlotTimeField — 배치 시간 입력 공용 변환 헬퍼('HH:mm' ↔ TimeValue ↔ 표시 문구).
 *
 * 근무표 두 시트(AddSlotSheet·EditSlotSheet)와 공고 경로(AddStaffModal)가 공유한다.
 * 트리거 UI 자체는 `StartTimeField`(단일 시각 + '미정' 토글) 하나로 통일했다 —
 * 예정 종료가 사라지면서(§K) 시작/종료 두 칸을 그리던 `TimeTriggerField` 는 소비처가 없어졌다.
 * 이 화면들은 0~23 표기만 사용한다(다음날 24+ 미표기).
 */
import type { TimeValue } from '@/components/ui/TimeWheelPicker';

const TIME_RE = /^(\d{1,2}):(\d{2})$/;

/** 'HH:mm' → TimeValue{hour,minute}. 0~23 표기만 사용(범위 밖/오형식은 0시 0분). */
export function timeStringToValue(time: string): TimeValue {
  const match = time.match(TIME_RE);
  if (!match) return { hour: 0, minute: 0 };
  const hour = Math.min(23, Math.max(0, parseInt(match[1], 10)));
  const minute = parseInt(match[2], 10);
  return { hour, minute };
}

/** TimeValue{hour,minute} → 'HH:mm'(0패딩). */
export function timeValueToString({ hour, minute }: TimeValue): string {
  const h = hour.toString().padStart(2, '0');
  const m = minute.toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** 'HH:mm' → '오전/오후 H:mm'(TimePicker formatTimeDisplay 동등 포맷). */
export function formatTimeDisplay(time: string): string {
  const match = time.match(TIME_RE);
  if (!match) return time || '시간 선택';
  const hour = parseInt(match[1], 10);
  const minutes = match[2];
  const period = hour < 12 ? '오전' : '오후';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${period} ${displayHour}:${minutes}`;
}
