import { canTransition, isFinalStatus } from '../OpsParticipantStatusMachine';
import type { OpsParticipantStatus } from '@/types/ops';

describe('OpsParticipantStatusMachine.canTransition', () => {
  it('active → bust 는 busted 로 허용', () => {
    const r = canTransition('active', 'bust');
    expect(r.allowed).toBe(true);
    expect(r.nextStatus).toBe('busted');
  });

  it('registered → checkIn 는 checked_in', () => {
    expect(canTransition('registered', 'checkIn')).toEqual({
      allowed: true,
      nextStatus: 'checked_in',
    });
  });

  it('busted → reenter 는 active (재진입)', () => {
    expect(canTransition('busted', 'reenter').nextStatus).toBe('active');
  });

  it('busted 에서 bust 재시도는 거부(이중 탈락 방지)', () => {
    const r = canTransition('busted', 'bust');
    expect(r.allowed).toBe(false);
    expect(r.nextStatus).toBeUndefined();
    expect(r.reason).toContain('busted');
  });

  it('active 에서 checkIn 은 거부', () => {
    expect(canTransition('active', 'checkIn').allowed).toBe(false);
  });

  it('registered → markNoShow 는 no_show', () => {
    expect(canTransition('registered', 'markNoShow').nextStatus).toBe('no_show');
  });

  // 결함② — 서버 ops_set_participant_no_show 와 같은 규칙이어야 한다.
  it('checked_in → markNoShow 는 no_show (노쇼 표시)', () => {
    expect(canTransition('checked_in', 'markNoShow').nextStatus).toBe('no_show');
  });

  it('no_show 되돌리기는 대기열(checked_in) — active 로 가지 않는다', () => {
    expect(canTransition('no_show', 'checkIn').nextStatus).toBe('checked_in');
    // 좌석 없는 active 는 live_stats.playing/average_stack 을 오염시키므로 금지 전이다.
    expect(canTransition('no_show', 'activate').allowed).toBe(false);
  });

  it('active → markNoShow 는 거부(그 경로는 bust)', () => {
    expect(canTransition('active', 'markNoShow').allowed).toBe(false);
  });

  it('busted → markNoShow 는 거부', () => {
    expect(canTransition('busted', 'markNoShow').allowed).toBe(false);
  });
});

describe('OpsParticipantStatusMachine.isFinalStatus', () => {
  it('모든 상태는 비종료(재진입/활성화 경로 존재)', () => {
    (['registered', 'checked_in', 'active', 'busted', 'no_show'] as OpsParticipantStatus[]).forEach(
      (s) => {
        expect(isFinalStatus(s)).toBe(false);
      }
    );
  });
});
