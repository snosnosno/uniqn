/**
 * useBulkShareSelection 계약 테스트
 *
 * 선택 단계가 첫 번째 방어선이다 — 공유 불가 공고는 고를 수 없어야 하고,
 * 상한을 넘는 선택은 조용히 무시되는 게 아니라 안내와 함께 거부되어야 한다.
 */

import { act, renderHook } from '@testing-library/react-native';
import { useBulkShareSelection, type ShareSelectable } from '../useBulkShareSelection';

const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  warning: jest.fn(),
  info: jest.fn(),
};

jest.mock('@/stores/toastStore', () => ({
  useToast: () => mockToast,
}));

const active = (id: string): ShareSelectable => ({ id, status: 'active', postingType: 'regular' });
const closed = (id: string): ShareSelectable => ({ id, status: 'closed', postingType: 'regular' });
const pendingTournament = (id: string): ShareSelectable =>
  ({
    id,
    status: 'active',
    postingType: 'tournament',
    tournamentConfig: { approvalStatus: 'pending' },
  }) as ShareSelectable;

describe('useBulkShareSelection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('선택 모드 진입/종료 시 선택이 초기화된다', () => {
    const { result } = renderHook(() => useBulkShareSelection());

    expect(result.current.isSelectionMode).toBe(false);

    act(() => result.current.enterSelectionMode());
    act(() => result.current.toggle(active('a')));
    expect(result.current.selectedCount).toBe(1);

    act(() => result.current.exitSelectionMode());
    expect(result.current.isSelectionMode).toBe(false);
    expect(result.current.selectedCount).toBe(0);
  });

  it('토글은 선택/해제를 반복한다', () => {
    const { result } = renderHook(() => useBulkShareSelection());

    act(() => result.current.toggle(active('a')));
    expect(result.current.isSelected('a')).toBe(true);

    act(() => result.current.toggle(active('a')));
    expect(result.current.isSelected('a')).toBe(false);
  });

  it('마감 공고는 선택할 수 없고 안내한다', () => {
    const { result } = renderHook(() => useBulkShareSelection());

    expect(result.current.canSelect(closed('a'))).toBe(false);
    act(() => result.current.toggle(closed('a')));

    expect(result.current.selectedCount).toBe(0);
    expect(mockToast.error).toHaveBeenCalled();
  });

  it('승인 대기 대회도 선택할 수 없다', () => {
    const { result } = renderHook(() => useBulkShareSelection());

    expect(result.current.canSelect(pendingTournament('t'))).toBe(false);
    act(() => result.current.toggle(pendingTournament('t')));
    expect(result.current.selectedCount).toBe(0);
  });

  it('상한(10건)을 넘는 선택은 거부하고 안내한다', () => {
    const { result } = renderHook(() => useBulkShareSelection());

    act(() => {
      Array.from({ length: 10 }, (_, i) => active(`p${i}`)).forEach((posting) =>
        result.current.toggle(posting)
      );
    });
    expect(result.current.selectedCount).toBe(10);

    act(() => result.current.toggle(active('overflow')));

    expect(result.current.selectedCount).toBe(10);
    expect(result.current.isSelected('overflow')).toBe(false);
    expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('10건'));
  });

  it('전체선택은 공유 가능한 것만, 상한까지만 고른다', () => {
    const { result } = renderHook(() => useBulkShareSelection());
    const list = [
      ...Array.from({ length: 12 }, (_, i) => active(`ok${i}`)),
      closed('closed-1'),
      pendingTournament('pending-1'),
    ];

    act(() => result.current.selectAll(list));

    expect(result.current.selectedCount).toBe(10);
    expect(result.current.isSelected('closed-1')).toBe(false);
    expect(result.current.isSelected('pending-1')).toBe(false);
    // 잘린 사실을 조용히 넘기지 않는다
    expect(mockToast.info).toHaveBeenCalled();
  });

  it('clear 는 선택만 비우고 선택 모드는 유지한다', () => {
    const { result } = renderHook(() => useBulkShareSelection());

    act(() => result.current.enterSelectionMode());
    act(() => result.current.toggle(active('a')));
    act(() => result.current.clear());

    expect(result.current.selectedCount).toBe(0);
    expect(result.current.isSelectionMode).toBe(true);
  });
});
