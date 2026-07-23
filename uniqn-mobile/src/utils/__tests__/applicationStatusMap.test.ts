import { buildJobApplicationStatusMap } from '@/utils/applicationStatusMap';

describe('buildJobApplicationStatusMap', () => {
  it('활성 상태(applied/confirmed)를 jobPostingId 키로 맵에 담는다', () => {
    const map = buildJobApplicationStatusMap([
      { jobPostingId: 'job-1', status: 'applied' },
      { jobPostingId: 'job-2', status: 'confirmed' },
    ]);

    expect(map.get('job-1')).toBe('applied');
    expect(map.get('job-2')).toBe('confirmed');
  });

  it('cancellation_pending은 아직 활성 지원이므로 applied로 표시한다', () => {
    const map = buildJobApplicationStatusMap([
      { jobPostingId: 'job-1', status: 'cancellation_pending' },
    ]);

    expect(map.get('job-1')).toBe('applied');
  });

  it('rejected/cancelled/completed는 맵에서 제외한다', () => {
    const map = buildJobApplicationStatusMap([
      { jobPostingId: 'job-1', status: 'rejected' },
      { jobPostingId: 'job-2', status: 'cancelled' },
      { jobPostingId: 'job-3', status: 'completed' },
    ]);

    expect(map.size).toBe(0);
  });

  it('같은 공고에 applied와 confirmed가 섞이면 순서와 무관하게 confirmed가 우선한다', () => {
    const confirmedFirst = buildJobApplicationStatusMap([
      { jobPostingId: 'job-1', status: 'confirmed' },
      { jobPostingId: 'job-1', status: 'applied' },
    ]);
    const appliedFirst = buildJobApplicationStatusMap([
      { jobPostingId: 'job-1', status: 'applied' },
      { jobPostingId: 'job-1', status: 'confirmed' },
    ]);

    expect(confirmedFirst.get('job-1')).toBe('confirmed');
    expect(appliedFirst.get('job-1')).toBe('confirmed');
  });
});
