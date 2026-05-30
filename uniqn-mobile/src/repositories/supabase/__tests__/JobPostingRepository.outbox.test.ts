/**
 * U4: JobPostingRepository.enqueueScheduleBoardSync 검증
 *
 * outbox insert(snake_case 매핑)가 Service → Repository 로 이관됨.
 * - camelCase 입력 → snake_case row 매핑
 * - status='pending', retry_count=0 기본값
 * - enqueue 실패가 throw 되지 않고 warn 로그만 남김 (main mutation 비롤백)
 */

import { SupabaseJobPostingRepository } from '../JobPostingRepository';

const mockInsert = jest.fn();
const mockFrom = jest.fn();
const mockWarn = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: jest.fn(),
    channel: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: (...args: unknown[]) => mockWarn(...args),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@sentry/react-native', () => ({
  __esModule: true,
  addBreadcrumb: jest.fn(),
}));

const repo = new SupabaseJobPostingRepository();

beforeEach(() => {
  jest.clearAllMocks();
  mockFrom.mockImplementation((table: string) => {
    expect(table).toBe('schedule_board_sync_outbox');
    return { insert: (...args: unknown[]) => mockInsert(...args) };
  });
});

describe('JobPostingRepository.enqueueScheduleBoardSync', () => {
  it('camelCase 입력을 snake_case outbox row 로 매핑한다', async () => {
    mockInsert.mockResolvedValue({ error: null });

    await repo.enqueueScheduleBoardSync('job-1', 'create', { ownerId: 'owner-1' });

    expect(mockInsert).toHaveBeenCalledWith({
      job_posting_id: 'job-1',
      action: 'create',
      payload: { ownerId: 'owner-1' },
      status: 'pending',
      retry_count: 0,
    });
  });

  it('payload 미지정 시 빈 객체로 enqueue 한다', async () => {
    mockInsert.mockResolvedValue({ error: null });

    await repo.enqueueScheduleBoardSync('job-2', 'close');

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ job_posting_id: 'job-2', action: 'close', payload: {} })
    );
  });

  it('enqueue 실패 시 throw 하지 않고 warn 로그만 남긴다', async () => {
    mockInsert.mockResolvedValue({ error: { message: 'outbox down' } });

    await expect(repo.enqueueScheduleBoardSync('job-3', 'delete')).resolves.toBeUndefined();

    expect(mockWarn).toHaveBeenCalledWith(
      'Schedule board sync enqueue 실패',
      expect.objectContaining({ jobPostingId: 'job-3', action: 'delete', error: 'outbox down' })
    );
  });
});
