/**
 * opsTableService 서비스 테스트 — 유효입력 위임 + 검증실패 (TDD).
 */
import * as repo from '@/repositories/ops';
import { addTable } from '@/services/ops/opsTableService';

// babel-jest-hoist 규칙: jest.mock 팩토리가 참조하는 외부변수는 `mock` 접두사 필수.
jest.mock('@/repositories/ops', () => ({
  opsTableRepository: { addTable: jest.fn().mockResolvedValue({ tableId: 't', tableNo: 1 }) },
  opsSeatRepository: {},
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
