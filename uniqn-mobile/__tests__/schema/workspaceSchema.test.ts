/**
 * PR #1 — workspace 스키마 컴파일 시점 검증
 *
 * @description database.types.ts 에 workspace 3개 테이블 + is_workspace_member RPC 가
 *              포함되어 있는지 컴파일 타임에 검증한다. 실제 DB RLS 통합 테스트는 PR #2
 *              Repository 와 함께 진행된다 (mock 기반 프로젝트 관행).
 *
 * 본 테스트의 목적:
 *  1. types regen 누락 방지 (Migration 적용했는데 types 갱신 잊은 경우)
 *  2. enum / column / RPC signature 도메인 계약 고정
 *  3. PR #5 owner_id rename 시 깨질 fixture 위치 식별
 */

import type { Database } from '@/lib/database.types';

type PublicTables = Database['public']['Tables'];
type PublicEnums = Database['public']['Enums'];
type PublicFunctions = Database['public']['Functions'];

describe('workspace schema (PR #1 — M1 migration)', () => {
  it('workspaces 테이블 — Row 필수 컬럼 (id/name/owner_id/member_count/created_at/updated_at)', () => {
    type Row = PublicTables['workspaces']['Row'];
    const sample: Row = {
      id: '00000000-0000-0000-0000-000000000000',
      name: '테스트 워크스페이스',
      owner_id: '00000000-0000-0000-0000-000000000001',
      member_count: 0,
      created_at: '2026-04-30T00:00:00.000Z',
      updated_at: '2026-04-30T00:00:00.000Z',
    };
    expect(sample.member_count).toBe(0);
    expect(sample.name.length).toBeGreaterThan(0);
  });

  it('workspaces 테이블 — Insert 시 member_count 옵셔널 (DEFAULT 0)', () => {
    type Insert = PublicTables['workspaces']['Insert'];
    const sample: Insert = {
      name: '신규 워크스페이스',
      owner_id: '00000000-0000-0000-0000-000000000001',
    };
    expect(sample).toBeDefined();
  });

  it('workspace_members 테이블 — composite PK (workspace_id, user_id) + role default editor', () => {
    type Row = PublicTables['workspace_members']['Row'];
    const sample: Row = {
      workspace_id: '00000000-0000-0000-0000-000000000010',
      user_id: '00000000-0000-0000-0000-000000000020',
      role: 'editor',
      invited_by: null,
      joined_at: '2026-04-30T00:00:00.000Z',
    };
    expect(sample.role).toBe('editor');
  });

  it('workspace_invitations 테이블 — status 5종 + invitee_user_id 필수 (D1 invitee_email 제거됨)', () => {
    type Row = PublicTables['workspace_invitations']['Row'];
    const allowedStatuses = ['pending', 'accepted', 'rejected', 'revoked', 'expired'] as const;
    const sample: Row = {
      id: '00000000-0000-0000-0000-000000000030',
      workspace_id: '00000000-0000-0000-0000-000000000010',
      invitee_user_id: '00000000-0000-0000-0000-000000000020',
      role: 'editor',
      invited_by: '00000000-0000-0000-0000-000000000001',
      status: 'pending',
      expires_at: '2026-05-07T00:00:00.000Z',
      created_at: '2026-04-30T00:00:00.000Z',
      responded_at: null,
    };
    expect(allowedStatuses).toContain(sample.status);
    // D1: invitee_email field must NOT exist
    // @ts-expect-error — invitee_email 컬럼은 Phase 2 deferred (매직 링크 인프라)
    const _shouldNotExist: string = sample.invitee_email;
    expect(_shouldNotExist).toBeUndefined();
  });

  it('workspace_role enum — editor 단일 값 (D2: owner는 workspaces.owner_id 단독)', () => {
    type Role = PublicEnums['workspace_role'];
    const role: Role = 'editor';
    // Compile-time guarantee: workspace_role only allows 'editor'
    // @ts-expect-error — D2 결정: workspace_role 에 'owner' 값 없음, owner는 workspaces.owner_id 단독
    const _invalidRole: Role = 'owner';
    expect(role).toBe('editor');
    expect(_invalidRole).toBeDefined();
  });

  it('is_workspace_member RPC — (workspace_id, user_id) → boolean signature', () => {
    type Args = PublicFunctions['is_workspace_member']['Args'];
    type Returns = PublicFunctions['is_workspace_member']['Returns'];
    const args: Args = {
      _workspace_id: '00000000-0000-0000-0000-000000000010',
      _user_id: '00000000-0000-0000-0000-000000000020',
    };
    const returnsValid: Returns = true;
    expect(args._workspace_id).toBeDefined();
    expect(typeof returnsValid).toBe('boolean');
  });

  it('job_postings 테이블 — workspace_id NOT NULL (PR #5 M3 전환 완료)', () => {
    type Row = PublicTables['job_postings']['Row'];
    type Insert = PublicTables['job_postings']['Insert'];
    // M3 후 workspace_id 는 string (nullable 아님)
    const row: Pick<Row, 'workspace_id'> = {
      workspace_id: '123e4567-e89b-42d3-a456-426614174010',
    };
    expect(row.workspace_id).toBeTruthy();

    // Insert 시에도 필수 — 빌드 타임 에러 방어
    // @ts-expect-error — workspace_id 가 NOT NULL 이라 Insert 에서 null 거부
    const _shouldFail: Pick<Insert, 'workspace_id'> = { workspace_id: null };
    expect(_shouldFail).toBeDefined();
  });
});
