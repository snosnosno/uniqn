/**
 * WorkScheduleRepository — 그리드 읽기 RPC 래퍼 contract test
 *
 * 두 RPC 응답을 camelCase 로 투영(job_count→jobCount, work_log_id→workLogId 등)하는지와
 * 에러 전파를 검증한다. supabase.rpc 는 mock.
 */
import { SupabaseWorkScheduleRepository } from '../WorkScheduleRepository';

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: jest.fn(),
    channel: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/utils/supabase', () => {
  const actual = jest.requireActual('@/utils/supabase');
  return {
    ...actual,
    handleSupabaseError: (error: { message?: string } | null) => {
      throw new Error(`supabase: ${error?.message ?? 'unknown'}`);
    },
  };
});

beforeEach(() => mockRpc.mockReset());

describe('WorkScheduleRepository', () => {
  const repo = new SupabaseWorkScheduleRepository();

  describe('getVenueGridSummary', () => {
    it('job_count→jobCount 매핑 + 숫자 정규화', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [{ d: '2026-07-01', headcount: '3', job_count: '2', required_count: '4' }],
        error: null,
      });

      const rows = await repo.getVenueGridSummary('v1', '2026-07-01', '2026-07-31');

      expect(mockRpc).toHaveBeenCalledWith('get_venue_grid_summary', {
        p_venue: 'v1',
        p_from: '2026-07-01',
        p_to: '2026-07-31',
      });
      expect(rows).toEqual([{ d: '2026-07-01', headcount: 3, jobCount: 2, requiredCount: 4 }]);
    });

    it('required_count 를 requiredCount 로 매핑한다', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [{ d: '2026-08-10', headcount: 1, job_count: 2, required_count: 3 }],
        error: null,
      });
      const rows = await repo.getVenueGridSummary('v1', '2026-08-01', '2026-08-31');
      expect(rows[0]).toEqual({ d: '2026-08-10', headcount: 1, jobCount: 2, requiredCount: 3 });
    });

    it('빈 응답 → 빈 배열', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: null });
      expect(await repo.getVenueGridSummary('v1', '2026-07-01', '2026-07-31')).toEqual([]);
    });

    it('RPC 에러 전파', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
      await expect(repo.getVenueGridSummary('v1', 'a', 'b')).rejects.toThrow('supabase: boom');
    });
  });

  describe('getVenueDaySlots', () => {
    it('snake_case 행 → camelCase 슬롯 투영', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            work_log_id: 'w1',
            staff_id: 's1',
            staff_name: '홍길동',
            staff_nickname: null,
            staff_photo_url: null,
            role: 'dealer',
            custom_role: null,
            time_slot: '19:00',
            status: 'scheduled',
            job_posting_id: 'v1',
            is_container: true,
            color: null,
            notes: null,
          },
        ],
        error: null,
      });

      const slots = await repo.getVenueDaySlots('v1', '2026-07-01');

      expect(mockRpc).toHaveBeenCalledWith('get_venue_day_slots', {
        p_venue: 'v1',
        p_date: '2026-07-01',
      });
      expect(slots[0]).toMatchObject({
        workLogId: 'w1',
        staffId: 's1',
        staffName: '홍길동',
        timeSlot: '19:00',
        jobPostingId: 'v1',
        isContainer: true,
        role: 'dealer',
      });
    });

    it('RPC 에러 전파', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'denied' } });
      await expect(repo.getVenueDaySlots('v1', '2026-07-01')).rejects.toThrow('supabase: denied');
    });
  });

  describe('setVenueSoftTarget', () => {
    it('날짜를 YYYY-MM-DD 로 정규화(E5)해 RPC 호출(시간성분 제거)', async () => {
      mockRpc.mockResolvedValueOnce({ data: { count: 3 }, error: null });

      await repo.setVenueSoftTarget('v1', '2026-07-05T23:30:00', 3);

      expect(mockRpc).toHaveBeenCalledWith('set_venue_soft_target', {
        p_venue: 'v1',
        p_date: '2026-07-05',
        p_count: 3,
      });
    });

    it('count=0(키 제거 의미)도 그대로 전달', async () => {
      mockRpc.mockResolvedValueOnce({ data: { count: 0 }, error: null });

      await repo.setVenueSoftTarget('v1', '2026-07-05', 0);

      expect(mockRpc).toHaveBeenCalledWith('set_venue_soft_target', {
        p_venue: 'v1',
        p_date: '2026-07-05',
        p_count: 0,
      });
    });

    it('RPC 에러 전파', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'PERMISSION_DENIED' } });
      await expect(repo.setVenueSoftTarget('v1', '2026-07-05', 1)).rejects.toThrow(
        'supabase: PERMISSION_DENIED'
      );
    });
  });
});
