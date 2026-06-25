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
