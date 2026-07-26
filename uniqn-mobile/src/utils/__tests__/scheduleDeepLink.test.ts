import {
  advanceDeepLinkGate,
  buildApplicationDeepLinkKey,
  resolveApplicationDeepLink,
  resolveMissingApplicationDeepLink,
  DEEP_LINK_APPLICATION_NOT_FOUND_MESSAGE,
} from '@/utils/scheduleDeepLink';

const schedule = (applicationId: string) => ({ applicationId }) as { applicationId?: string };

describe('resolveApplicationDeepLink', () => {
  it('applicationId가 일치하는 스케줄이 있으면 open을 반환한다', () => {
    const target = schedule('app-1');
    const result = resolveApplicationDeepLink([schedule('app-0'), target], 'app-1', false, null);

    expect(result).toEqual({ kind: 'open', schedule: target });
  });

  it('로딩 중이면 판정을 유보한다(defer)', () => {
    expect(resolveApplicationDeepLink([], 'app-1', true, null)).toEqual({ kind: 'defer' });
  });

  it('에러 상태면 오탐 안내를 피하기 위해 유보한다(defer)', () => {
    expect(resolveApplicationDeepLink([], 'app-1', false, new Error('network'))).toEqual({
      kind: 'defer',
    });
  });

  it('로딩 완료 후에도 매치가 없으면 missing을 반환한다 (거절/취소로 쿼리에서 제외된 지원)', () => {
    expect(resolveApplicationDeepLink([schedule('app-0')], 'app-1', false, null)).toEqual({
      kind: 'missing',
    });
  });

  it('스케줄이 0건이어도 로딩이 끝났으면 missing을 반환한다', () => {
    expect(resolveApplicationDeepLink([], 'app-1', false, null)).toEqual({ kind: 'missing' });
  });
});

describe('buildApplicationDeepLinkKey', () => {
  it('처리할 파라미터가 없으면 null을 반환한다', () => {
    expect(buildApplicationDeepLinkKey({})).toBeNull();
  });

  it('applicationId와 cancelApplicationId를 구분되는 키로 만든다', () => {
    const openKey = buildApplicationDeepLinkKey({ applicationId: 'app-1' });
    const cancelKey = buildApplicationDeepLinkKey({ cancelApplicationId: 'app-1' });

    expect(openKey).not.toBeNull();
    expect(openKey).not.toBe(cancelKey);
  });

  it('같은 파라미터면 같은 키를 만든다', () => {
    expect(buildApplicationDeepLinkKey({ applicationId: 'app-1' })).toBe(
      buildApplicationDeepLinkKey({ applicationId: 'app-1' })
    );
  });
});

describe('advanceDeepLinkGate', () => {
  it('첫 딥링크는 처리한다', () => {
    const { next, shouldProcess } = advanceDeepLinkGate(null, 'k1');

    expect(shouldProcess).toBe(true);
    expect(next).toEqual({ key: 'k1', retried: false, done: false });
  });

  it('처리 완료한 같은 키는 다시 처리하지 않는다', () => {
    const gate = { key: 'k1', retried: true, done: true };

    expect(advanceDeepLinkGate(gate, 'k1').shouldProcess).toBe(false);
  });

  it('같은 키라도 아직 끝나지 않았으면 계속 진행한다 (refresh 재검증 중)', () => {
    const gate = { key: 'k1', retried: true, done: false };

    const { next, shouldProcess } = advanceDeepLinkGate(gate, 'k1');
    expect(shouldProcess).toBe(true);
    // 소진한 retry 기회는 같은 키 안에서 유지된다 — 무한 refresh 루프 방지
    expect(next.retried).toBe(true);
  });

  // 회귀 방어: boolean 1회성 플래그였을 때 두 번째 알림이 영구 무반응이던 결함.
  // (tabs) 스크린은 언마운트되지 않으므로 앱 재시작 전까지 복구되지 않았다.
  it('처리 완료 후 다른 딥링크가 오면 새로 처리하고 retry 기회도 되돌린다', () => {
    const handled = { key: 'k1', retried: true, done: true };

    const { next, shouldProcess } = advanceDeepLinkGate(handled, 'k2');

    expect(shouldProcess).toBe(true);
    expect(next).toEqual({ key: 'k2', retried: false, done: false });
  });
});

describe('resolveMissingApplicationDeepLink', () => {
  const july = { year: 2026, month: 7 };

  it('지원서를 못 찾으면 삭제/권한 안내를 낸다', () => {
    expect(resolveMissingApplicationDeepLink(null, july, false)).toEqual({
      kind: 'notice',
      message: DEEP_LINK_APPLICATION_NOT_FOUND_MESSAGE,
    });
  });

  it('거절된 지원은 거절 사실을 그대로 알린다', () => {
    const result = resolveMissingApplicationDeepLink({ status: 'rejected' }, july, false);

    expect(result.kind).toBe('notice');
    expect(result.kind === 'notice' && result.message).toContain('거절');
  });

  it('취소된 지원은 취소 사실을 그대로 알린다', () => {
    const result = resolveMissingApplicationDeepLink({ status: 'cancelled' }, july, false);

    expect(result.kind).toBe('notice');
    expect(result.kind === 'notice' && result.message).toContain('취소');
  });

  // 회귀 방어: 다른 달 확정 알림에 '거절되었거나 취소되어' 안내가 뜨던 결함.
  // 확정된 지원인데 사실과 정반대 안내가 나가 알림 신뢰를 직접 깎았다.
  it('확정 지원의 근무월이 다르면 그 달로 점프한다', () => {
    const result = resolveMissingApplicationDeepLink(
      { status: 'confirmed', jobPostingDate: '2026-08-03' },
      july,
      false
    );

    expect(result).toEqual({ kind: 'jump-month', year: 2026, month: 8 });
  });

  it('여러 근무일이면 가장 이른 날짜의 달로 점프한다', () => {
    const result = resolveMissingApplicationDeepLink(
      { status: 'confirmed', jobPosting: { workDates: ['2026-09-02', '2026-08-30'] } },
      july,
      false
    );

    expect(result).toEqual({ kind: 'jump-month', year: 2026, month: 8 });
  });

  it('이미 그 달을 보고 있는데도 없으면 점프하지 않고 안내한다', () => {
    const result = resolveMissingApplicationDeepLink(
      { status: 'confirmed', jobPostingDate: '2026-07-10' },
      july,
      false
    );

    expect(result.kind).toBe('notice');
  });

  it('이미 한 번 점프했으면 다시 점프하지 않는다 (무한 점프 방지)', () => {
    const result = resolveMissingApplicationDeepLink(
      { status: 'confirmed', jobPostingDate: '2026-08-03' },
      july,
      true
    );

    expect(result.kind).toBe('notice');
  });
});
