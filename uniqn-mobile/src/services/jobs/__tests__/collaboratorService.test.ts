/**
 * UNIQN Mobile - CollaboratorService Tests
 *
 * @description collaboratorService 단위 테스트 (Phase 10)
 *              - Service 비즈니스 로직만 검증 (Repository 는 mock)
 *              - 자가 추가 차단, 인증 가드, 검증 통과 후 Repository 호출 확인
 * @version 1.0.0
 */

import { collaboratorService } from '../collaboratorService';
import { jobPostingCollaboratorRepository } from '@/repositories/supabase/JobPostingCollaboratorRepository';
import { supabase } from '@/lib/supabase';
import { ValidationError, AuthError, ERROR_CODES } from '@/errors';

jest.mock('@/repositories/supabase/JobPostingCollaboratorRepository', () => ({
  jobPostingCollaboratorRepository: {
    findByJobPostingWithUser: jest.fn(),
    findSharedJobPostingsForUser: jest.fn(),
    add: jest.fn(),
    remove: jest.fn(),
    searchByEmail: jest.fn(),
  },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockRepo = jobPostingCollaboratorRepository as jest.Mocked<
  typeof jobPostingCollaboratorRepository
>;
const mockSupabaseAuth = supabase.auth as unknown as {
  getUser: jest.Mock;
};

// v4 형식 UUID (M=4, N=8-b) — zod strict uuid 통과
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const TARGET_ID = '22222222-2222-4222-8222-222222222222';
const POSTING_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function mockAuthUser(uid: string | null) {
  mockSupabaseAuth.getUser.mockResolvedValue({
    data: { user: uid ? { id: uid } : null },
    error: null,
  });
}

describe('collaboratorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('add', () => {
    it('Zod 검증 실패 시 ValidationError', async () => {
      mockAuthUser(OWNER_ID);

      await expect(
        collaboratorService.add({ jobPostingId: 'not-a-uuid', userId: TARGET_ID })
      ).rejects.toBeInstanceOf(ValidationError);
      expect(mockRepo.add).not.toHaveBeenCalled();
    });

    it('자가 추가 시 ValidationError (DB CHECK 도달 전 차단)', async () => {
      mockAuthUser(OWNER_ID);

      await expect(
        collaboratorService.add({ jobPostingId: POSTING_ID, userId: OWNER_ID })
      ).rejects.toBeInstanceOf(ValidationError);
      expect(mockRepo.add).not.toHaveBeenCalled();
    });

    it('미인증 시 AuthError', async () => {
      mockAuthUser(null);

      await expect(
        collaboratorService.add({ jobPostingId: POSTING_ID, userId: TARGET_ID })
      ).rejects.toBeInstanceOf(AuthError);
    });

    it('정상 추가 — Repository.add 호출 + addedBy=auth.uid()', async () => {
      mockAuthUser(OWNER_ID);
      mockRepo.add.mockResolvedValue({
        id: 'jpc-1',
        jobPostingId: POSTING_ID,
        userId: TARGET_ID,
        addedBy: OWNER_ID,
        addedAt: '2026-05-12T00:00:00Z',
      });

      const result = await collaboratorService.add({
        jobPostingId: POSTING_ID,
        userId: TARGET_ID,
      });

      expect(mockRepo.add).toHaveBeenCalledWith(POSTING_ID, TARGET_ID, OWNER_ID);
      expect(result.addedBy).toBe(OWNER_ID);
    });
  });

  describe('remove', () => {
    it('Zod 검증 실패 시 ValidationError', async () => {
      await expect(
        collaboratorService.remove({ jobPostingId: 'not-a-uuid', userId: TARGET_ID })
      ).rejects.toBeInstanceOf(ValidationError);
      expect(mockRepo.remove).not.toHaveBeenCalled();
    });

    it('정상 제거 — Repository.remove 호출 (권한은 RLS 가 강제)', async () => {
      mockRepo.remove.mockResolvedValue(undefined);

      await collaboratorService.remove({ jobPostingId: POSTING_ID, userId: TARGET_ID });

      expect(mockRepo.remove).toHaveBeenCalledWith(POSTING_ID, TARGET_ID);
    });
  });

  describe('leaveSelf', () => {
    it('미인증 시 AuthError', async () => {
      mockAuthUser(null);
      await expect(collaboratorService.leaveSelf(POSTING_ID)).rejects.toBeInstanceOf(AuthError);
    });

    it('정상 — Repository.remove(postingId, currentUserId)', async () => {
      mockAuthUser(TARGET_ID);
      mockRepo.remove.mockResolvedValue(undefined);

      await collaboratorService.leaveSelf(POSTING_ID);

      expect(mockRepo.remove).toHaveBeenCalledWith(POSTING_ID, TARGET_ID);
    });
  });

  describe('searchCandidates', () => {
    it('Zod 검증 실패 (3자 미만) 시 ValidationError', async () => {
      await expect(
        collaboratorService.searchCandidates({ jobPostingId: POSTING_ID, emailQuery: 'ab' })
      ).rejects.toBeInstanceOf(ValidationError);
      expect(mockRepo.searchByEmail).not.toHaveBeenCalled();
    });

    it('정상 — Repository.searchByEmail 호출', async () => {
      mockRepo.searchByEmail.mockResolvedValue([]);

      await collaboratorService.searchCandidates({
        jobPostingId: POSTING_ID,
        emailQuery: 'foo@bar.com',
      });

      expect(mockRepo.searchByEmail).toHaveBeenCalledWith(POSTING_ID, 'foo@bar.com');
    });
  });

  describe('listForJobPosting / listSharedJobPostings', () => {
    it('listForJobPosting — Repository 위임', async () => {
      mockRepo.findByJobPostingWithUser.mockResolvedValue([]);
      await collaboratorService.listForJobPosting(POSTING_ID);
      expect(mockRepo.findByJobPostingWithUser).toHaveBeenCalledWith(POSTING_ID);
    });

    it('listSharedJobPostings — 현재 사용자 ID 로 Repository 위임', async () => {
      mockAuthUser(TARGET_ID);
      mockRepo.findSharedJobPostingsForUser.mockResolvedValue([]);

      await collaboratorService.listSharedJobPostings();

      expect(mockRepo.findSharedJobPostingsForUser).toHaveBeenCalledWith(TARGET_ID);
    });

    it('listSharedJobPostings — 미인증 시 AuthError', async () => {
      mockAuthUser(null);
      await expect(collaboratorService.listSharedJobPostings()).rejects.toBeInstanceOf(AuthError);
    });
  });
});

// avoid unused warning on ERROR_CODES (kept for future expansion)
void ERROR_CODES;
