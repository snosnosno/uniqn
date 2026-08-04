/**
 * useUpdateSlot — 배치 슬롯 편집(시간·역할·색상·메모) 변이 훅(TanStack useMutation).
 *
 * mutationFn 은 Service(gridWriteService.updateSlot) 경유(아키텍처 Hook→Service→Repository).
 * 색상 화이트리스트·메모 XSS 검증은 레포 경계가 담당. onSuccess: workSchedule prefix(workSchedule.all)
 * 일괄 invalidate → daySlots/summary 재조회. 토스트/낙관 UI 는 호출부 책임(훅은 변이만).
 *
 * 🔑 `applications` 도 함께 무효화한다. 저장이 서버 RPC `update_work_log_slot` 으로 바뀌면서
 *    이 변이는 `work_logs` 뿐 아니라 `applications.assignments[]` 도 갱신한다 —
 *    전환 전에는 applications 가 아예 안 바뀌어 무효화가 필요 없었지만, 이제는 지원자 목록·
 *    상세 화면이 옛 배정 시각/역할을 그대로 들고 있게 된다.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { updateSlot } from '@/services/workSchedule/gridWriteService';
import type { UpdateSlotInput } from '@/repositories';

/** 슬롯 편집 변이 변수. */
export interface UpdateSlotVars {
  workLogId: string;
  input: UpdateSlotInput;
}

export function useUpdateSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ workLogId, input }: UpdateSlotVars) => updateSlot(workLogId, input),
    onSuccess: () => {
      // summary/daySlots 공통 prefix 무효화 → 편집 결과(시간/역할/색상/메모) 재조회.
      qc.invalidateQueries({ queryKey: queryKeys.workSchedule.all });
      // RPC 가 같은 트랜잭션에서 applications.assignments 도 갱신하므로 그 캐시도 함께 버린다.
      qc.invalidateQueries({ queryKey: queryKeys.applications.all });
      // 🔑 확정 스태프 목록도 `timeSlot` 을 싣는다 — 버리지 않으면 공고 상세가 옛 시각을 남긴다.
      //    (3-C 리뷰에서 드러난 선재 누락. 일괄 변경 훅과 함께 메운다.)
      qc.invalidateQueries({ queryKey: queryKeys.confirmedStaff.all });
    },
  });
}
