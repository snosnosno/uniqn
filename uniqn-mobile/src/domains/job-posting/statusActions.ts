/**
 * 공고 상태 전이 액션 — 어떤 상태에서 무엇을 할 수 있는지, 그리고 뭐라고 말할지의 단일 소스.
 *
 * @description 종전에는 마감/재오픈이 **목록 화면(`employer.tsx`)에만** 배선돼 있었고,
 *   상세의 `PostingStatusBadge` 는 표시 전용이었다. 상세에서 공고를 마감하려면 목록으로
 *   되돌아가야 했다. 문구도 목록 화면의 ConfirmModal 안에 리터럴로 박혀 있어, 상세에
 *   같은 동작을 붙이면 두 화면이 서로 다른 말을 하게 된다 — 그래서 여기로 끌어냈다.
 */

import type { JobPostingStatus } from '@/types';

/** 상태 뱃지를 눌렀을 때 고를 수 있는 액션. */
export type PostingStatusActionValue = 'close' | 'reopen';

export const POSTING_STATUS_ACTION_TEXT = {
  close: {
    /** ActionSheet 옵션 라벨 */
    sheetLabel: '모집 마감하기',
    /** 목록 화면 확인 모달 (상세는 되돌리기 토스트를 쓰므로 확인을 묻지 않는다) */
    confirmTitle: '공고 마감',
    confirmMessage:
      '이 공고를 마감하시겠습니까? 마감된 공고는 구직자에게 더 이상 노출되지 않습니다.',
    confirmText: '마감하기',
    /** 상세 화면 되돌리기 토스트 */
    undoToastMessage: '공고를 마감했어요. 구직자에게 더 이상 보이지 않습니다.',
  },
  reopen: {
    sheetLabel: '다시 열기',
    confirmTitle: '공고 재오픈',
    confirmMessage:
      '이 공고를 다시 활성화하시겠습니까? 재오픈한 공고는 다시 구직자에게 노출됩니다.',
    confirmText: '재오픈',
    successToastMessage: '공고를 다시 열었어요. 구직자에게 다시 보입니다.',
  },
} as const;

/**
 * 이 상태에서 사장이 **직접** 할 수 있는 상태 전이.
 *
 * @remarks `capacity_full` 은 빈 배열이다 — 정원이 차서 트리거가 자동으로 내린 상태이고,
 *   수동으로 다시 열어도 좌석이 그대로면 트리거가 즉시 되돌린다. 누를 수는 있는데 결과가
 *   되돌아가는 버튼은 없느니만 못하므로 액션 대신 사유(`getPostingStatusActionHint`)만 보여준다.
 *   `draft`/`pending`/`rejected` 는 심사 라인, `cancelled`/`expired` 는 종료 상태라 전이가 없다.
 */
export function selectPostingStatusActions(
  status: JobPostingStatus
): readonly PostingStatusActionValue[] {
  switch (status) {
    case 'active':
    case 'approved':
      return ['close'];
    case 'closed':
      return ['reopen'];
    default:
      return [];
  }
}

/**
 * 액션이 없는 상태에서 **왜 없는지** 한 줄로 설명한다.
 *
 * @remarks 상태 뱃지를 눌렀는데 아무 일도 없으면 사장은 앱이 멈춘 줄 안다. 설명할 말이
 *   있는 상태에서만 뱃지를 누를 수 있게 하고(호출부), 여기 문구를 시트에 띄운다.
 */
export function getPostingStatusActionHint(status: JobPostingStatus): string | null {
  switch (status) {
    case 'capacity_full':
      // 라벨('정원 마감') 자체는 바꾸지 않는다 — 목록 카드와 E2E 가 그 문구를 쓴다.
      return '정원이 차서 자동으로 마감됐어요. 자리가 비면 다시 모집이 시작됩니다.';
    case 'pending':
      return '승인 대기 중이에요. 승인되면 모집이 시작됩니다.';
    case 'rejected':
      return '승인이 반려됐어요. 내용을 수정한 뒤 다시 제출해 주세요.';
    case 'expired':
      return '근무일이 지나 만료됐어요. 같은 조건으로 다시 올릴 수 있어요.';
    case 'cancelled':
      return '취소된 공고예요. 되돌릴 수 없습니다.';
    default:
      return null;
  }
}
