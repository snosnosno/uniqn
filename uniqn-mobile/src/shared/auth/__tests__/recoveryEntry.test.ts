/**
 * 비밀번호 복구 진입 감지 테스트
 *
 * 배경(2026-07-22): 구 번들이 보낸 메일은 redirectTo 가 없어 Site URL 루트(`/`)로
 * 착지한다. 이미 로그인된 사용자는 그대로 앱 홈으로 흘러가 **비밀번호를 바꿀
 * 화면을 영영 못 본다**. 루트에서 복구 진입을 감지해 재설정 화면으로 넘겨야 한다.
 */

import { detectRecoveryEntry, detectRecoveryLinkError, parseRecoveryUrl } from '../recoveryEntry';

describe('detectRecoveryEntry', () => {
  it('성공 해시(type=recovery)를 복구 진입으로 본다', () => {
    expect(
      detectRecoveryEntry('#access_token=abc&refresh_token=def&token_type=bearer&type=recovery', '')
    ).toBe(true);
  });

  it('만료 해시(error_code=otp_expired)도 복구 진입으로 본다', () => {
    expect(
      detectRecoveryEntry(
        '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid',
        ''
      )
    ).toBe(true);
  });

  it('PKCE 쿼리(type=recovery)도 복구 진입으로 본다', () => {
    expect(detectRecoveryEntry('', '?code=abc&type=recovery')).toBe(true);
  });

  it('일반 로그인 해시는 복구 진입이 아니다', () => {
    expect(detectRecoveryEntry('#access_token=abc&type=signup', '')).toBe(false);
  });

  it('해시·쿼리가 비어 있으면 복구 진입이 아니다', () => {
    expect(detectRecoveryEntry('', '')).toBe(false);
  });

  it('다른 오류 해시는 복구 진입이 아니다', () => {
    expect(detectRecoveryEntry('#error=server_error', '')).toBe(false);
  });
});

// Android intentFilter 가 uniqn.app 전 경로를 가로채므로(pathPrefix '/'),
// 복구 링크는 네이티브 앱에서 열린다. detectSessionInUrl 은 웹 전용이라
// 네이티브는 URL 에서 직접 토큰을 꺼내 세션을 채택해야 한다(2026-07-22).
describe('parseRecoveryUrl', () => {
  it('신식 링크(/reset-password 착지)에서 토큰을 꺼낸다', () => {
    expect(
      parseRecoveryUrl(
        'https://uniqn.app/reset-password#access_token=at1&expires_in=3600&refresh_token=rt1&token_type=bearer&type=recovery'
      )
    ).toEqual({ kind: 'tokens', accessToken: 'at1', refreshToken: 'rt1' });
  });

  it('구식 링크(루트 착지)에서도 토큰을 꺼낸다', () => {
    expect(
      parseRecoveryUrl('https://uniqn.app/#access_token=at2&refresh_token=rt2&type=recovery')
    ).toEqual({ kind: 'tokens', accessToken: 'at2', refreshToken: 'rt2' });
  });

  it('만료 링크는 error 로 판정한다', () => {
    expect(
      parseRecoveryUrl('https://uniqn.app/#error=access_denied&error_code=otp_expired')
    ).toEqual({ kind: 'error' });
  });

  it('type=recovery 인데 토큰이 없으면 error 로 판정한다', () => {
    expect(parseRecoveryUrl('https://uniqn.app/#type=recovery')).toEqual({ kind: 'error' });
  });

  it('복구와 무관한 URL 은 none', () => {
    expect(parseRecoveryUrl('https://uniqn.app/jobs/123')).toEqual({ kind: 'none' });
    expect(parseRecoveryUrl('https://uniqn.app/#access_token=x&type=signup')).toEqual({
      kind: 'none',
    });
  });
});

describe('detectRecoveryLinkError', () => {
  it('만료 해시는 실패 착지로 본다', () => {
    expect(detectRecoveryLinkError('#error=access_denied&error_code=otp_expired', '')).toBe(true);
  });

  it('정상 토큰 해시는 실패가 아니다', () => {
    expect(detectRecoveryLinkError('#access_token=abc&type=recovery', '')).toBe(false);
  });

  it('빈 URL 은 실패가 아니다', () => {
    expect(detectRecoveryLinkError('', '')).toBe(false);
  });
});
