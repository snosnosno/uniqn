/**
 * ops 좌석/테이블 서비스 테스트 — 유효입력 위임 + 경계 검증실패 (TDD).
 */
import * as repo from '@/repositories/ops';
import { addTable } from '@/services/ops/opsTableService';
import { reseatParticipants } from '@/services/ops/opsSeatService';

// babel-jest-hoist 규칙: jest.mock 팩토리가 참조하는 외부변수는 `mock` 접두사 필수.
jest.mock('@/repositories/ops', () => ({
  opsTableRepository: { addTable: jest.fn().mockResolvedValue({ tableId: 't', tableNo: 1 }) },
  opsSeatRepository: {
    reseatParticipants: jest.fn().mockResolvedValue({ moved: 2, seated: 2, mode: 'random_draw' }),
  },
}));

describe('opsTableService.addTable', () => {
  it('유효 입력 → Repository 위임', async () => {
    const r = await addTable({ tournamentId: 't1', seatCount: 9, lockType: 'none' }, 'actor');
    expect(r.tableNo).toBe(1);
    expect(repo.opsTableRepository.addTable as jest.Mock).toHaveBeenCalled();
  });
  it('seatCount 범위 밖 → ValidationError, Repository 미호출', async () => {
    (repo.opsTableRepository.addTable as jest.Mock).mockClear();
    await expect(
      addTable({ tournamentId: 't1', seatCount: 99, lockType: 'none' }, 'actor')
    ).rejects.toBeTruthy();
    expect(repo.opsTableRepository.addTable as jest.Mock).not.toHaveBeenCalled();
  });
});

describe('opsSeatService.reseatParticipants — 경계 검증 배선', () => {
  const reseatMock = () => repo.opsSeatRepository.reseatParticipants as jest.Mock;
  // uuid 형식(그룹형 hex) — reseatAssignmentsSchema.uuidLike 통과.
  const OK = [
    {
      participantId: '00000000-0000-0000-0000-000000000001',
      seatId: '00000000-0000-0000-0000-0000000000a1',
    },
    {
      participantId: '00000000-0000-0000-0000-000000000002',
      seatId: '00000000-0000-0000-0000-0000000000a2',
    },
  ];

  it('유효 배정 → Repository 위임', async () => {
    reseatMock().mockClear();
    const r = await reseatParticipants('t1', 'actor', OK, 'random_draw');
    expect(r.moved).toBe(2);
    expect(reseatMock()).toHaveBeenCalled();
  });

  it('비-uuid participantId → ValidationError, Repository 미호출', async () => {
    reseatMock().mockClear();
    await expect(
      reseatParticipants('t1', 'actor', [{ participantId: 'p1', seatId: 's1' }], 'random_draw')
    ).rejects.toBeTruthy();
    expect(reseatMock()).not.toHaveBeenCalled();
  });

  it('참가자 중복 → ValidationError, Repository 미호출', async () => {
    reseatMock().mockClear();
    const dup = [OK[0], { participantId: OK[0].participantId, seatId: OK[1].seatId }];
    await expect(reseatParticipants('t1', 'actor', dup, 'chip_draft')).rejects.toBeTruthy();
    expect(reseatMock()).not.toHaveBeenCalled();
  });

  it('잘못된 mode → ValidationError, Repository 미호출', async () => {
    reseatMock().mockClear();
    await expect(
      reseatParticipants('t1', 'actor', OK, 'bogus' as unknown as 'random_draw')
    ).rejects.toBeTruthy();
    expect(reseatMock()).not.toHaveBeenCalled();
  });
});
