/**
 * 목록 화면의 확정 인원 조회 회귀 방어.
 *
 * 1) 무한 스크롤로 공고 ID 가 늘면 조회 키가 바뀐다. 직전 값을 붙잡지 않으면 새 결과가 올
 *    때까지 이미 보이던 카드의 "n/m 확정" 숫자가 사라졌다 다시 나타난다(깜빡임).
 * 2) 카드마다 전역맵 전체를 훑으면 카드 수 × 맵 크기 비용이 든다 — 목록은 한 번에 묶는다.
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { groupPostingFilledCounts, usePostingFilledCounts } from '@/hooks/usePostingFilledCounts';

const mockGetPostingFilledCounts = jest.fn();

// jest.setup.js 가 useQuery 를 전역 스텁으로 덮는다 — 캐시 전이를 보려면 실제 구현이 필요하다.
jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

jest.mock('@/repositories', () => ({
  jobPostingRepository: {
    getPostingFilledCounts: (ids: string[]) => mockGetPostingFilledCounts(ids),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('groupPostingFilledCounts', () => {
  it('전역맵을 공고별 서브맵(접두 제거)으로 한 번에 묶는다', () => {
    const global = new Map<string, number>([
      ['jp-1__FIXED_SCHEDULE__19:00__dealer', 2],
      ['jp-1__2026-07-20__14:00__floor', 1],
      ['jp-2__2026-07-21__10:00__dealer', 5],
    ]);

    const grouped = groupPostingFilledCounts(global);

    expect(grouped.size).toBe(2);
    expect(grouped.get('jp-1')?.get('FIXED_SCHEDULE__19:00__dealer')).toBe(2);
    expect(grouped.get('jp-1')?.get('2026-07-20__14:00__floor')).toBe(1);
    expect(grouped.get('jp-1')?.size).toBe(2);
    expect(grouped.get('jp-2')?.get('2026-07-21__10:00__dealer')).toBe(5);
  });

  it('extractPostingFilledSubmap 과 같은 결과를 낸다', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { extractPostingFilledSubmap } = require('@/hooks/usePostingFilledCounts');
    const global = new Map<string, number>([
      ['jp-1__a__b__c', 1],
      ['jp-2__d__e__f', 3],
    ]);
    const grouped = groupPostingFilledCounts(global);

    expect(grouped.get('jp-1')).toEqual(extractPostingFilledSubmap(global, 'jp-1'));
    expect(grouped.get('jp-2')).toEqual(extractPostingFilledSubmap(global, 'jp-2'));
  });

  it('빈 맵/undefined 는 빈 결과', () => {
    expect(groupPostingFilledCounts(undefined).size).toBe(0);
    expect(groupPostingFilledCounts(new Map()).size).toBe(0);
  });
});

describe('usePostingFilledCounts keepPrevious', () => {
  beforeEach(() => mockGetPostingFilledCounts.mockReset());

  it('ID 가 늘어 키가 바뀌는 동안 직전 값을 유지한다 (깜빡임 방지)', async () => {
    let resolveSecond: (value: Map<string, number>) => void = () => undefined;
    mockGetPostingFilledCounts
      .mockResolvedValueOnce(new Map([['jp-1__a__b__c', 2]]))
      .mockImplementationOnce(
        () =>
          new Promise<Map<string, number>>((resolve) => {
            resolveSecond = resolve;
          })
      );

    const { result, rerender } = renderHook(
      ({ ids }: { ids: string[] }) => usePostingFilledCounts(ids, { keepPrevious: true }),
      { wrapper: createWrapper(), initialProps: { ids: ['jp-1'] } }
    );
    await waitFor(() => expect(result.current.data?.get('jp-1__a__b__c')).toBe(2));

    rerender({ ids: ['jp-1', 'jp-2'] });

    // 두 번째 조회가 아직 진행 중이어도 jp-1 의 숫자는 남아 있어야 한다
    expect(result.current.data?.get('jp-1__a__b__c')).toBe(2);

    resolveSecond(
      new Map([
        ['jp-1__a__b__c', 2],
        ['jp-2__d__e__f', 1],
      ])
    );
    await waitFor(() => expect(result.current.data?.get('jp-2__d__e__f')).toBe(1));
  });

  it('기본값은 직전 값을 유지하지 않는다 — 상세 화면이 다른 공고 숫자를 잠깐 보이면 안 된다', async () => {
    mockGetPostingFilledCounts
      .mockResolvedValueOnce(new Map([['jp-1__a__b__c', 2]]))
      .mockImplementationOnce(() => new Promise(() => undefined));

    const { result, rerender } = renderHook(
      ({ ids }: { ids: string[] }) => usePostingFilledCounts(ids),
      { wrapper: createWrapper(), initialProps: { ids: ['jp-1'] } }
    );
    await waitFor(() => expect(result.current.data).toBeDefined());

    rerender({ ids: ['jp-2'] });

    expect(result.current.data).toBeUndefined();
  });
});
