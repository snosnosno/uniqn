/**
 * addSlotPayload — 구조화 시간대(시작/종료) 입력 테스트(Task 8)
 *
 * 자유 텍스트 timeSlot 을 폐기하고 startTime/endTime 구조화 입력을 받아
 * 정규 'HH:mm - HH:mm' 조합 + 형식 검증(TIME_RE)을 수행하는지 검증한다.
 * - 익일(18:00→02:00) 조합이 앱 표준 구분자 ' - ' 로 정규화되는지.
 * - 형식 위반(자유 텍스트·반쪽 입력)은 ValidationError 로 거부(RPC 미호출).
 */
import { buildAddSlotPayload } from '../addSlotPayload';
import { ValidationError } from '@/errors';

describe('buildAddSlotPayload — 구조화 시간대', () => {
  const base = {
    containerId: 'container-1',
    staffId: 'staff-1',
    date: '2026-06-29',
    role: 'dealer',
  };

  it('시작/종료(18:00·02:00, 익일)를 정규 "HH:mm - HH:mm" 로 조합한다', () => {
    const payload = buildAddSlotPayload({ ...base, startTime: '18:00', endTime: '02:00' });
    expect(payload.assignments[0]!.timeSlot).toBe('18:00 - 02:00');
  });

  it('시작/종료가 모두 비어 있으면 timeSlot 을 생략한다', () => {
    const payload = buildAddSlotPayload({ ...base });
    expect(payload.assignments[0]).not.toHaveProperty('timeSlot');
  });

  it('공백만 있으면 트림 후 생략한다', () => {
    const payload = buildAddSlotPayload({ ...base, startTime: '   ', endTime: '   ' });
    expect(payload.assignments[0]).not.toHaveProperty('timeSlot');
  });

  it('형식이 잘못된 시간(자유 텍스트)은 ValidationError 로 거부한다', () => {
    expect(() => buildAddSlotPayload({ ...base, startTime: '18:00', endTime: '자정넘음' })).toThrow(
      ValidationError
    );
    expect(() => buildAddSlotPayload({ ...base, startTime: '25시', endTime: '02:00' })).toThrow(
      ValidationError
    );
  });

  it('한쪽만 입력되면(반쪽 입력) ValidationError 로 거부한다', () => {
    expect(() => buildAddSlotPayload({ ...base, startTime: '18:00' })).toThrow(ValidationError);
    expect(() => buildAddSlotPayload({ ...base, endTime: '02:00' })).toThrow(ValidationError);
  });
});
