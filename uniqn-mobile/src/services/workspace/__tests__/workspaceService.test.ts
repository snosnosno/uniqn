import { workspaceService } from '@/services/workspace/workspaceService';
import { BusinessError, ERROR_CODES, ValidationError } from '@/errors';
import { workspaceRepository } from '@/repositories';
import { supabase } from '@/lib/supabase';
import type { Workspace } from '@/types/workspace';

const mockFindAllByMember = jest.fn();
const mockCreate = jest.fn();

jest.mock('@/repositories', () => ({
  workspaceRepository: {
    findAllByMember: (...args: unknown[]) => mockFindAllByMember(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    archiveViaRpc: jest.fn(),
    restoreViaRpc: jest.fn(),
    findArchivedByOwner: jest.fn(),
  },
  workspaceMemberRepository: {
    findByWorkspaceWithUser: jest.fn(),
    removeViaRpc: jest.fn(),
  },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    appError: jest.fn(),
  },
}));

function workspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: 'ws-1',
    name: '내 팀',
    ownerId: 'employer-1',
    memberCount: 1,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    archivedAt: null,
    ...overrides,
  };
}

describe('workspaceService.getDefaultWorkspaceIdForOwner', () => {
  beforeEach(() => {
    mockFindAllByMember.mockReset();
    mockCreate.mockReset();
  });

  it('owner 워크스페이스가 있으면 가장 오래된 것 반환 (fast path)', async () => {
    mockFindAllByMember.mockResolvedValueOnce([
      workspace({ id: 'ws-new', createdAt: '2026-05-10T00:00:00.000Z' }),
      workspace({ id: 'ws-old', createdAt: '2026-05-01T00:00:00.000Z' }),
    ]);

    const id = await workspaceService.getDefaultWorkspaceIdForOwner('employer-1');

    expect(id).toBe('ws-old');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('owner 워크스페이스 0개 → 자동 생성 후 재조회로 복구 (2026-05-19 hotfix)', async () => {
    mockFindAllByMember
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([workspace({ id: 'ws-auto' })]);
    mockCreate.mockResolvedValueOnce(workspace({ id: 'ws-auto' }));

    const id = await workspaceService.getDefaultWorkspaceIdForOwner('employer-1');

    expect(id).toBe('ws-auto');
    expect(mockCreate).toHaveBeenCalledWith('내 팀');
    expect(mockFindAllByMember).toHaveBeenCalledTimes(2);
  });

  it('owner 워크스페이스 0개 + 자동 생성 실패 → BusinessError throw', async () => {
    mockFindAllByMember.mockResolvedValueOnce([]);
    mockCreate.mockRejectedValueOnce(new Error('CAP_REACHED'));

    await expect(workspaceService.getDefaultWorkspaceIdForOwner('employer-1')).rejects.toThrow(
      BusinessError
    );
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('자동 생성은 성공했지만 재조회도 0개 → BusinessError throw', async () => {
    mockFindAllByMember.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    mockCreate.mockResolvedValueOnce(workspace({ id: 'ws-orphan' }));

    await expect(
      workspaceService.getDefaultWorkspaceIdForOwner('employer-1')
    ).rejects.toMatchObject({
      code: ERROR_CODES.BUSINESS_INVALID_STATE,
    });
  });

  it('다른 사람이 owner 인 워크스페이스만 있으면 (멤버 only) → 자동 생성 시도', async () => {
    mockFindAllByMember
      .mockResolvedValueOnce([workspace({ ownerId: 'other-employer' })])
      .mockResolvedValueOnce([
        workspace({ ownerId: 'other-employer' }),
        workspace({ id: 'ws-auto', ownerId: 'employer-1' }),
      ]);
    mockCreate.mockResolvedValueOnce(workspace({ id: 'ws-auto' }));

    const id = await workspaceService.getDefaultWorkspaceIdForOwner('employer-1');

    expect(id).toBe('ws-auto');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});

describe('workspaceService - archive/restore', () => {
  beforeEach(() => jest.clearAllMocks());

  it('archiveWorkspace 는 repository.archiveViaRpc 에 위임한다', async () => {
    const spy = jest.spyOn(workspaceRepository, 'archiveViaRpc').mockResolvedValue(undefined);
    await workspaceService.archiveWorkspace({
      workspaceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    });
    expect(spy).toHaveBeenCalledWith('f47ac10b-58cc-4372-a567-0e02b2c3d479');
  });

  it('archiveWorkspace 는 잘못된 ID 를 ValidationError 로 거부한다', async () => {
    await expect(
      workspaceService.archiveWorkspace({ workspaceId: 'not-a-uuid' })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('restoreWorkspace 는 repository.restoreViaRpc 에 위임한다', async () => {
    const spy = jest.spyOn(workspaceRepository, 'restoreViaRpc').mockResolvedValue(undefined);
    await workspaceService.restoreWorkspace({
      workspaceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    });
    expect(spy).toHaveBeenCalledWith('f47ac10b-58cc-4372-a567-0e02b2c3d479');
  });

  it('listArchivedWorkspaces 는 repository.findArchivedByOwner 에 위임한다', async () => {
    const spy = jest.spyOn(workspaceRepository, 'findArchivedByOwner').mockResolvedValue([]);
    await workspaceService.listArchivedWorkspaces('owner-1');
    expect(spy).toHaveBeenCalledWith('owner-1');
  });
});

describe('workspaceService.lookupUserByEmail', () => {
  function mockUsersQueryOnce(row: Record<string, unknown> | null) {
    const inSpy = jest.fn().mockReturnThis();
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: inSpy,
      maybeSingle: jest.fn().mockResolvedValue({ data: row, error: null }),
    };
    (supabase.from as jest.Mock).mockReturnValueOnce(chain);
    return { inSpy };
  }

  it('초대 대상 조회를 employer/admin 역할로만 한정한다 (staff 초대 dead-end 차단)', async () => {
    const { inSpy } = mockUsersQueryOnce(null);

    await workspaceService.lookupUserByEmail('someone@uniqn.app');

    // 회귀 가드: 역할 한정 필터가 빠지면 staff 가 다시 초대돼 수락 화면 없는 dead-end 발생
    expect(inSpy).toHaveBeenCalledWith('role', ['employer', 'admin']);
  });

  it('employer 사용자는 정상 매핑되어 반환된다', async () => {
    mockUsersQueryOnce({
      id: 'emp-1',
      name: '사장',
      email: 'boss@uniqn.app',
      photo_url: null,
      is_active: true,
    });

    const result = await workspaceService.lookupUserByEmail('boss@uniqn.app');

    expect(result).toEqual({
      id: 'emp-1',
      name: '사장',
      email: 'boss@uniqn.app',
      photoUrl: null,
    });
  });

  it('역할 미일치(쿼리 결과 없음)면 null 을 반환한다', async () => {
    mockUsersQueryOnce(null);

    const result = await workspaceService.lookupUserByEmail('staff@uniqn.app');

    expect(result).toBeNull();
  });
});
