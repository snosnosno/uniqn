/**
 * useOptimisticLockBaseline — 낙관적 잠금 baseline 동결 계약 (W1-9 / EDIT-2).
 *
 * @description 이 훅의 존재 이유는 **baseline 이 살아 움직이면 잠금이 무의미하다**는 것 하나다.
 *   공고 편집 화면은 상세 화면과 같은 queryKey 를 공유하는데, 상세 레이아웃이 realtime 구독으로
 *   `setQueryData` 를 호출하면 편집 화면이 읽는 `updatedAt` 도 같이 갱신된다. baseline 을 그
 *   살아있는 값에서 매번 읽으면 협업자가 저장한 순간 내 baseline 도 최신으로 따라가버려
 *   `.eq('updated_at', …)` 가 항상 매칭된다 — 잠금을 건 적이 없는 것과 같아진다.
 */
import { renderHook, act } from '@testing-library/react-native';

import { useOptimisticLockBaseline } from '../useOptimisticLockBaseline';

const FIRST = '2026-07-01T00:00:00.000Z';
const LATER = '2026-07-01T09:30:00.000Z';

describe('useOptimisticLockBaseline', () => {
  it('처음 관측한 updatedAt 을 baseline 으로 동결한다', () => {
    const { result } = renderHook(() => useOptimisticLockBaseline(FIRST));

    expect(result.current.expectedUpdatedAt).toBe(FIRST);
  });

  it('공고가 아직 안 왔으면(undefined) baseline 은 없다', () => {
    const { result } = renderHook(() => useOptimisticLockBaseline(undefined));

    expect(result.current.expectedUpdatedAt).toBeNull();
  });

  it('공고가 늦게 도착해도 그 시점 값으로 동결한다', () => {
    const { result, rerender } = renderHook(
      ({ at }: { at: string | undefined }) => useOptimisticLockBaseline(at),
      { initialProps: { at: undefined as string | undefined } }
    );

    expect(result.current.expectedUpdatedAt).toBeNull();
    rerender({ at: FIRST });
    expect(result.current.expectedUpdatedAt).toBe(FIRST);
  });

  it('🔒 realtime 갱신이 baseline 을 밀어올리지 못한다 — 밀리면 잠금이 통째로 무력화된다', () => {
    const { result, rerender } = renderHook(
      ({ at }: { at: string | undefined }) => useOptimisticLockBaseline(at),
      { initialProps: { at: FIRST as string | undefined } }
    );

    // 협업자가 저장 → 상세 레이아웃의 realtime 구독이 공유 캐시를 갈아치운 상황.
    rerender({ at: LATER });

    expect(result.current.expectedUpdatedAt).toBe(FIRST);
  });

  it('충돌 안내 후 잠금을 놓으면 다음 저장은 덮어쓰기로 나간다', () => {
    const { result } = renderHook(() => useOptimisticLockBaseline(FIRST));

    act(() => result.current.releaseForOverwrite());

    expect(result.current.expectedUpdatedAt).toBeNull();
  });

  it('잠금을 놓은 뒤 realtime 갱신이 와도 다시 잠기지 않는다 (데드엔드 방지)', () => {
    const { result, rerender } = renderHook(
      ({ at }: { at: string | undefined }) => useOptimisticLockBaseline(at),
      { initialProps: { at: FIRST as string | undefined } }
    );

    act(() => result.current.releaseForOverwrite());
    rerender({ at: LATER });

    expect(result.current.expectedUpdatedAt).toBeNull();
  });
});
