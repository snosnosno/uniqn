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
 *
 * 🔴 `settlement`·`workLogs` 도 버린다. 통합 편집 시트가 이 훅으로 **실적(check_in/out)** 을
 *    쓰게 되면서 이 변이의 파장이 정산 금액의 **입력**까지 닿았다. 두 키를 남기면 정산 상세에서
 *    퇴근을 고쳐 저장했을 때 서버 값은 맞게 바뀌는데 화면 숫자만 옛 값으로 남는다
 *    (돈이 걸린 화면에서 가장 나쁜 종류의 불일치 — 사용자는 저장이 안 먹혔다고 읽는다).
 *
 * 🔴 `postingFilledCounts` 도 버린다. **역할 축이 이 훅으로 넘어왔기 때문이다.** 이 키는
 *    `queryKeys.*` 트리 밖의 단독 접두사라 위 다섯 개 어디에도 안 걸린다(`postingFilledCountsKey.ts`).
 *    빠뜨리면 역할 변경 저장 직후 시트를 다시 열었을 때 마감 판정이 옛 분포로 계산돼
 *    **`(마감)` 표기가 거짓말한다** — D7 이 "막지 않고 표기만 한다"고 정한 바로 그 표기다.
 *    폐지된 구 역할 변경 경로(`useConfirmedStaff` changeRoleMutation)가 같은 이유로 이 키를 버렸다.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { POSTING_FILLED_COUNTS_QUERY_KEY } from '@/hooks/postingFilledCountsKey';
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
      // 🔴 실적을 쓰는 순간 정산 금액의 입력이 바뀐다 — 정산 목록·상세·근무 기록 캐시도 버린다.
      qc.invalidateQueries({ queryKey: queryKeys.settlement.all });
      qc.invalidateQueries({ queryKey: queryKeys.workLogs.all });
      // 🔴 역할이 바뀌면 역할별 확정 분포가 바뀐다 — 마감 판정 소스를 버리지 않으면 `(마감)` 이 stale.
      qc.invalidateQueries({ queryKey: [POSTING_FILLED_COUNTS_QUERY_KEY] });
    },
  });
}
