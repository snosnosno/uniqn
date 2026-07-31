/**
 * workLogColumns — SELECT 화이트리스트 정본·ts 선호 매핑 드리프트 가드 (review 후속)
 *
 * @description work_logs 컬럼 리터럴(WORK_LOG_COLUMNS)과 소비 리포의 재노출이 동기화돼
 *              있는지, applyTsPreference 의 checkInTs/checkOutTs → checkInTime/checkOutTime
 *              승격·폴백 계약이 유지되는지 회귀 검증한다. 자체 사본이 생기면
 *              whitelist-silent-drop(조용한 읽기 증발)으로 드리프트하므로 정본 1개만 삼는다.
 *
 * 동작 변경 없음 — 현재 계약을 그대로 고정한다.
 */

import { WORK_LOG_COLUMNS, applyTsPreference } from '../workLogColumns';
import { TABLE_COLUMNS as WORK_LOG_HELPER_COLUMNS } from '../WorkLogRepositoryHelpers';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    channel: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@sentry/react-native', () => ({
  __esModule: true,
  addBreadcrumb: jest.fn(),
}));

describe('WORK_LOG_COLUMNS — SELECT 화이트리스트 정본', () => {
  const columns = WORK_LOG_COLUMNS.split(',');

  it('work_logs 핵심 컬럼을 화이트리스트에 포함한다', () => {
    for (const core of [
      'id',
      'check_in_ts',
      'check_out_ts',
      'staff_id',
      'status',
      'date',
      'job_posting_id',
    ]) {
      expect(columns).toContain(core);
    }
  });

  // 출처 배지(QR/수정됨)의 유일한 근거. 빠지면 값이 DB 에 있어도 클라까지 오지 않아
  // 배지가 조용히 사라진다(whitelist-silent-drop).
  it('퇴근 시각 출처 컬럼(end_time_source)을 화이트리스트에 포함한다', () => {
    expect(columns).toContain('end_time_source');
  });

  it('Phase D 폐지된 jsonb 컬럼명(check_in_time/check_out_time)은 화이트리스트에 없다', () => {
    // ts 단일소스 전환 회귀 — 옛 jsonb 컬럼이 되살아나면 RED
    expect(columns).not.toContain('check_in_time');
    expect(columns).not.toContain('check_out_time');
  });

  it('WorkLogRepositoryHelpers.TABLE_COLUMNS 는 정본을 그대로 재노출한다 (드리프트 금지)', () => {
    expect(WORK_LOG_HELPER_COLUMNS).toBe(WORK_LOG_COLUMNS);
  });
});

describe('applyTsPreference — ts 우선 매핑·폴백 계약', () => {
  it('checkInTs/checkOutTs 가 있으면 checkInTime/checkOutTime 으로 승격하고 원본 키는 보존한다', () => {
    const result = applyTsPreference({
      checkInTs: '2026-07-01T09:00:00.000Z',
      checkOutTs: '2026-07-01T18:00:00.000Z',
      staffId: 's1',
    });

    expect(result.checkInTime).toBe('2026-07-01T09:00:00.000Z');
    expect(result.checkOutTime).toBe('2026-07-01T18:00:00.000Z');
    // 스프레드로 원본 키를 유지한다
    expect(result.staffId).toBe('s1');
    expect(result.checkInTs).toBe('2026-07-01T09:00:00.000Z');
    expect(result.checkOutTs).toBe('2026-07-01T18:00:00.000Z');
  });

  it('checkInTs/checkOutTs 가 없으면 checkInTime/checkOutTime 은 null 로 폴백한다', () => {
    const result = applyTsPreference({ staffId: 's2' });

    expect(result.checkInTime).toBeNull();
    expect(result.checkOutTime).toBeNull();
  });

  it('checkInTs/checkOutTs 가 null 이면 그대로 null 로 폴백한다', () => {
    const result = applyTsPreference({ checkInTs: null, checkOutTs: null });

    expect(result.checkInTime).toBeNull();
    expect(result.checkOutTime).toBeNull();
  });
});
