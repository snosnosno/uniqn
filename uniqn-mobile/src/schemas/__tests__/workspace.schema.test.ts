/**
 * PR #2 — workspace zod schema 검증
 *
 * - XSS 차단 (xssValidation refine)
 * - 이름 길이 제약 (1~50)
 * - UUID 형식 강제
 * - role enum 'editor' 단일
 */

import {
  createWorkspaceSchema,
  updateWorkspaceNameSchema,
  inviteWorkspaceMemberSchema,
  respondInvitationSchema,
  workspaceRoleSchema,
} from '@/schemas/workspace.schema';

describe('workspace schemas (PR #2)', () => {
  describe('createWorkspaceSchema', () => {
    it('정상 입력 통과', () => {
      const r = createWorkspaceSchema.safeParse({ name: '강남펍 워크스페이스' });
      expect(r.success).toBe(true);
    });

    it('빈 문자열 거부', () => {
      const r = createWorkspaceSchema.safeParse({ name: '' });
      expect(r.success).toBe(false);
    });

    it('51자 거부', () => {
      const r = createWorkspaceSchema.safeParse({ name: 'a'.repeat(51) });
      expect(r.success).toBe(false);
    });

    it('XSS 시도 거부 — script 태그', () => {
      const r = createWorkspaceSchema.safeParse({ name: '<script>alert(1)</script>' });
      expect(r.success).toBe(false);
    });

    it('XSS 시도 거부 — javascript: URL', () => {
      const r = createWorkspaceSchema.safeParse({ name: 'javascript:void(0)' });
      expect(r.success).toBe(false);
    });

    it('이모지 포함 가능 (Unicode 안전)', () => {
      const r = createWorkspaceSchema.safeParse({ name: '🎰 강남 포커룸' });
      expect(r.success).toBe(true);
    });
  });

  describe('updateWorkspaceNameSchema', () => {
    it('워크스페이스 ID UUID 강제', () => {
      const r = updateWorkspaceNameSchema.safeParse({
        workspaceId: 'not-a-uuid',
        name: '신규 이름',
      });
      expect(r.success).toBe(false);
    });

    it('정상 통과', () => {
      const r = updateWorkspaceNameSchema.safeParse({
        workspaceId: '123e4567-e89b-42d3-a456-426614174001',
        name: '신규 이름',
      });
      expect(r.success).toBe(true);
    });
  });

  describe('inviteWorkspaceMemberSchema', () => {
    it('role default editor', () => {
      const r = inviteWorkspaceMemberSchema.safeParse({
        workspaceId: '123e4567-e89b-42d3-a456-426614174001',
        inviteeUserId: '123e4567-e89b-42d3-a456-426614174002',
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.role).toBe('editor');
    });

    it('role 외 값 거부 (D2: editor 단일)', () => {
      const r = inviteWorkspaceMemberSchema.safeParse({
        workspaceId: '123e4567-e89b-42d3-a456-426614174001',
        inviteeUserId: '123e4567-e89b-42d3-a456-426614174002',
        role: 'owner',
      });
      expect(r.success).toBe(false);
    });
  });

  describe('respondInvitationSchema', () => {
    it('UUID 강제', () => {
      const r = respondInvitationSchema.safeParse({ invitationId: 'invalid' });
      expect(r.success).toBe(false);
    });
  });

  describe('workspaceRoleSchema (D2)', () => {
    it("'editor' 만 허용", () => {
      expect(workspaceRoleSchema.safeParse('editor').success).toBe(true);
      expect(workspaceRoleSchema.safeParse('owner').success).toBe(false);
      expect(workspaceRoleSchema.safeParse('admin').success).toBe(false);
    });
  });
});
