/**
 * UNIQN Mobile — 앱 내 채팅 RPC 에러 매핑
 *
 * 서버(S1 `20260925100000_chat_schema_and_rpcs.sql`)는 `RAISE EXCEPTION 'TOKEN: 한글'`(P0001)로 던진다.
 * postgrest-js 는 fetch 계층 예외의 `code` 를 빈 문자열로 버리므로 **메시지 접두사**로만 판별한다.
 *
 * 전역 `handleSupabaseError` 에 넣지 않는 이유: `PERMISSION_DENIED`·`INVALID_INPUT` 은 다른 RPC 도
 * 쓰는 범용 토큰이라 전역에 매핑하면 그쪽 문구까지 바뀐다. `ChatRepository` 가 이 매퍼를 먼저 부르고,
 * null 이면 `handleSupabaseError` 로 넘긴다(선례 `src/repositories/supabase/opsRpcError.ts`).
 */
import {
  AppError,
  AuthError,
  BusinessError,
  ERROR_CODES,
  NetworkError,
  PermissionError,
  ValidationError,
} from './AppError';

/** 채팅 도메인 에러 코드 (E6150~) */
export const CHAT_ERROR_CODES = {
  CHAT_POSTING_UNAVAILABLE: 'E6150',
  CHAT_OPEN_LIMITED: 'E6151',
  CHAT_RATE_LIMITED: 'E6152',
  CHAT_IMAGE_INVALID: 'E6153',
  CHAT_COUNTERPART_GONE: 'E6154',
  /** (S4) 차단된 대화에 보내기 */
  CHAT_BLOCKED: 'E6155',
  /** 서버 다크(authenticated EXECUTE 미부여) 상태에서 호출됨 — 42501 */
  CHAT_UNAVAILABLE: 'E6156',
  /** (S2b) 사진 업로드가 storage 정책에 막힘 — 10분 20장·하루 60장 초과 또는 비참여자 */
  CHAT_IMAGE_LIMIT: 'E6157',
  /** (S4) 같은 메시지를 다시 신고 */
  CHAT_REPORT_DUPLICATE: 'E6158',
  /** (S4) 하루 신고 한도(20건) 초과 */
  CHAT_REPORT_LIMITED: 'E6159',
  /** (S4 M1) 정화 EF 가 inbox 객체를 못 찾음 — 다시 올리면 된다(재전송 가능) */
  CHAT_IMAGE_MISSING: 'E6160',
} as const;

type ChatTokenRule = {
  token: string;
  code: string;
  userMessage: string;
  isRetryable: boolean;
};

/** 채팅 고유 토큰 → 에러(서버 원문의 한글은 운영자용 표현이라 사용자 문구는 여기서 정한다) */
const CHAT_TOKEN_RULES: readonly ChatTokenRule[] = [
  {
    token: 'CHAT_POSTING_UNAVAILABLE',
    code: CHAT_ERROR_CODES.CHAT_POSTING_UNAVAILABLE,
    userMessage: '채팅할 수 없는 공고예요.',
    isRetryable: false,
  },
  {
    token: 'CHAT_OPEN_LIMITED',
    code: CHAT_ERROR_CODES.CHAT_OPEN_LIMITED,
    userMessage: '오늘은 새 채팅을 더 시작할 수 없어요. 내일 다시 시도해 주세요.',
    isRetryable: false,
  },
  {
    token: 'CHAT_RATE_LIMITED',
    code: CHAT_ERROR_CODES.CHAT_RATE_LIMITED,
    userMessage: '메시지를 너무 빨리 보내고 있어요. 잠시 후 다시 보내 주세요.',
    isRetryable: true,
  },
  {
    token: 'CHAT_IMAGE_INVALID',
    code: CHAT_ERROR_CODES.CHAT_IMAGE_INVALID,
    userMessage: '사진을 보낼 수 없어요. 다시 선택해 주세요.',
    isRetryable: false,
  },
  {
    token: 'CHAT_COUNTERPART_GONE',
    code: CHAT_ERROR_CODES.CHAT_COUNTERPART_GONE,
    userMessage: '대화 상대가 탈퇴해 메시지를 보낼 수 없어요.',
    isRetryable: false,
  },
  {
    token: 'CHAT_BLOCKED',
    code: CHAT_ERROR_CODES.CHAT_BLOCKED,
    userMessage: '대화할 수 없는 상태예요.',
    isRetryable: false,
  },
  {
    token: 'DUPLICATE_REPORT',
    code: CHAT_ERROR_CODES.CHAT_REPORT_DUPLICATE,
    userMessage: '이미 신고한 메시지예요.',
    isRetryable: false,
  },
  {
    token: 'CHAT_REPORT_LIMITED',
    code: CHAT_ERROR_CODES.CHAT_REPORT_LIMITED,
    userMessage: '오늘은 더 이상 신고할 수 없어요.',
    isRetryable: false,
  },
];

/** 'P0001: ' 같은 코드 접두사를 허용하고 토큰으로 시작하는지 본다 */
function startsWithToken(message: string, token: string): boolean {
  return new RegExp(`^(?:[A-Z0-9]{5}:\\s*)?${token}\\b`).test(message.trim());
}

/** 'TOKEN: 한글 꼬리' 에서 꼬리만 */
function serverTail(message: string, token: string): string {
  const index = message.indexOf(token);
  const rest = message.slice(index + token.length).replace(/^\s*:\s*/, '');
  return rest.trim();
}

