/**
 * workTimeModification — 근무 시간 수정 이력 빌더 + 사유 검증 단위 테스트 (#3)
 */
import {
  assertWorkTimeReason,
  appendWorkTimeModification,
  MAX_WORK_TIME_REASON_LENGTH,
} from '../workTimeModification';
import type { WorkTimeModification } from '@/types';

describe('assertWorkTimeReason', () => {
  it('빈/공백/undefined 사유는 빈 문자열로 정규화한다', () => {
    expect(assertWorkTimeReason(undefined)).toBe('');
    expect(assertWorkTimeReason(null)).toBe('');
    expect(assertWorkTimeReason('   ')).toBe('');
  });

  it('정상 사유는 원문 그대로 반환한다', () => {
    expect(assertWorkTimeReason('출근 시간 정정')).toBe('출근 시간 정정');
  });

  it('XSS 패턴이 포함된 사유는 ValidationError 를 던진다', () => {
    expect(() => assertWorkTimeReason('<script>alert(1)</script>')).toThrow();
  });

  it('상한(200자) 초과 사유는 ValidationError 를 던진다', () => {
    expect(() => assertWorkTimeReason('가'.repeat(MAX_WORK_TIME_REASON_LENGTH + 1))).toThrow();
  });
});

describe('appendWorkTimeModification', () => {
  const base = {
    reason: '정정',
    modifiedBy: 'actor-1',
    modifiedAt: new Date('2026-07-24T13:00:00.000Z'),
  };

  it('기존 이력에 새 엔트리를 불변으로 append 한다', () => {
    const prev: WorkTimeModification[] = [
      { modifiedAt: new Date('2026-07-20T00:00:00Z'), modifiedBy: 'a', reason: 'old' },
    ];
    const next = appendWorkTimeModification(prev, {
      ...base,
      previousStartTime: new Date('2026-07-24T18:00:00Z'),
      newStartTime: new Date('2026-07-24T18:30:00Z'),
    });

    expect(next).toHaveLength(2);
    expect(prev).toHaveLength(1); // 원본 불변
    expect(next[1]?.reason).toBe('정정');
    expect(next[1]?.modifiedBy).toBe('actor-1');
  });

  it('변경된 시간축만 엔트리에 담는다(undefined 축 생략)', () => {
    // 출근만 변경(newStartTime 지정), 퇴근은 변경 안 함(undefined)
    const [entry] = appendWorkTimeModification(undefined, {
      ...base,
      previousStartTime: new Date('2026-07-24T18:00:00Z'),
      newStartTime: new Date('2026-07-24T18:30:00Z'),
      newEndTime: undefined,
    });

    expect(entry).toHaveProperty('newStartTime');
    expect(entry).toHaveProperty('previousStartTime');
    expect(entry).not.toHaveProperty('newEndTime');
    expect(entry).not.toHaveProperty('previousEndTime');
  });

  it('시간을 미정(null)으로 바꾸는 것도 변경으로 기록한다', () => {
    const [entry] = appendWorkTimeModification(undefined, {
      ...base,
      previousEndTime: new Date('2026-07-24T02:00:00Z'),
      newEndTime: null,
    });

    expect(entry).toHaveProperty('newEndTime', null);
    expect(entry).toHaveProperty('previousEndTime');
  });
});
