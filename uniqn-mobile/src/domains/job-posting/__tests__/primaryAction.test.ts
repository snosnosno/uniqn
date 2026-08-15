/**
 * selectPrimaryAction — "지금 할 일" 선택 규칙 (S2-4).
 *
 * 순서의 근거는 방치했을 때의 손해 크기다. 이 표가 흔들리면 사장은 급한 일 대신
 * 눈에 띄는 일을 먼저 하게 된다.
 */

import { selectPrimaryAction, type PostingActionSignals } from '@/domains/job-posting';

const noSignals: PostingActionSignals = {
  cancellationPendingCount: 0,
  todayAbsentCount: 0,
  pendingApplicantCount: 0,
  pendingSettlementCount: 0,
  liveOpsCount: 0,
};

describe('selectPrimaryAction', () => {
  it('할 일이 없으면 아무것도 고르지 않는다 — 빈 카드를 만들지 않기 위해', () => {
    expect(selectPrimaryAction(noSignals)).toBeNull();
  });

  it('취소 요청이 가장 급하다 — 방치하면 그 자리가 빈 채로 근무일이 온다', () => {
    expect(
      selectPrimaryAction({
        ...noSignals,
        cancellationPendingCount: 1,
        todayAbsentCount: 5,
        pendingApplicantCount: 9,
        pendingSettlementCount: 9,
        liveOpsCount: 3,
      })
    ).toBe('cancellationRequests');
  });

  it('취소 요청이 없으면 오늘 미출근이 다음이다 — 지금 연락해야 메울 수 있다', () => {
    expect(
      selectPrimaryAction({ ...noSignals, todayAbsentCount: 1, pendingApplicantCount: 9 })
    ).toBe('todayAbsent');
  });

  it('현장 신호가 없으면 대기 지원자 — 늦으면 다른 공고로 간다', () => {
    expect(
      selectPrimaryAction({ ...noSignals, pendingApplicantCount: 2, pendingSettlementCount: 9 })
    ).toBe('pendingApplicants');
  });

  it('정산 대기는 근무가 이미 끝난 일이라 뒤에 온다', () => {
    expect(selectPrimaryAction({ ...noSignals, pendingSettlementCount: 3, liveOpsCount: 1 })).toBe(
      'pendingSettlement'
    );
  });

  it('라이브 운영은 마지막이다 — 진행 중이면 사장은 이미 알고 있다', () => {
    expect(selectPrimaryAction({ ...noSignals, liveOpsCount: 1 })).toBe('liveOps');
  });

  // 음수는 트리거/폴백 조합에서 이론상 나올 수 있다. 0 과 같게 취급해야
  // "처리할 일이 없는데 카드가 뜨는" 상태를 만들지 않는다.
  it('음수 신호는 없는 것으로 본다', () => {
    expect(selectPrimaryAction({ ...noSignals, pendingApplicantCount: -1 })).toBeNull();
  });
});
