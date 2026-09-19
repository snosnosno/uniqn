/**
 * ScheduleDatesSheet — 주문서 날짜 시트 (DatePickerModal 얇은 래핑)
 *
 * @description **전 일정 스코프**로 날짜만 고른다. 구 3지 세그먼트("모든 날짜 같은 조건 /
 * 연속 날짜 묶음 지원 / 날짜마다 따로")는 제거됐다 — 그건 저장 형식에 존재하지 않는 개념
 * (그룹 선택)을 조건 입력 **전에** 묻는 질문이었고, 실사용자가 두 번 "이거 사실상 같은 거
 * 아니야?"를 물은 지점이다.
 *
 * 이제 그룹은 조건 시그니처로 도출되고(`normalizeScheduleGroups`), 묶음지원은 결과가 눈에
 * 보이는 자리(조건 카드 안의 연속 run 토글)에서 켠다. 이 시트가 하는 일은 날짜 선택뿐이다.
 */
import React from 'react';
import { DatePickerModal } from '@/components/employer/job-form/modals/DatePickerModal';
import type { PostingType } from '@/types/jobPosting';

export interface ScheduleDatesSheetProps {
  visible: boolean;
  postingType: PostingType;
  /** 현재 담긴 전 일정 날짜(재선택·해제 가능 시드). 빈 배열로 확정하면 일정을 비운다. */
  initialSelectedDates: string[];
  onConfirm: (dates: string[]) => void;
  onClose: () => void;
}

export function ScheduleDatesSheet({
  visible,
  postingType,
  initialSelectedDates,
  onConfirm,
  onClose,
}: ScheduleDatesSheetProps) {
  return (
    <DatePickerModal
      visible={visible}
      onClose={onClose}
      postingType={postingType}
      initialSelectedDates={initialSelectedDates}
      onSelectDates={onConfirm}
    />
  );
}
