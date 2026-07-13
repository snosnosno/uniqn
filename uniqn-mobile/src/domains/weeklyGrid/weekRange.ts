/**
 * weekRange — 주간 액션(지난주 복사/배치 확인 알림) 대상 주 계산 SSOT(P0-4).
 *
 * 선택일이 속한 주(월요일 시작 ~ 일요일 끝, weekStartsOn=1 — 그리드 요일 정합)를 계산한다.
 * label 은 알림(weeklyBatchNotification.weekLabel)이 쓰는 기존 형식("M월 d일 주간")을 그대로
 * 유지하고, rangeLabel 은 화면 표기용("6/29(월) ~ 7/5(일)"). 두 소비처(화면·알림)가 이 SSOT 를
 * 공유해 "어느 주를 대상으로 하는지"가 어긋날 수 없다.
 */
import { addDays, format, startOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale/ko';

export interface WeekRange {
  /** 주 시작(월요일 00:00 로컬). */
  start: Date;
  /** 주 끝(일요일, start+6일). */
  end: Date;
  /** 알림용 라벨(기존 형식 유지): "6월 29일 주간" */
  label: string;
  /** 화면 표기용 범위: "6/29(월) ~ 7/5(일)" */
  rangeLabel: string;
}

/** 선택일이 속한 주(월~일)의 경계·라벨. */
export function getWeekRange(date: Date): WeekRange {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = addDays(start, 6);
  return {
    start,
    end,
    label: `${format(start, 'M월 d일', { locale: ko })} 주간`,
    rangeLabel: `${format(start, 'M/d(E)', { locale: ko })} ~ ${format(end, 'M/d(E)', { locale: ko })}`,
  };
}
