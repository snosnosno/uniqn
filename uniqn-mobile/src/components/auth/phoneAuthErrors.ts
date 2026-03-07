/**
 * UNIQN Mobile - Firebase Phone Auth 에러 메시지 매핑
 *
 * @description PhoneVerification 컴포넌트에서 사용하는 Firebase 에러 코드 → 한글 메시지 변환
 * @version 1.0.0
 */

/** SMS 발송 요청(requestOTP) 시 Firebase 에러 → 사용자 메시지 */
export function getFirebasePhoneAuthErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case 'auth/invalid-phone-number':
      return '올바른 전화번호 형식이 아닙니다.';
    case 'auth/too-many-requests':
      return '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.';
    case 'auth/quota-exceeded':
      return '일일 SMS 발송 한도를 초과했습니다.';
    case 'auth/missing-phone-number':
      return '전화번호를 입력해주세요.';
    case 'auth/network-request-failed':
      return '네트워크 연결을 확인해주세요.';
    default:
      // TODO: 디버깅 완료 후 에러 코드 노출 제거
      return code
        ? `인증번호 발송에 실패했습니다. [${code}]`
        : '인증번호 발송에 실패했습니다. 다시 시도해주세요.';
  }
}

/** OTP 확인(confirmOTP) 시 Firebase 에러 → 사용자 메시지 */
export function getFirebaseOTPErrorMessage(
  error: unknown,
  mode: 'signIn' | 'link' = 'signIn'
): string {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case 'auth/invalid-verification-code':
      return '인증번호가 올바르지 않습니다.';
    case 'auth/session-expired':
      return '인증 시간이 만료되었습니다. 다시 요청해주세요.';
    case 'auth/code-expired':
      return '인증번호가 만료되었습니다. 다시 요청해주세요.';
    case 'auth/credential-already-in-use':
      return mode === 'link'
        ? '이미 다른 계정에 등록된 전화번호입니다.'
        : '이미 가입된 전화번호입니다. 로그인을 시도해주세요.';
    case 'auth/provider-already-linked':
      return '이미 전화번호가 연결되어 있습니다.';
    case 'auth/requires-recent-login':
      return '보안을 위해 다시 로그인이 필요합니다.';
    default:
      // TODO: 디버깅 완료 후 에러 코드 노출 제거
      return code
        ? `인증에 실패했습니다. [${code}]`
        : '인증에 실패했습니다. 다시 시도해주세요.';
  }
}
