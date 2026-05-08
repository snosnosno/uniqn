/**
 * UNIQN Mobile - JobPostingRepository.updateWithTransaction 회귀 가드
 *
 * @description PostgreSQL 22007 (invalid input syntax for type timestamp with time zone)
 *              회귀 차단. 원래 버그: timestampSchema가 Supabase ISO string을
 *              {seconds, nanoseconds} TimestampLike 객체로 변환했고, 해당 객체가
 *              updateWithTransaction의 PATCH 페이로드에 그대로 실려 DB에 전송되어
 *              22007로 터졌다. Task 2/4에서 timestampSchema를 ISO string 반환으로
 *              수정했고, Task 11(이 테스트)은 그 수정이 유지되는지 영구 검증.
 *
 * @regression 2026-04-19 Firebase Timestamp 레거시 청산 Task 11
 */

import { SupabaseJobPostingRepository } from '../JobPostingRepository';

import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('SupabaseJobPostingRepository.updateWithTransaction (회귀: 22007 차단)', () => {
  const repo = new SupabaseJobPostingRepository();
  let capturedUpdatePayload: Record<string, unknown> | null = null;

  function setupMock(existingRow: Record<string, unknown>) {
    capturedUpdatePayload = null;
    const updateMock = jest.fn().mockImplementation((payload: Record<string, unknown>) => {
      capturedUpdatePayload = payload;
      return {
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      };
    });
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: existingRow, error: null }),
        }),
      }),
      update: updateMock,
    });
  }

  const baseRow: Record<string, unknown> = {
    id: 'job-1',
    title: '기존 공고',
    schema_version: 3,
    status: 'active',
    owner_id: 'owner-1',
    owner_name: 'Owner',
    workspace_id: '123e4567-e89b-42d3-a456-426614174000',
    posting_type: 'regular',
    work_date: '2026-04-20',
    work_dates: ['2026-04-20'],
    role_keys: ['dealer'],
    total_positions: 1,
    filled_positions: 0,
    view_count: 0,
    // stats는 optional이므로 생략 (postingStatsSchema는 strict + 5개 필드 전부 required)
    created_at: '2026-04-19T10:00:00.000Z',
    updated_at: '2026-04-19T11:00:00.000Z',
    location: { name: '강남' },
    schedule: {
      kind: 'dated',
      primaryDate: '2026-04-20',
      allDates: ['2026-04-20'],
      requirements: [],
    },
    role_catalog: [{ role: 'dealer' }],
    compensation: { mode: 'shared' },
    questions: { items: [] },
  };

  it('cur.createdAt이 string인 경우 update payload에 string으로 들어간다', async () => {
    setupMock(baseRow);
    await repo.updateWithTransaction('job-1', { title: '수정' }, 'owner-1');

    expect(capturedUpdatePayload).not.toBeNull();
    const json = JSON.stringify(capturedUpdatePayload);
    expect(json).not.toContain('"seconds"');
    expect(json).not.toContain('"nanoseconds"');

    if (capturedUpdatePayload && capturedUpdatePayload['created_at'] !== undefined) {
      expect(typeof capturedUpdatePayload['created_at']).toBe('string');
      expect(capturedUpdatePayload['created_at']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it('cur.createdAt이 과거의 {seconds, nanoseconds} 객체로 저장돼있던 경우도 string으로 정규화', async () => {
    setupMock({
      ...baseRow,
      created_at: { seconds: 1776525546, nanoseconds: 985000000 } as unknown as string,
    });
    await repo.updateWithTransaction('job-1', { title: '수정' }, 'owner-1');

    const json = JSON.stringify(capturedUpdatePayload);
    expect(json).not.toContain('"seconds"');
    expect(json).not.toContain('"nanoseconds"');
  });

  it('마감된 공고(cur.closedAt 존재)도 update payload에 string으로 들어간다 (closedAt 회귀 가드)', async () => {
    setupMock({
      ...baseRow,
      status: 'closed',
      closed_at: '2026-04-19T12:00:00.000Z',
      closed_reason: 'manual',
    });
    await repo.updateWithTransaction('job-1', { title: '수정' }, 'owner-1');

    const json = JSON.stringify(capturedUpdatePayload);
    expect(json).not.toContain('"seconds"');
    expect(json).not.toContain('"nanoseconds"');

    if (capturedUpdatePayload && capturedUpdatePayload['closed_at'] !== undefined) {
      expect(typeof capturedUpdatePayload['closed_at']).toBe('string');
    }
  });

  it('updated_at은 항상 새로 생성된 Date/ISO string (JSON 직렬화 시 ISO string)', async () => {
    setupMock(baseRow);
    await repo.updateWithTransaction('job-1', { title: '수정' }, 'owner-1');

    // updated_at은 Date 인스턴스 또는 ISO string. 핵심은 JSON 직렬화 시 ISO string이 되어
    // PostgreSQL timestamptz가 받을 수 있어야 한다는 것(22007 방지).
    const updatedAt = capturedUpdatePayload?.['updated_at'];
    expect(updatedAt).toBeDefined();

    // {seconds, nanoseconds} TimestampLike 객체로 직렬화되면 안 된다
    const json = JSON.stringify({ updated_at: updatedAt });
    expect(json).not.toContain('"seconds"');
    expect(json).not.toContain('"nanoseconds"');
    expect(json).toMatch(/"updated_at":"\d{4}-\d{2}-\d{2}T/);
  });
});
