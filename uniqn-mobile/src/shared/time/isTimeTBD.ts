import { FIXED_TIME_MARKER, TBA_TIME_MARKER } from '@/types/assignment';

/**
 * "출근 예정 시각이 아직 정해지지 않았다"는 판정의 **단일 근거**.
 *
 * 비유: 가게 문에 붙일 오픈 시간 안내문이 아직 비어 있는 상태다. 누군가 연필로 "미정"이라
 * 적었든, 예전 양식대로 "NEGOTIABLE"이라 적었든, 아예 빈칸이든 — 손님이 읽는 사실은 하나다.
 *
 * ## 판정 집합이 이 값들인 이유
 * 서버가 흡수하는 센티널 집합과 **정확히 같아야** 한다. 클라가 더 넓게(또는 좁게) 접으면
 * 공고 측 슬롯 키와 지원서/work_log 측 키가 갈리고, 정원 조회가 0행을 내며 표시 인원이
 * 조용히 0 이 된다(R0 마이그레이션 `20260803120000` 이 서버 측에서 없앤 바로 그 분열이다).
 *
 * 서버 실측(prod, R0 적용 후 직접 프로브):
 * - `_normalize_time_slot`: `NULL`·`''`·`'미정'`·`'NEGOTIABLE'` → `NULL`
 * - `_posting_slot_key`   : 같은 4종 → `'미정'`
 * - 해석 불가 자유텍스트(`'협의'`·`'- 18:00'`)는 **원문 그대로 통과** — 미정으로 삼키지 않는다.
 *
 * ⚠️ 전환기 규약: 이 함수는 **읽기(판정)** 전용이다. 서버로 보내는 값은 여전히
 * `TBA_TIME_MARKER`(`'미정'`) 문자열이다 — null 을 쓰면 구버전 사장 앱의 엄격한 zod
 * (`timeSlot: z.string()`)가 지원서 레코드를 통째로 증발시킨다. null 쓰기 전환은 R3 의 일이다.
 *
 * @param value 판정할 시간 문자열(`work_logs.time_slot` · `assignment.timeSlot` · 슬롯 `startTime`)
 * @returns 시각이 정해지지 않았으면 true
 */
export function isTimeTBD(value: string | null | undefined): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  // 서버 `btrim` 과 동일하게 앞뒤 공백을 걷어낸 뒤 비교한다.
  const trimmed = value.trim();

  return trimmed === '' || trimmed === TBA_TIME_MARKER || trimmed === FIXED_TIME_MARKER;
}
