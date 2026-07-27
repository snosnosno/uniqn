/**
 * addSlotPayload — 출근시간 단일 입력 + '미정' 계약 테스트(Task 8b)
 *
 * Task 8 의 시작/종료 구조화 조합(composeTimeSlot) 계약을 폐기하고, 형제 화면
 * AddStaffModal·지원/확정 흐름과 동일하게 **출근시간(start) 하나만** 받도록 재정의한다.
 * (이전 addSlotPayload.overnight.test.ts 의 start+end 조합 케이스는 이 파일로 교체 — 그리드
 *  인원 추가엔 종료·익일 개념이 없으므로 무의미해졌다. 침묵 삭제가 아니라 새 계약으로 대체.)
 *
 * - 출근시간만 입력 → 단일 'HH:mm'(0패딩) 그대로 저장.
 * - 미정(timeUndefined) 또는 미입력 → timeSlot 생략(지원/확정과 동일하게 시간 미기록).
 * - 오형식(자유 텍스트)은 ValidationError 로 거부(RPC 미호출).
 */
import { buildAddSlotPayload } from '../addSlotPayload';
import { ValidationError } from '@/errors';

describe('buildAddSlotPayload — 출근시간 단일 + 미정', () => {
  const base = {
    containerId: 'container-1',
    staffId: 'staff-1',
    date: '2026-06-29',
    role: 'dealer',
  };

  it('출근시간만 입력하면 단일 "HH:mm" 로 저장한다', () => {
    const payload = buildAddSlotPayload({ ...base, startTime: '18:00' });
    expect(payload.assignments[0]!.timeSlot).toBe('18:00');
  });

  it('미정(timeUndefined=true)이면 timeSlot 을 생략한다', () => {
    // 출근시간이 남아 있어도 미정 플래그가 우선한다(지원/확정과 동일하게 시간 미기록).
    const payload = buildAddSlotPayload({ ...base, startTime: '18:00', timeUndefined: true });
    expect(payload.assignments[0]).not.toHaveProperty('timeSlot');
  });

  it('출근시간 미입력이면 timeSlot 을 생략한다', () => {
    const payload = buildAddSlotPayload({ ...base });
    expect(payload.assignments[0]).not.toHaveProperty('timeSlot');
  });

  it('공백만 있으면 트림 후 생략한다', () => {
    const payload = buildAddSlotPayload({ ...base, startTime: '   ' });
    expect(payload.assignments[0]).not.toHaveProperty('timeSlot');
  });

  it('형식이 잘못된 출근시간(자유 텍스트)은 ValidationError 로 거부한다', () => {
    expect(() => buildAddSlotPayload({ ...base, startTime: '자정넘음' })).toThrow(ValidationError);
    expect(() => buildAddSlotPayload({ ...base, startTime: '25시' })).toThrow(ValidationError);
  });
});
