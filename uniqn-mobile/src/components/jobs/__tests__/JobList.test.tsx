/**
 * JobList — 카드에 내려주는 공유·확정 인원 배선 회귀 방어.
 *
 * - 공유 훅은 목록에 하나만 두고, 카드에는 공고 ID 만 받는 안정 콜백을 준다.
 * - 같은 프레임 연타는 훅의 isSharing 가드(리렌더 뒤 반영)가 못 막으므로 목록이 동기로 막는다.
 * - 확정 인원 전역맵은 목록이 공고별로 한 번 묶어 각 카드에 자기 서브맵만 준다.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import type { JobPostingCard } from '@/types';
import { JobList } from '../JobList';

const mockShareJobById = jest.fn();
const mockJobCard = jest.fn((_props: Record<string, unknown>) => null);

jest.mock('@/hooks/useShare', () => ({
  useShare: () => ({ shareJobById: mockShareJobById, isSharing: false }),
}));

jest.mock('../JobCard', () => ({
  JobCard: (props: Record<string, unknown>) => mockJobCard(props),
}));

jest.mock('@/components/ui/AppFlashList', () => ({
  AppFlashList: ({
    data,
    renderItem,
  }: {
    data: unknown[];
    renderItem: (info: { item: unknown; index: number }) => React.ReactNode;
  }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { View } = require('react-native');
    return <View>{data.map((item, index) => renderItem({ item, index }))}</View>;
  },
}));

const jobs = [{ id: 'jp-1' }, { id: 'jp-2' }] as unknown as JobPostingCard[];

function renderList(filledCounts?: Map<string, number>) {
  return render(
    <JobList
      jobs={jobs}
      isLoading={false}
      isRefreshing={false}
      isFetchingMore={false}
      hasMore={false}
      onRefresh={jest.fn()}
      onLoadMore={jest.fn()}
      onJobPress={jest.fn()}
      filledCounts={filledCounts}
    />
  );
}

function cardProps(jobId: string) {
  const call = mockJobCard.mock.calls.find(([props]) => (props.job as { id: string }).id === jobId);
  return call?.[0] as { onShare: (id: string) => void; filledSubmap?: Map<string, number> };
}

describe('JobList', () => {
  beforeEach(() => {
    mockJobCard.mockClear();
    mockShareJobById.mockReset();
  });

  it('카드의 onShare 는 공고 ID 로 목록의 shareJobById 를 부른다', async () => {
    mockShareJobById.mockResolvedValue({ success: true });
    renderList();

    cardProps('jp-2').onShare('jp-2');

    expect(mockShareJobById).toHaveBeenCalledWith('jp-2');
  });

  it('공유가 끝나기 전 연타는 한 번만 공유한다', async () => {
    let finish: () => void = () => undefined;
    mockShareJobById.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ success: true });
        })
    );
    renderList();
    const { onShare } = cardProps('jp-1');

    onShare('jp-1');
    onShare('jp-1');
    expect(mockShareJobById).toHaveBeenCalledTimes(1);

    finish();
    await Promise.resolve();
    await Promise.resolve();

    onShare('jp-1');
    expect(mockShareJobById).toHaveBeenCalledTimes(2);
  });

  it('각 카드에 자기 공고의 확정 서브맵만 넘긴다', () => {
    renderList(
      new Map([
        ['jp-1__2026-10-01__18:00__dealer', 2],
        ['jp-2__2026-10-02__19:00__floor', 1],
      ])
    );

    expect(cardProps('jp-1').filledSubmap).toEqual(new Map([['2026-10-01__18:00__dealer', 2]]));
    expect(cardProps('jp-2').filledSubmap).toEqual(new Map([['2026-10-02__19:00__floor', 1]]));
  });
});
