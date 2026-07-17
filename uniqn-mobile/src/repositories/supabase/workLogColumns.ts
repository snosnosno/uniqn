/**
 * UNIQN Mobile - work_logs SELECT 화이트리스트 · ts 선호 매핑 단일소스
 *
 * @description work_logs 컬럼 리터럴과 checkInTs/checkOutTs → 도메인 매핑을
 *   여러 리포지토리(WorkLog/Settlement/ConfirmedStaff)에서 공유한다.
 *   자체 사본을 두면 컬럼 추가 시 조용한 읽기 증발(whitelist-silent-drop)로
 *   드리프트하므로, 이 모듈만 정본으로 삼는다.
 */

// work_logs SELECT 컬럼 화이트리스트(정본). 컬럼 추가/삭제는 여기서만.
export const WORK_LOG_COLUMNS =
  'id,application_id,assignment_group_id,check_in_ts,check_out_ts,created_at,custom_allowances,custom_role,custom_salary_info,custom_tax_settings,date,has_time_modification_logs,is_fixed_posting,job_posting_id,modification_history,no_show_at,no_show_reason,notes,owner_id,payroll_amount,payroll_date,payroll_notes,payroll_status,role,role_change_history,settlement_modification_history,staff_id,staff_name,staff_nickname,staff_photo_url,staff_photo_url_blurhash,status,time_slot,updated_at' as const;

// Phase D: jsonb 컬럼 제거 후 checkInTs/checkOutTs (timestamptz, PostgREST ISO string) 단일 소스.
export function applyTsPreference(camel: Record<string, unknown>): Record<string, unknown> {
  return {
    ...camel,
    checkInTime: camel.checkInTs ?? null,
    checkOutTime: camel.checkOutTs ?? null,
  };
}
