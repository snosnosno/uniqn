/**
 * GRID-1 회귀 — 수정 시트가 사장이 정한 적 없는 종료시각을 저장하면 안 된다
 *
 * 단일 시각('18:00')이나 미정으로 만들어진 슬롯을 열면 종료 필드가 상수 기본값('02:00')으로
 * 채워졌고, 저장 시 조건 없이 함께 전송돼 없던 8시간 근무가 확정됐다. 그 값은 실측 출퇴근이
 * 없을 때 정산 금액의 계산 근거가 된다.
 */

import { resolveSlotTimePayload } from '../editSlotPayload';

describe('resolveSlotTimePayload', () => {
  it('종료를 정하지 않았으면 시간 축을 아예 보내지 않는다 (기본값 주입 차단)', () => {
    expect(
      resolveSlotTimePayload({ startTime: '18:00', endTime: '02:00', endTimeSet: false })
    ).toEqual({});
  });

  it('종료가 정해져 있으면 시작·종료를 함께 보낸다', () => {
    expect(
      resolveSlotTimePayload({ startTime: '18:00', endTime: '23:30', endTimeSet: true })
    ).toEqual({ startTime: '18:00', endTime: '23:30' });
  });

  it('원본에 종료가 있던 슬롯은 값이 그대로여도 전송한다 (편집 없이 저장해도 보존)', () => {
    expect(
      resolveSlotTimePayload({ startTime: '19:00', endTime: '02:00', endTimeSet: true })
    ).toEqual({ startTime: '19:00', endTime: '02:00' });
  });
});
