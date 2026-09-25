/**
 * useTrackChatOpen — 마운트당 1회, 진입점 method 정규화
 */
import { renderHook } from '@testing-library/react-native';
import { toChatOpenMethod, useTrackChatOpen } from '../useTrackChatOpen';

const P1 = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

const mockTrack = jest.fn();
jest.mock('@/services/observability/analyticsService', () => ({
  trackEvent: (...a: unknown[]) => mockTrack(...a),
}));

describe('useTrackChatOpen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('같은 공고로 재렌더돼도 한 번만 보낸다', () => {
    const { rerender } = renderHook(
      ({ id }: { id: string | null }) => useTrackChatOpen(id, 'job_detail'),
      { initialProps: { id: P1 } }
    );
    rerender({ id: P1 });
    rerender({ id: P1 });

    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith('chat_open', { job_id: P1, method: 'job_detail' });
  });

  it('uuid 가 아닌 값(조작된 딥링크)은 계측 테이블에 싣지 않는다', () => {
    renderHook(() => useTrackChatOpen('<script>내 번호 010-1234-5678</script>', 'job_detail'));
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it('공고 id 를 아직 모르면 보내지 않는다', () => {
    renderHook(() => useTrackChatOpen(null, 'list'));
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it('모르는 src 는 list 로 정규화한다(자유 문자열이 서버에 쌓이지 않게)', () => {
    expect(toChatOpenMethod('evil<script>')).toBe('list');
    expect(toChatOpenMethod(undefined)).toBe('list');
    expect(toChatOpenMethod('posting_tile')).toBe('posting_tile');
  });
});
