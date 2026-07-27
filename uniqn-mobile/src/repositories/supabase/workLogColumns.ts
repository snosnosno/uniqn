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
  'id,application_id,assignment_group_id,check_in_ts,check_out_ts,color,created_at,custom_allowances,custom_role,custom_salary_info,custom_tax_settings,date,has_time_modification_logs,is_fixed_posting,job_posting_id,modification_history,no_show_at,no_show_reason,notes,owner_id,payroll_amount,payroll_date,payroll_notes,payroll_status,role,role_change_history,settlement_modification_history,staff_id,staff_name,staff_nickname,staff_photo_url,staff_photo_url_blurhash,status,time_slot,updated_at' as const;

/**
 * work_logs 에 **실재하는** 전체 컬럼 (쓰기 검증용 정본)
 *
 * @description `WORK_LOG_COLUMNS`(SELECT 화이트리스트)는 읽지 않는 컬럼을 의도적으로 뺀 목록이라
 *   UPDATE payload 검증에 쓸 수 없다. 이 상수는 실제 스키마 전량이며, 쓰기 경로가 존재하지 않는
 *   컬럼을 보내 PostgREST 가 요청 전체를 거부(PGRST204)하는 사고를 회귀 테스트로 막는 데 쓴다.
 *
 * @remarks 실측 근거 — prod `information_schema.columns` 조회(2026-07-27, 39개).
 *   `settlement_breakdown` 은 **존재하지 않는다**: 두 시간수정 경로가 이 키를 보내
 *   근무 시간 수정이 전량 실패하고 있었다(2026-07-27 감사에서 발견). 정산 내역은 DB 컬럼이
 *   아니라 `ScheduleConverter` 가 읽기 시점에 계산하는 파생값이다.
 * @remarks 컬럼을 추가하는 마이그레이션을 넣으면 여기도 같이 갱신한다.
 */
export const WORK_LOG_ALL_COLUMNS: readonly string[] = [
  'application_id',
  'assignment_group_id',
  'check_in_ts',
  'check_out_ts',
  'clocked_out_raw',
  'color',
  'created_at',
  'custom_allowances',
  'custom_role',
  'custom_salary_info',
  'custom_tax_settings',
  'date',
  'edited_by',
  'end_time_source',
  'has_time_modification_logs',
  'id',
  'is_fixed_posting',
  'job_posting_id',
  'modification_history',
  'no_show_at',
  'no_show_reason',
  'notes',
  'owner_id',
  'payroll_amount',
  'payroll_date',
  'payroll_notes',
  'payroll_status',
  'role',
  'role_change_history',
  'settlement_modification_history',
  'staff_id',
  'staff_name',
  'staff_nickname',
  'staff_photo_url',
  'staff_photo_url_blurhash',
  'status',
  'time_slot',
  'updated_at',
  'work_duration',
] as const;

// Phase D: jsonb 컬럼 제거 후 checkInTs/checkOutTs (timestamptz, PostgREST ISO string) 단일 소스.
export function applyTsPreference(camel: Record<string, unknown>): Record<string, unknown> {
  return {
    ...camel,
    checkInTime: camel.checkInTs ?? null,
    checkOutTime: camel.checkOutTs ?? null,
  };
}
