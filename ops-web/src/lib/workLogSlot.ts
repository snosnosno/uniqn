/**
 * 근무 기록 슬롯 편집(웹 소유) — 모바일 `services/workSchedule/gridWriteService.updateSlot` →
 * `WorkLogRepositoryVenue.updateSlot` 중 **ops 근태 기록이 쓰는 축만**(checkIn·checkOut·reason·editedBy).
 * 동기화 사본 `core/services/ops/opsStaffService.ts` 가 REMAP 으로 이 모듈을 쓴다.
 *
 * 🔴 `work_logs` 직접 PATCH 금지 — 반드시 `update_work_log_slot`(SECDEF RPC). 감사·수정 이력·알림·
 *    정산 완료 잠금이 전부 서버 안에서 처리된다.
 * 🔴 3상 계약: `undefined`=키 없음(미변경) / `null`=기록 삭제 / `Date`=기록. truthy 판정 금지.
 */
import { supabase } from './supabase';
import { handleSupabaseError } from './supabaseUtils';
import { toSlotPatch, toUpdateSlotError, type OpsSlotPatch } from './workLogSlotMapping';

export type { OpsSlotPatch };

export async function updateSlot(workLogId: string, input: OpsSlotPatch): Promise<void> {
  const { error } = await supabase.rpc('update_work_log_slot', {
    p_work_log_id: workLogId,
    p_patch: toSlotPatch(input),
  });
  if (error) {
    const mapped = toUpdateSlotError(error);
    if (mapped) throw mapped;
    handleSupabaseError(error, { operation: '근태 기록', table: 'work_logs' });
  }
}