const CHAT_FUNCTION_DENIED = /permission denied for function chat_/i;

// ----------------------------------------------------------------------------
// (S2b) 사진 storage 에러 — storage-js 의 StorageApiError { message, status, statusCode }
// ----------------------------------------------------------------------------

function storageFields(error: unknown): { message: string; statusCode: string } {
  if (!error || typeof error !== 'object') return { message: '', statusCode: '' };
  const e = error as { message?: unknown; statusCode?: unknown; status?: unknown };
  const statusCode =
    typeof e.statusCode === 'string' || typeof e.statusCode === 'number'
      ? String(e.statusCode)
      : typeof e.status === 'number'
        ? String(e.status)
        : '';
  return { message: typeof e.message === 'string' ? e.message : '', statusCode };
}

/**
 * 같은 경로 객체가 이미 있다 — 재전송이 업로드를 다시 시도한 경우라 **성공**으로 본다.
 * 경로에 내 uid·clientMessageId 가 들어가고 정책이 2세그먼트=본인을 강제하므로 남의 객체일 수 없다.
 */
export function isChatStorageDuplicate(error: unknown): boolean {
  const { message, statusCode } = storageFields(error);
  return statusCode === '409' || /already exists|duplicate/i.test(message);
}

/**
 * 사진 업로드·서명 URL 에러 → AppError. 못 잡으면 null(호출자가 handleSupabaseError 로 폴백).
 * storage 정책 거부는 원인(10분 20장·하루 60장·비참여자)을 구분할 수 없어 복합 문구를 쓴다.
 */
export function mapChatStorageError(error: unknown): AppError | null {
  const { message, statusCode } = storageFields(error);
  if (!message && !statusCode) return null;

  if (/row-level security/i.test(message) || statusCode === '403') {
    return new BusinessError(CHAT_ERROR_CODES.CHAT_IMAGE_LIMIT, {
      message,
      userMessage: '지금은 사진을 더 보낼 수 없어요. 잠시 후 다시 시도해 주세요.',
      isRetryable: true,
    });
  }
  if (statusCode === '413' || /maximum allowed size|mime type/i.test(message)) {
    return new BusinessError(CHAT_ERROR_CODES.CHAT_IMAGE_INVALID, {
      message,
      userMessage: '사진을 보낼 수 없어요. 다시 선택해 주세요.',
    });
  }
  return null;
}

// ----------------------------------------------------------------------------
// (S4 M1) 사진 정화 EF `chat-media-sanitize` 실패 응답 — { error, code }
// ----------------------------------------------------------------------------

/** EF 실패 본문(파싱 못 하면 null) */
export interface ChatSanitizeErrorBody {
  code?: string;
  error?: string;
}

const IMAGE_REJECTED_MESSAGE = '사진을 보낼 수 없어요. 다시 선택해 주세요.';

/**
 * 정화 EF 실패 → AppError. 모르는 코드·본문 없음(5xx·네트워크)은 재시도 가능한 요청 실패로 본다 —
 * EF 는 멱등이라 다시 불러도 안전하다.
 */
export function mapChatSanitizeError(
  body: ChatSanitizeErrorBody | null,
  status: number | undefined
): AppError {
  const message = `chat-media-sanitize 실패 (${status ?? '?'}): ${body?.code ?? '-'}`;
  switch (body?.code) {
    case 'CHAT_IMAGE_INVALID':
    case 'CHAT_IMAGE_TOO_LARGE':
      return new BusinessError(CHAT_ERROR_CODES.CHAT_IMAGE_INVALID, {
        message,
        userMessage: IMAGE_REJECTED_MESSAGE,
      });
    case 'CHAT_IMAGE_NOT_FOUND':
      return new BusinessError(CHAT_ERROR_CODES.CHAT_IMAGE_MISSING, {
        message,
        userMessage: '사진을 보내지 못했어요. 다시 시도해 주세요.',
        isRetryable: true,
      });
    case 'CHAT_IMAGE_UNAUTHENTICATED':
      return new AuthError(ERROR_CODES.AUTH_SESSION_EXPIRED, { message });
    default:
      return new NetworkError(ERROR_CODES.NETWORK_REQUEST_FAILED, {
        message,
        userMessage: '사진을 보내지 못했어요. 다시 시도해 주세요.',
        isRetryable: true,
      });
  }
}

export function mapChatRpcError(error: unknown): AppError | null {
  if (!error || typeof error !== 'object') return null;
  const message = (error as { message?: unknown }).message;
  if (typeof message !== 'string') return null;

  const rule = CHAT_TOKEN_RULES.find((r) => startsWithToken(message, r.token));
  if (rule) {
    return new BusinessError(rule.code, {
      message,
      userMessage: rule.userMessage,
      isRetryable: rule.isRetryable,
    });
  }

  if (CHAT_FUNCTION_DENIED.test(message)) {
    return new BusinessError(CHAT_ERROR_CODES.CHAT_UNAVAILABLE, {
      message,
      userMessage: '채팅 기능을 아직 사용할 수 없어요.',
    });
  }

  if (startsWithToken(message, 'PERMISSION_DENIED')) {
    return new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
      message,
      userMessage: serverTail(message, 'PERMISSION_DENIED') || '이 채팅에 참여할 수 없어요.',
    });
  }

  if (startsWithToken(message, 'INVALID_INPUT')) {
    return new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
      message,
      userMessage: serverTail(message, 'INVALID_INPUT') || '입력값을 확인해 주세요.',
    });
  }

  return null;
}
