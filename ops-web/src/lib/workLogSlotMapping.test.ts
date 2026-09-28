import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '@/core/errors/AppError';
import { toSlotPatch, toUpdateSlotError } from './workLogSlotMapping';

describe('toSlotPatch — 3상 계약', () => {
  it('undefined 는 키가 없고, null 은 삭제로 남는다', () => {
    expect(toSlotPatch({})).toEqual({});
    expect(toSlotPatch({ checkIn: null })).toEqual({ checkIn: null });
    expect(toSlotPatch({ checkOut: new Date('2026-09-28T01:00:00Z'), reason: 'r' })).toEqual({
      checkOut: '2026-09-28T01:00:00.000Z',
      reason: 'r',
    });
  });
});

describe('toUpdateSlotError — 모바일과 같은 분기', () => {
  it('정산 잠금은 되돌리기 경로를 알려 주는 단일 문구', () => {
    const e = toUpdateSlotError({ message: 'ALREADY_SETTLED: x' });
    expect(e?.code).toBe(ERROR_CODES.BUSINESS_ALREADY_SETTLED);
    expect(e?.userMessage).toContain('정산을 되돌린 뒤 다시 시도');
  });

  it('권한 거부는 서버 문장을 보인다', () => {
    expect(toUpdateSlotError({ message: 'PERMISSION_DENIED: 공고 권한 없음' })?.userMessage).toBe(
      '공고 권한 없음'
    );
  });

  it('데드락은 재시도 안내', () => {
    expect(toUpdateSlotError({ code: '40P01', message: 'x' })?.userMessage).toContain('다시 시도');
  });

  it('모르는 에러는 null(표준 핸들러로)', () => {
    expect(toUpdateSlotError({ message: 'boom' })).toBeNull();
  });
});
