/**
 * useNotifyWeeklyBatchConfirm — "이번 주 배치 확인" 알림 발송 변이 훅(TanStack useMutation).
 *
 * mutationFn 은 Service(notifyWeeklyBatchConfirm) 경유(컨테이너 운영자 해소 + notifications 직접 INSERT).
 * 알림은 그리드 읽기 데이터를 바꾸지 않으므로 쿼리 무효화는 없다(fire-and-forget).
 * 토스트/낙관 UI 는 호출부 책임(훅은 변이만). 운영자 미해소 시 결과 sent=false(에러 아님).
 */
import { useMutation } from '@tanstack/react-query';
import {
  notifyWeeklyBatchConfirm,
  type NotifyWeeklyBatchConfirmResult,
} from '@/services/weeklyGrid/weeklyBatchNotificationService';

export interface NotifyWeeklyBatchConfirmVars {
  /** 운영처가 속한 워크스페이스 id */
  workspaceId: string;
  /** 운영처 컨테이너 id(= venueId) */
  venueId: string;
  /** 주차 라벨(예: '6월 29일 주간') — 내부 생성, 비-PII */
  weekLabel: string;
}

export function useNotifyWeeklyBatchConfirm() {
  return useMutation<NotifyWeeklyBatchConfirmResult, Error, NotifyWeeklyBatchConfirmVars>({
    mutationFn: ({ workspaceId, venueId, weekLabel }) =>
      notifyWeeklyBatchConfirm(workspaceId, venueId, weekLabel),
  });
}

export default useNotifyWeeklyBatchConfirm;
