import { workspaceService } from '@/services/workspace/workspaceService';
import { BusinessError, ERROR_CODES, ValidationError } from '@/errors';
import { workspaceRepository } from '@/repositories';
import type { Workspace } from '@/types/workspace';

const mockFindAllByMember = jest.fn();
const mockCreate = jest.fn();
const mockSearchInviteCandidates = jest.fn();

jest.mock('@/repositories', () => ({
  workspaceRepository: {
    findAllByMember: (...args: unknown[]) => mockFindAllByMember(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    archiveViaRpc: jest.fn(),
    restoreViaRpc: jest.fn(),
    findArchivedByOwner: jest.fn(),
    searchInviteCandidatesByNickname: (...args: unknown[]) => mockSearchInviteCandidates(...args),
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

/**
 * lookupUserByEmail(이메일 정확일치) → searchInviteCandidatesByNickname(닉네임 prefix) 전환.
 *
 * ⚠️ 이관된 회귀 가드 — 여기서 사라진 게 아니라 SQL 로 내려갔다.
 *   옛 테스트는 "초대 대상을 employer/admin 으로만 한정"(staff 초대 시 수락 화면이
 *   employer 전용이라 도달 불가한 dead-end)을 `.in('role', [...])` 호출로 감시했다.
 *   그 필터는 이제 RPC search_workspace_invite_candidates_by_nickname 본문에 있어
 *   TS 목으로는 감시할 수 없다. 대신 마이그레이션 적용 시 로컬 DB 에서 4개 게이트를
 *   실측 검증했다(미인증·비owner 예외 / 2자 미만 0행 / staff·본인·기존멤버·대기중초대 제외).
 *   RPC 본문을 손댈 때는 그 시나리오를 다시 돌릴 것.
 */
describe('workspaceService.searchInviteCandidatesByNickname', () => {
  const CANDIDATE = {
    id: 'emp-1',
    name: '사장',
    nickname: 'boss',
    photoUrl: null,
    photoUrlBlurhash: null,
  };

  it('workspaceId 가 없으면 ValidationError 를 던진다', async () => {
    await expect(
      workspaceService.searchInviteCandidatesByNickname('', 'boss')
    ).rejects.toBeInstanceOf(ValidationError);
    expect(mockSearchInviteCandidates).not.toHaveBeenCalled();
  });

  it('2자 미만이면 서버 왕복 없이 빈 배열을 준다 (rate limit 토큰 보호)', async () => {
    const result = await workspaceService.searchInviteCandidatesByNickname('ws-1', ' b ');

    expect(result).toEqual([]);
    expect(mockSearchInviteCandidates).not.toHaveBeenCalled();
  });

  it('2자 이상이면 repository 에 workspaceId 와 원문 닉네임을 그대로 넘긴다', async () => {
    mockSearchInviteCandidates.mockResolvedValueOnce([CANDIDATE]);

    const result = await workspaceService.searchInviteCandidatesByNickname('ws-1', 'bo');

    expect(mockSearchInviteCandidates).toHaveBeenCalledWith('ws-1', 'bo');
    expect(result).toEqual([CANDIDATE]);
  });

  it('실패를 삼키지 않고 그대로 던진다 (권한·rate limit 을 화면이 구분해야 함)', async () => {
    mockSearchInviteCandidates.mockRejectedValueOnce(new Error('SEARCH_RATE_LIMITED'));

    await expect(workspaceService.searchInviteCandidatesByNickname('ws-1', 'bo')).rejects.toThrow(
      'SEARCH_RATE_LIMITED'
    );
  });
});
