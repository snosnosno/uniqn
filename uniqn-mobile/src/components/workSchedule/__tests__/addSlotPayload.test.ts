/**
 * addSlotPayload 빌더 테스트 — 추가 시트(B1) write 경계 순수 함수.
 *
 * 검증 포인트: 단일 assignment 구성 · E5 날짜 정규화 · role==='other' 분기 ·
 * customRole S1 XSS 거부 · 필수값/날짜 검증.
 * (출근시간 단일 입력·미정·형식 검증은 addSlotPayload.startTime.test.ts 참조)
 */
import { buildAddSlotPayload } from '../addSlotPayload';
import { ValidationError } from '@/errors';

describe('buildAddSlotPayload', () => {
  const base = {
    containerId: 'container-1',
    staffId: 'staff-1',
    date: '2026-06-29',
    role: 'dealer',
  };

  it('컨테이너 job_posting_id·staffId·단일 assignment 를 만든다', () => {
    expect(buildAddSlotPayload(base)).toEqual({
      jobPostingId: 'container-1',
      staffId: 'staff-1',
      assignments: [{ date: '2026-06-29', role: 'dealer' }],
    });
  });

  it('E5: Date 객체 날짜를 YYYY-MM-DD 로 정규화한다(write 경계)', () => {
    // 로컬 6월 29일 — tz 무관 결정성을 위해 date-only 로컬 Date 사용
    const payload = buildAddSlotPayload({ ...base, date: new Date(2026, 5, 29) });
    expect(payload.assignments[0]!.date).toBe('2026-06-29');
  });

  it("role==='other' 일 때만 customRole 을 동봉한다", () => {
    const withOther = buildAddSlotPayload({ ...base, role: 'other', customRole: '칩 러너' });
    expect(withOther.assignments[0]).toEqual({
      date: '2026-06-29',
      role: 'other',
      customRole: '칩 러너',
    });

    const nonOther = buildAddSlotPayload({ ...base, role: 'dealer', customRole: '무시됨' });
    expect(nonOther.assignments[0]).not.toHaveProperty('customRole');
  });

  it('S1: customRole(other) 에 XSS 패턴이 있으면 ValidationError 를 던진다', () => {
    expect(() =>
      buildAddSlotPayload({ ...base, role: 'other', customRole: '<img src=x onerror=1>' })
    ).toThrow(ValidationError);
  });

  it('필수값(staffId/role) 누락이면 ValidationError 를 던진다', () => {
    expect(() => buildAddSlotPayload({ ...base, staffId: '' })).toThrow(ValidationError);
    expect(() => buildAddSlotPayload({ ...base, role: '' })).toThrow(ValidationError);
  });

  it('정규화 불가 날짜는 ValidationError 를 던진다', () => {
    expect(() => buildAddSlotPayload({ ...base, date: 'not-a-date' })).toThrow(ValidationError);
  });
});
