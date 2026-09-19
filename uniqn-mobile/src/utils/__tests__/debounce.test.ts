import { createDebouncedTrigger, REALTIME_RELOAD_DEBOUNCE_MS } from '@/utils/debounce';

describe('createDebouncedTrigger', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('고립된 변경 1건은 지연 없이 즉시 실행한다', () => {
    const fn = jest.fn();
    const { trigger } = createDebouncedTrigger(fn, 300);

    trigger();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('창이 조용히 지나가면 트레일링 실행이 없다 (단발은 정확히 1회)', () => {
    const fn = jest.fn();
    const { trigger } = createDebouncedTrigger(fn, 300);

    trigger();
    jest.advanceTimersByTime(1000);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('창 안의 버스트 N건을 리딩 1 + 트레일링 1 = 2회로 접는다', () => {
    const fn = jest.fn();
    const { trigger } = createDebouncedTrigger(fn, 300);

    // 한 번의 일괄 작업이 만드는 10개 행 변경
    for (let i = 0; i < 10; i += 1) {
      trigger();
    }

    // 리딩만 실행된 상태
    expect(fn).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(300);

    // 나머지 9건이 트레일링 1회로 접혔다 — 예전이라면 10회 전체 재조회였다
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('끊이지 않는 스트림에서도 창당 최대 1회로 상한이 걸린다', () => {
    const fn = jest.fn();
    const { trigger } = createDebouncedTrigger(fn, 300);

    // 100ms 간격으로 30회 = 3초간 지속되는 변경 스트림
    for (let i = 0; i < 30; i += 1) {
      trigger();
      jest.advanceTimersByTime(100);
    }

    // 3초 / 300ms = 10 창 + 리딩 1회. 30회가 아니라는 것이 요점이다.
    expect(fn.mock.calls.length).toBeLessThanOrEqual(11);
    expect(fn.mock.calls.length).toBeGreaterThan(1);
  });

  it('창이 닫힌 뒤 오는 변경은 다시 즉시 실행된다 (지연 누적 없음)', () => {
    const fn = jest.fn();
    const { trigger } = createDebouncedTrigger(fn, 300);

    trigger();
    jest.advanceTimersByTime(500);
    trigger();

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('cancel 이후에는 대기 중이던 트레일링이 실행되지 않는다 (구독 해제 누수 방지)', () => {
    const fn = jest.fn();
    const { trigger, cancel } = createDebouncedTrigger(fn, 300);

    trigger();
    trigger();
    expect(fn).toHaveBeenCalledTimes(1);

    cancel();
    jest.advanceTimersByTime(1000);

    // cancel 하지 않으면 이미 정리된 구독의 소비자에게 갱신이 한 번 더 밀려든다
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('기본 병합 창은 300ms 다', () => {
    expect(REALTIME_RELOAD_DEBOUNCE_MS).toBe(300);
  });
});
