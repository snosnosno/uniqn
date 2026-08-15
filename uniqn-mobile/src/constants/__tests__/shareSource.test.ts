import {
  SHARE_SOURCES,
  SHARE_SOURCE_QUERY_KEY,
  isShareSource,
  readShareSource,
} from '../shareSource';
import { createJobDeepLink } from '@/services/observability/internal/deepLinkRouteSerializer';

/**
 * 공유 출처 (S3-5).
 *
 * 🔒 `src` 는 **URL 에 그대로 노출된다** — 누구나 바꿔 넣을 수 있다.
 *    받는 쪽에서 화이트리스트로 거르지 않으면 조작된 값이 그대로 서버 집계에 쌓이고,
 *    오타·실험값까지 영구히 누적돼 카디널리티가 터진다. 그 방어를 여기서 고정한다.
 */

describe('isShareSource / readShareSource', () => {
  it('알려진 출처만 통과시킨다', () => {
    expect(isShareSource(SHARE_SOURCES.employerDetail)).toBe(true);
    expect(isShareSource(SHARE_SOURCES.publicDetail)).toBe(true);
  });

  it('🔒 모르는 값은 거른다 — URL 로 들어온 임의 문자열이 계측에 실리면 안 된다', () => {
    expect(isShareSource('naver_ad')).toBe(false);
    expect(isShareSource('')).toBe(false);
    expect(isShareSource(undefined)).toBe(false);
    expect(isShareSource(123)).toBe(false);
    expect(isShareSource({ toString: () => 'employer_detail' })).toBe(false);
  });

  it('expo-router 가 배열로 주면 첫 값을 본다', () => {
    expect(readShareSource([SHARE_SOURCES.seekerDetail, 'junk'])).toBe(SHARE_SOURCES.seekerDetail);
  });

  it('배열 첫 값이 모르는 값이면 undefined', () => {
    expect(readShareSource(['made_up'])).toBeUndefined();
    expect(readShareSource(undefined)).toBeUndefined();
  });
});

describe('createJobDeepLink — 출처 부착', () => {
  it('출처를 안 주면 기존과 완전히 같은 URL 이다 (기존 호출부 무영향)', () => {
    expect(createJobDeepLink('job-1', true)).toBe('https://uniqn.app/jobs/job-1');
  });

  it('출처를 주면 ?src= 가 붙는다', () => {
    expect(createJobDeepLink('job-1', true, SHARE_SOURCES.employerDetail)).toBe(
      `https://uniqn.app/jobs/job-1?${SHARE_SOURCE_QUERY_KEY}=employer_detail`
    );
  });

  it('스킴 링크에도 같은 규칙으로 붙는다', () => {
    expect(createJobDeepLink('job-1', false, SHARE_SOURCES.employerList)).toContain(
      `?${SHARE_SOURCE_QUERY_KEY}=employer_list`
    );
  });

  it('출처 값이 서로 겹치지 않는다 — 겹치면 집계에서 구분이 사라진다', () => {
    const values = Object.values(SHARE_SOURCES);
    expect(new Set(values).size).toBe(values.length);
  });
});
