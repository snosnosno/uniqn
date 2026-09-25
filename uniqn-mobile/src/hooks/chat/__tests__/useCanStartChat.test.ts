/**
 * useCanStartChat — 서버 chat_open_conversation 의 거부 조건을 클라에서 먼저 거른다(코드 리뷰 M3)
 */
import { renderHook } from '@testing-library/react-native';
import { useCanStartChat } from '../useCanStartChat';

const mockWorkspaces = { workspaces: [] as { id: string }[] };
const mockShared = { sharedPostings: [] as { jobPostingId: string }[] };
jest.mock('@/hooks/workspace/useWorkspaces', () => ({ useWorkspaces: () => mockWorkspaces }));
jest.mock('@/hooks/job-posting/useSharedJobPostings', () => ({
  useSharedJobPostings: () => mockShared,
}));

const job = { id: 'job-1', status: 'active', ownerId: 'owner', workspaceId: 'ws-1' };

describe('useCanStartChat', () => {
  beforeEach(() => {
    mockWorkspaces.workspaces = [];
    mockShared.sharedPostings = [];
  });

  it('구직자(구인자 측 아님) + 게시 중이면 보인다', () => {
    const { result } = renderHook(() => useCanStartChat(job, 'seeker'));
    expect(result.current).toBe(true);
  });

  it.each([
    ['소유자', () => undefined, 'owner'],
    ['워크스페이스 멤버', () => (mockWorkspaces.workspaces = [{ id: 'ws-1' }]), 'manager'],
    ['공고 협업자', () => (mockShared.sharedPostings = [{ jobPostingId: 'job-1' }]), 'collab'],
  ])('%s 는 숨긴다(서버가 PERMISSION_DENIED)', (_label, arrange, uid) => {
    arrange();
    const { result } = renderHook(() => useCanStartChat(job, uid));
    expect(result.current).toBe(false);
  });

  it.each([['draft'], ['pending'], ['cancelled'], ['expired']])(
    '%s 공고는 숨긴다(서버 허용 목록 밖)',
    (status) => {
      const { result } = renderHook(() => useCanStartChat({ ...job, status }, 'seeker'));
      expect(result.current).toBe(false);
    }
  );

  it('비로그인·공고 없음이면 숨긴다', () => {
    expect(renderHook(() => useCanStartChat(job, null)).result.current).toBe(false);
    expect(renderHook(() => useCanStartChat(null, 'seeker')).result.current).toBe(false);
  });
});
