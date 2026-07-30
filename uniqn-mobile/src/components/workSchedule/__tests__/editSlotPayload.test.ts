/**
 * GRID-1 회귀 — 수정 시트는 사용자가 건드리지 않은 시간을 저장하지 않는다
 *
 * 원래 결함: 단일 시각('18:00')이나 미정으로 만들어진 슬롯을 열면 종료 필드가 상수 기본값
 * ('02:00')으로 채워졌고, 저장 시 조건 없이 함께 전송돼 없던 8시간 근무가 확정됐다.
 * 그 값은 실측 출퇴근이 없을 때 정산 금액의 계산 근거가 된다.
 *
 * 시간 모델이 단일값으로 바뀐 뒤(§K)에도 같은 위험은 방향만 바꿔 남는다 — 이번엔
 * **이미 저장된 값을 조용히 덮어쓰는 쪽**이다. 그래서 판단 기준을 값이 아니라
 * "사용자가 시간 축을 건드렸는가"(timeDirty) 하나로 고정한다.
 */

import { resolveSlotTimePayload } from '../editSlotPayload';

describe('resolveSlotTimePayload', () => {
  it('시간 축을 건드리지 않았으면 아무것도 보내지 않는다(기존 저장값 보존)', () => {
    // 색상·메모만 고치려고 연 경우. 화면에 시각이 떠 있다고 저장 신호로 오해하면 안 된다.
    expect(
      resolveSlotTimePayload({ startTime: '18:00', timeUndecided: false, timeDirty: false })
    ).toEqual({});
  });

  it('이미 저장된 레거시 범위도 안 건드리면 그대로 둔다(조용한 소거 방지)', () => {
    // 범위 슬롯을 열면 시작만 표시되는데, 저장 때마다 종료가 날아가면 데이터가 조용히 바뀐다.
    expect(
      resolveSlotTimePayload({ startTime: '18:00', timeUndecided: false, timeDirty: false })
    ).not.toHaveProperty('startTime');
  });

  it('사용자가 시각을 골랐으면 출근 예정 단일값을 보낸다', () => {
    expect(
      resolveSlotTimePayload({ startTime: '19:00', timeUndecided: false, timeDirty: true })
    ).toEqual({ startTime: '19:00' });
  });

  it("'미정'을 명시 선택했으면 미정을 보낸다(레포가 time_slot 을 비운다)", () => {
    expect(
      resolveSlotTimePayload({ startTime: '19:00', timeUndecided: true, timeDirty: true })
    ).toEqual({ timeUndecided: true });
  });

  it('건드리긴 했는데 값이 비어 있으면 아무것도 보내지 않는다(빈 값 저장 방지)', () => {
    expect(
      resolveSlotTimePayload({ startTime: null, timeUndecided: false, timeDirty: true })
    ).toEqual({});
  });
});
