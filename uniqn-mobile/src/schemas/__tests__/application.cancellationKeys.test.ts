/**
 * CANCEL-1 회귀 — 취소 승인 직후 지원서가 목록에서 통째로 증발하던 결함
 *
 * @description `cancel_application_atomically` 의 취소요청 승인 분기가
 *   `jsonb_build_object('status','approved','reviewed_at',…, 'reviewed_by',…)` 로 **snake_case** 를
 *   쓴다(20260711020000_cancel_application_employer_initiates.sql:106). 그런데 읽기 스키마의
 *   'approved' 분기는 `reviewedAt`/`reviewedBy`(camelCase)를 필수로 요구했다.
 *
 *   `toCamelCase` 는 **얕은** 변환이라(utils/supabase.ts:727 값을 그대로 복사) 중첩 JSONB 의
 *   키는 snake_case 로 남는다. 그래서 discriminated union 이 실패하고,
 *   `cancellationRequest` 가 `applicationDocumentSchema` 의 필드라 **지원서 객체 전체**의
 *   safeParse 가 깨져 `rowsToApplications` 가 그 행을 버렸다(Helpers.ts:65).
 *
 *   마이그레이션으로 RPC 를 고쳐도 이미 저장된 행은 남으므로, 읽기 스키마가 두 표기를 모두
 *   받아들이는 것이 근본 복구다.
 */

import { cancellationRequestStoredSchema } from '../application.schema';

const REQUESTED_AT = '2026-07-01T09:00:00.000Z';
const REVIEWED_AT = '2026-07-02T09:00:00.000Z';

describe('cancellationRequestStoredSchema — RPC 의 snake_case 승인 키 수용', () => {
  it('승인 건이 snake_case 로 저장돼 있어도 파싱된다 (프로덕션 실제 형태)', () => {
    const parsed = cancellationRequestStoredSchema.safeParse({
      status: 'approved',
      requestedAt: REQUESTED_AT,
      reason: '개인 사정',
      reviewed_at: REVIEWED_AT,
      reviewed_by: 'employer-1',
    });

    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.status === 'approved') {
      expect(parsed.data.reviewedAt).toBe(REVIEWED_AT);
      expect(parsed.data.reviewedBy).toBe('employer-1');
    }
  });

  it('camelCase 로 저장된 건도 그대로 파싱된다 (마이그레이션 이후 형태)', () => {
    const parsed = cancellationRequestStoredSchema.safeParse({
      status: 'approved',
      requestedAt: REQUESTED_AT,
      reason: '개인 사정',
      reviewedAt: REVIEWED_AT,
      reviewedBy: 'employer-1',
    });

    expect(parsed.success).toBe(true);
  });

  it('camelCase 가 있으면 snake_case 보다 우선한다', () => {
    const parsed = cancellationRequestStoredSchema.safeParse({
      status: 'approved',
      requestedAt: REQUESTED_AT,
      reason: '개인 사정',
      reviewedAt: REVIEWED_AT,
      reviewedBy: 'canonical',
      reviewed_by: 'legacy',
    });

    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.status === 'approved') {
      expect(parsed.data.reviewedBy).toBe('canonical');
    }
  });

  it('거절 건의 snake_case 키도 함께 수용한다', () => {
    const parsed = cancellationRequestStoredSchema.safeParse({
      status: 'rejected',
      requestedAt: REQUESTED_AT,
      reason: '개인 사정',
      reviewed_at: REVIEWED_AT,
      reviewed_by: 'employer-1',
      rejection_reason: '대체 인력이 없습니다',
    });

    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.status === 'rejected') {
      expect(parsed.data.rejectionReason).toBe('대체 인력이 없습니다');
    }
  });

  it('대기 건은 종전대로 파싱된다', () => {
    expect(
      cancellationRequestStoredSchema.safeParse({
        status: 'pending',
        requestedAt: REQUESTED_AT,
        reason: '개인 사정',
      }).success
    ).toBe(true);
  });

  it('필수 키가 아예 없으면 여전히 실패한다 (관용이 검증을 무력화하지 않는다)', () => {
    expect(
      cancellationRequestStoredSchema.safeParse({
        status: 'approved',
        requestedAt: REQUESTED_AT,
        reason: '개인 사정',
      }).success
    ).toBe(false);
  });

  it('객체가 아닌 값은 그대로 실패한다', () => {
    expect(cancellationRequestStoredSchema.safeParse('oops').success).toBe(false);
    expect(cancellationRequestStoredSchema.safeParse(null).success).toBe(false);
  });
});
