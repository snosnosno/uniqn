/**
 * IdP (Identity Provider) error codes — stable contract for PortOne / Apple flows.
 *
 * `code` 필드는 클라 분기용 안정 contract. 한글 message는 사용자 표시용으로
 * 호환성 유지를 위해 기존 텍스트와 일치시킴.
 */
export const IDP_ERROR_CODES = {
  IV_TIMESTAMP_EXPIRED: {
    status: 400,
    message: '본인인증 세션이 만료되었습니다. 다시 진행해주세요.',
  },
  IV_INVALID: { status: 400, message: '본인인증 정보가 올바르지 않습니다.' },
  IV_BINDING_MISMATCH: {
    status: 400,
    message: '본인인증 세션이 일치하지 않습니다. 다시 진행해주세요.',
  },
  IV_ALREADY_PROCESSED: {
    status: 409,
    message: '이미 사용된 본인인증입니다. 다시 인증을 진행해주세요.',
  },
  IV_DUPLICATE_PHONE: { status: 409, message: '이미 등록된 전화번호입니다' },
  IV_DUPLICATE_CI: { status: 409, message: '이미 인증된 신원입니다' },
  IV_DUPLICATE_NICKNAME: { status: 409, message: '이미 사용 중인 닉네임입니다' },
  AUTH_REQUIRED: { status: 401, message: '인증이 필요합니다' },
  AUTH_FAILED: { status: 401, message: '인증 실패' },
  PORTONE_FETCH_FAILED: { status: 400, message: '본인인증 정보 조회 실패' },
  PORTONE_NOT_VERIFIED: { status: 400, message: '본인인증이 완료되지 않았습니다' },
  PORTONE_INCOMPLETE: { status: 400, message: '본인인증 데이터가 불완전합니다' },
  PORTONE_AGE_RESTRICTED: { status: 400, message: '14세 이상만 가입할 수 있습니다' },
  PROFILE_ALREADY_COMPLETED: { status: 409, message: '이미 프로필이 완료된 계정입니다' },
  AUTH_METADATA_UPDATE_FAILED: {
    status: 500,
    message: '인증 정보 동기화에 실패했습니다. 잠시 후 다시 시도해주세요.',
  },
  IDEMPOTENCY_ROLLBACK_FAILED: {
    status: 500,
    message: '본인인증 처리 중 일시적 오류가 발생했습니다. 고객센터에 문의해주세요.',
  },
} as const;

export type IdpErrorCode = keyof typeof IDP_ERROR_CODES;
