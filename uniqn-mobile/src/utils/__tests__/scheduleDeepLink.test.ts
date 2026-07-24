import { resolveApplicationDeepLink } from '@/utils/scheduleDeepLink';

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
