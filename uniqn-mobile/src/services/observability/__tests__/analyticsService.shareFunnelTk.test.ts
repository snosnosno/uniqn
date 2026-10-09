/**
 * 공유 퍼널 `tk`(anon 통행권) 계약 — #478 잔여.
 *
 * 서버 가드(`fn_analytics_events_guard`)는 anon INSERT 에 두 가지를 건다:
 *   ① `props.tk` 가 4~16자여야 한다(아니면 P0001)
 *   ② 같은 `tk` 는 시간당 120건까지(넘으면 P0001)
 * repository 는 계측 원칙상 에러를 삼키므로 둘 중 무엇에 걸려도 **무음으로 사라진다.**
 * 그래서 형식(①)과 "공고 하나가 상한을 독점하지 않는다"(②)를 클라이언트 쪽에서 고정한다.
 */
import { buildShareFunnelTk, trackShareFunnel } from '../analyticsService';

const mockInsert = jest.fn((_event: string, _props: Record<string, unknown>) => Promise.resolve());

// analyticsService 는 배럴이 아니라 이 경로로 가져온다(productionRail 테스트와 같은 지점을 막는다).
jest.mock('@/repositories/supabase/AnalyticsEventRepository', () => ({
  analyticsEventRepository: {
    insert: (event: string, props: Record<string, unknown>) => mockInsert(event, props),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const JOB_ID = '8f3c1a2b-4d5e-4f60-9a7b-1c2d3e4f5a6b';

beforeEach(() => {
  mockInsert.mockClear();
});

describe('buildShareFunnelTk', () => {
  it('공고 id 앞 8자 + 방문자 버킷 — 가드가 받는 길이(4~16자) 안이다', () => {
    const tk = buildShareFunnelTk(JOB_ID);
    expect(tk.startsWith('8f3c1a2b')).toBe(true);
    expect(tk).toHaveLength(12);
    expect(tk.length).toBeGreaterThanOrEqual(4);
    expect(tk.length).toBeLessThanOrEqual(16);
  });

  it('🔑 같은 공고라도 방문자가 다르면 tk 가 다르다 — 시간당 120건 상한이 공고 하나에 걸리지 않는다', () => {
    expect(buildShareFunnelTk(JOB_ID, 'aaaa')).not.toBe(buildShareFunnelTk(JOB_ID, 'bbbb'));
  });

  it('같은 방문자·같은 공고는 tk 가 같다 — 한 기기의 폭주는 여전히 상한에 걸린다', () => {
    expect(buildShareFunnelTk(JOB_ID)).toBe(buildShareFunnelTk(JOB_ID));
  });

  it('공고 id 가 짧아도 가드 하한(4자)을 넘는다', () => {
    expect(buildShareFunnelTk('', 'ab12').length).toBeGreaterThanOrEqual(4);
  });
});

describe('trackShareFunnel', () => {
  it('영속 레일에 job_id(전체)와 tk 를 함께 싣는다 — 집계 키는 job_id, tk 는 통행권', () => {
    trackShareFunnel('job_share_opened', { job_id: JOB_ID, src: 'public_detail' });

    expect(mockInsert).toHaveBeenCalledTimes(1);
    const [event, props] = mockInsert.mock.calls[0];
    expect(event).toBe('job_share_opened');
    expect(props).toEqual({ job_id: JOB_ID, tk: buildShareFunnelTk(JOB_ID), src: 'public_detail' });
    // 옛 값(공고 id 앞 8자뿐)으로 되돌아가면 상한이 다시 공고 하나에 걸린다
    expect(props.tk).not.toBe(JOB_ID.slice(0, 8));
  });
});
