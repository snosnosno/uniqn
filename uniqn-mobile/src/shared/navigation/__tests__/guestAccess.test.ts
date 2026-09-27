import { isGuestAuthState, isGuestBrowsableRoute } from '@/shared/navigation/guestAccess';

describe('isGuestAuthState — 가드(!user)와 화면이 같은 게스트 판정을 쓴다', () => {
  it.each([
    [{ status: 'unauthenticated', user: null }, true],
    // 로그아웃 직후 reset() 으로 idle 에 남은 경우 — 가드는 게스트로 보고 목록을 연다
    [{ status: 'idle', user: null }, true],
    // 세션 복원 중 user 가 잠깐 비어도 게스트가 아니다
    [{ status: 'authenticated', user: null }, false],
    [{ status: 'loading', user: null }, false],
    [{ status: 'authenticated', user: { uid: 'u1' } }, false],
    [{ status: 'idle', user: { uid: 'u1' } }, false],
  ])('%j → %s', (state, expected) => {
    expect(isGuestAuthState(state)).toBe(expected);
  });
});

describe('isGuestBrowsableRoute — 게스트는 공고 목록 탭만', () => {
  it.each([
    [['(app)', '(tabs)', 'home-jobs'], true],
    [['(app)', '(tabs)'], true],
    [['(app)', '(tabs)', 'schedule'], false],
    [['(app)', '(tabs)', 'profile'], false],
    [['(app)', 'jobs', '123'], false],
    [['(app)', 'jobs', '123', 'apply'], false],
    [['(app)', '(tabs)', 'home-jobs', 'extra'], false],
    [['(employer)', 'my-postings'], false],
    [['(admin)'], false],
  ])('%j → %s', (segments, expected) => {
    expect(isGuestBrowsableRoute(segments)).toBe(expected);
  });
});
