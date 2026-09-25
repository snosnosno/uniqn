/**
 * mapChatRpcError — 채팅 RPC 에러 → AppError
 *
 * 서버는 'TOKEN: 한글' (P0001) 형식으로 던진다. postgrest-js 는 fetch 예외의 code 를
 * 빈 문자열로 버리므로 **메시지 접두사**로만 판별한다.
 */
import {
  BusinessError,
  ERROR_CODES,
  PermissionError,
  ValidationError,
  isAppError,
} from '@/errors/AppError';
import {
  CHAT_ERROR_CODES,
  isChatStorageDuplicate,
  mapChatRpcError,
  mapChatStorageError,
} from '@/errors/chat';

function pgError(message: string, code = 'P0001') {
  return { message, code, details: null, hint: null };
}

describe('mapChatRpcError — 채팅 고유 토큰', () => {
  it.each([
    [
      'CHAT_POSTING_UNAVAILABLE: 채팅할 수 없는 공고입니다',
      CHAT_ERROR_CODES.CHAT_POSTING_UNAVAILABLE,
      false,
    ],
    [
      'CHAT_OPEN_LIMITED: 오늘은 더 이상 새 채팅을 시작할 수 없습니다',
      CHAT_ERROR_CODES.CHAT_OPEN_LIMITED,
      false,
    ],
    [
      'CHAT_RATE_LIMITED: 메시지를 너무 빨리 보내고 있습니다',
      CHAT_ERROR_CODES.CHAT_RATE_LIMITED,
      true,
    ],
    ['CHAT_IMAGE_INVALID: 사진을 보낼 수 없습니다', CHAT_ERROR_CODES.CHAT_IMAGE_INVALID, false],
    [
      'CHAT_COUNTERPART_GONE: 대화 상대가 탈퇴했습니다',
      CHAT_ERROR_CODES.CHAT_COUNTERPART_GONE,
      false,
    ],
    ['CHAT_BLOCKED: 대화할 수 없습니다', CHAT_ERROR_CODES.CHAT_BLOCKED, false],
  ])('%s', (message, code, retryable) => {
    const mapped = mapChatRpcError(pgError(message));
    expect(mapped).toBeInstanceOf(BusinessError);
    expect(mapped?.code).toBe(code);
    expect(mapped?.isRetryable).toBe(retryable);
    expect(mapped?.userMessage).not.toMatch(/[A-Z_]{5,}/); // 토큰이 사용자에게 새지 않는다
  });

  it('code 가 빈 문자열이어도 메시지로 판별한다(postgrest-js fetch 예외)', () => {
    const mapped = mapChatRpcError(
      pgError('CHAT_RATE_LIMITED: 메시지를 너무 빨리 보내고 있습니다', '')
    );
    expect(mapped?.code).toBe(CHAT_ERROR_CODES.CHAT_RATE_LIMITED);
  });

  it('"P0001: " 접두사가 붙어 와도 판별한다', () => {
    const mapped = mapChatRpcError(pgError('P0001: CHAT_OPEN_LIMITED: 오늘은 더 이상'));
    expect(mapped?.code).toBe(CHAT_ERROR_CODES.CHAT_OPEN_LIMITED);
  });
});

describe('mapChatRpcError — 서버 다크(42501)', () => {
  it('permission denied for function chat_* → 기능 준비 중 문구', () => {
    const mapped = mapChatRpcError(
      pgError('permission denied for function chat_send_message', '42501')
    );
    expect(mapped?.code).toBe(CHAT_ERROR_CODES.CHAT_UNAVAILABLE);
    expect(mapped?.userMessage).toMatch(/아직 사용할 수 없/);
  });

  it('code 없이 메시지만 와도 판별한다', () => {
    const mapped = mapChatRpcError(
      pgError('permission denied for function chat_open_conversation', '')
    );
    expect(mapped?.code).toBe(CHAT_ERROR_CODES.CHAT_UNAVAILABLE);
  });

  it('채팅 외 함수의 42501 은 건드리지 않는다', () => {
    expect(mapChatRpcError(pgError('permission denied for function other_fn', '42501'))).toBeNull();
  });
});

describe('mapChatRpcError — 범용 토큰(서버 한글 꼬리를 쓴다)', () => {
  it('PERMISSION_DENIED → PermissionError + 서버 문장', () => {
    const mapped = mapChatRpcError(pgError('PERMISSION_DENIED: 내 공고에는 문의할 수 없습니다'));
    expect(mapped).toBeInstanceOf(PermissionError);
    expect(mapped?.code).toBe(ERROR_CODES.INFRA_PERMISSION_DENIED);
    expect(mapped?.userMessage).toBe('내 공고에는 문의할 수 없습니다');
  });

  it('INVALID_INPUT → ValidationError + 서버 문장', () => {
    const mapped = mapChatRpcError(pgError('INVALID_INPUT: 메시지는 1~1000자여야 합니다'));
    expect(mapped).toBeInstanceOf(ValidationError);
    expect(mapped?.code).toBe(ERROR_CODES.VALIDATION_SCHEMA);
    expect(mapped?.userMessage).toBe('메시지는 1~1000자여야 합니다');
  });

  it('꼬리가 비면 기본 문구', () => {
    expect(mapChatRpcError(pgError('PERMISSION_DENIED'))?.userMessage).toBe(
      '이 채팅에 참여할 수 없어요.'
    );
  });
});

describe('mapChatRpcError — 매핑 없음', () => {
  it.each([[null], [undefined], ['문자열'], [{}], [pgError('SOME_OTHER_ERROR: x')]])(
    '%p → null',
    (input) => {
      expect(mapChatRpcError(input)).toBeNull();
    }
  );

  it('매핑 결과는 AppError 이고 원본을 잃지 않는다', () => {
    const original = pgError('CHAT_RATE_LIMITED: x');
    const mapped = mapChatRpcError(original);
    expect(isAppError(mapped)).toBe(true);
    expect(mapped?.message).toContain('CHAT_RATE_LIMITED');
  });
});

describe('storage 에러 (S2b)', () => {
  it('중복(409·already exists)은 재전송으로 보고 성공 취급한다', () => {
    expect(
      isChatStorageDuplicate({ message: 'The resource already exists', statusCode: '409' })
    ).toBe(true);
    expect(isChatStorageDuplicate({ message: 'Duplicate', status: 400 })).toBe(true);
    expect(isChatStorageDuplicate({ message: 'new row violates row-level security policy' })).toBe(
      false
    );
  });

  it('정책 거부 → E6157(재시도 가능) · 용량/형식 → E6153 · 그 외 null', () => {
    expect(
      mapChatStorageError({
        message: 'new row violates row-level security policy',
        statusCode: '403',
      })
    ).toMatchObject({ code: CHAT_ERROR_CODES.CHAT_IMAGE_LIMIT, isRetryable: true });
    expect(mapChatStorageError({ message: 'too big', statusCode: '413' })).toMatchObject({
      code: CHAT_ERROR_CODES.CHAT_IMAGE_INVALID,
    });
    expect(mapChatStorageError({ message: 'Object not found', statusCode: '404' })).toBeNull();
    expect(mapChatStorageError(null)).toBeNull();
  });
});
