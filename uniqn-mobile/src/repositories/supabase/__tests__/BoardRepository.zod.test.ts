/**
 * UNIQN Mobile - BoardRepository JSONB Zod 검증 테스트
 *
 * @description board_posts JSONB(job_summary / metadata) 런타임 파싱 안전성 확인.
 *              - 정상 케이스 / passthrough / 필수 필드 누락 / optional 누락
 */

import { BoardPostMetadataSchema } from '@/schemas/boardMetadata.schema';

describe('BoardPostMetadataSchema', () => {
  it('parses valid substitute post metadata', () => {
    const input = {
      jobSummary: {
        jobPostingId: 'job-1',
        title: 'Bar Shift',
        workDate: '2026-04-20',
        locationName: 'Pub',
        compensationLabel: '80000',
      },
      applicationId: 'app-1',
    };

    const result = BoardPostMetadataSchema.safeParse(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.jobSummary?.jobPostingId).toBe('job-1');
      expect(result.data.applicationId).toBe('app-1');
    }
  });

  it('passes through unknown keys (forward compat)', () => {
    const input = {
      jobSummary: { jobPostingId: 'j', title: 't', workDate: '2026-04-20' },
      customField: 'future-value',
    };

    const result = BoardPostMetadataSchema.safeParse(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).customField).toBe('future-value');
    }
  });

  it('fails on jobSummary with missing required jobPostingId', () => {
    const input = { jobSummary: { title: 'x', workDate: '2026-04-20' } };

    const result = BoardPostMetadataSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it('accepts missing jobSummary (optional)', () => {
    const result = BoardPostMetadataSchema.safeParse({ applicationId: 'a' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.jobSummary).toBeUndefined();
      expect(result.data.applicationId).toBe('a');
    }
  });
});
