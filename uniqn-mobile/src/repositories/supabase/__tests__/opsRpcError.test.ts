/**
 * ops SECDEF RPC 의 P0001 RAISE 접두사 → AppError 매핑 정확성 테스트.
 *
 * 검증 대상(Task S1):
 * - #1 TABLE_NOT_OPEN 전용코드(OPS_TABLE_NOT_OPEN) — 기존 OPS_SEAT_TAKEN 오매핑 회귀가드
 * - #2 INVALID_SEAT_COUNT / INVALID_ASSIGNMENTS 명시 매핑(폴백 아님)
 * - 기존 좌석/테이블 매핑 회귀 무손상
 * - 알 수 없는 에러는 handleSupabaseError 폴백
 */
import { mapOpsRpcError } from '../opsRpcError';
import { BusinessError, ERROR_CODES, isBusinessError } from '@/errors';
import { handleSupabaseError } from '@/utils/supabase';

// handleSupabaseError 폴백 경로는 식별 가능한 sentinel 을 던지도록 mock.
// (jest.mock 은 호이스팅되어 상수 참조 불가하므로 리터럴을 인라인)
jest.mock('@/utils/supabase', () => ({
  handleSupabaseError: jest.fn(() => {
    throw new Error('__HANDLE_SUPABASE_ERROR_FALLTHROUGH__');
  }),
}));

const FALLTHROUGH_SENTINEL = '__HANDLE_SUPABASE_ERROR_FALLTHROUGH__';
const mockHandleSupabaseError = handleSupabaseError as unknown as jest.Mock;

/** mapOpsRpcError 는 never(항상 throw) → 던져진 에러를 캡처해 단언한다. */
function captureThrown(input: unknown): unknown {
  try {
    mapOpsRpcError(input, { operation: 'test-op' });
  } catch (e) {
    return e;
  }
  throw new Error('mapOpsRpcError 가 throw 하지 않았습니다 (never 계약 위반)');
}

describe('mapOpsRpcError (Task S1)', () => {
  // #1 — TABLE_NOT_OPEN 전용코드 회귀가드 (기존엔 OPS_SEAT_TAKEN 으로 오매핑)
  it('TABLE_NOT_OPEN → OPS_TABLE_NOT_OPEN 전용코드 (OPS_SEAT_TAKEN 아님)', () => {
    const err = captureThrown({ message: 'TABLE_NOT_OPEN: 테이블이 열려 있지 않습니다' });
    expect(isBusinessError(err)).toBe(true);
    expect((err as BusinessError).code).toBe(ERROR_CODES.OPS_TABLE_NOT_OPEN);
    expect((err as BusinessError).code).not.toBe(ERROR_CODES.OPS_SEAT_TAKEN);
  });

  // #2 — INVALID_SEAT_COUNT 명시 매핑
  it('INVALID_SEAT_COUNT → OPS_INVALID_SEAT_COUNT', () => {
    const err = captureThrown({ message: 'INVALID_SEAT_COUNT: 좌석수는 1~11 (got 12)' });
    expect(isBusinessError(err)).toBe(true);
    expect((err as BusinessError).code).toBe(ERROR_CODES.OPS_INVALID_SEAT_COUNT);
  });

  // #2 — INVALID_ASSIGNMENTS 명시 매핑
  it('INVALID_ASSIGNMENTS → OPS_INVALID_ASSIGNMENTS', () => {
    const err = captureThrown({ message: 'INVALID_ASSIGNMENTS: 배정 목록이 비었습니다' });
    expect(isBusinessError(err)).toBe(true);
    expect((err as BusinessError).code).toBe(ERROR_CODES.OPS_INVALID_ASSIGNMENTS);
  });

  // 회귀 — TABLE_NOT_OPEN 변경이 SEAT_TAKEN 을 깨뜨리지 않음
  it('SEAT_TAKEN → OPS_SEAT_TAKEN (회귀)', () => {
    const err = captureThrown({ message: 'SEAT_TAKEN: 이미 사용 중인 좌석' });
    expect((err as BusinessError).code).toBe(ERROR_CODES.OPS_SEAT_TAKEN);
  });

  // 회귀 — TABLE_NOT_OPEN vs TABLE_NOT_FOUND 상호 부분문자열 아님 확인
  it('TABLE_NOT_FOUND → OPS_TABLE_NOT_FOUND (회귀)', () => {
    const err = captureThrown({ message: 'TABLE_NOT_FOUND: 테이블 없음' });
    expect((err as BusinessError).code).toBe(ERROR_CODES.OPS_TABLE_NOT_FOUND);
  });

  // 회귀 — 더 구체적인 SEAT_VERSION_CONFLICT 가 SEAT_TAKEN 보다 우선
  it('SEAT_VERSION_CONFLICT → OPS_SEAT_VERSION_CONFLICT (회귀)', () => {
    const err = captureThrown({ message: 'SEAT_VERSION_CONFLICT: 좌석 상태 변경' });
    expect((err as BusinessError).code).toBe(ERROR_CODES.OPS_SEAT_VERSION_CONFLICT);
  });

  // 1c — 블라인드 레벨 설정 오류 매핑
  it('OPS_BLIND_LEVELS_INVALID → OPS_BLIND_LEVELS_INVALID', () => {
    const err = captureThrown({ message: 'OPS_BLIND_LEVELS_INVALID: 블라인드 레벨이 비었습니다' });
    expect(isBusinessError(err)).toBe(true);
    expect((err as BusinessError).code).toBe(ERROR_CODES.OPS_BLIND_LEVELS_INVALID);
  });

  // 1c — 블라인드 미설정 상태 클럭 시작 (BLIND_LEVELS_INVALID 와 상호 부분문자열 아님)
  it('OPS_NO_BLIND_LEVELS → OPS_NO_BLIND_LEVELS (INVALID 아님)', () => {
    const err = captureThrown({ message: 'OPS_NO_BLIND_LEVELS: 블라인드 레벨이 없습니다' });
    expect(isBusinessError(err)).toBe(true);
    expect((err as BusinessError).code).toBe(ERROR_CODES.OPS_NO_BLIND_LEVELS);
    expect((err as BusinessError).code).not.toBe(ERROR_CODES.OPS_BLIND_LEVELS_INVALID);
  });

  // 1c — 존재하지 않는 레벨 (기존 INVALID_* 접두사로 오매핑되지 않음)
  it('OPS_INVALID_LEVEL → OPS_INVALID_LEVEL', () => {
    const err = captureThrown({ message: 'OPS_INVALID_LEVEL: 존재하지 않는 레벨 (sort=9)' });
    expect(isBusinessError(err)).toBe(true);
    expect((err as BusinessError).code).toBe(ERROR_CODES.OPS_INVALID_LEVEL);
  });

  // 1c-4 — claim 토큰 분리 (E6120→E6121→E6122 세분화)
  it('OPS_VIEW_TOKEN_INVALID → OPS_VIEW_TOKEN_INVALID', () => {
    const err = captureThrown({ message: 'OPS_VIEW_TOKEN_INVALID: 유효하지 않은 토큰' });
    expect(isBusinessError(err)).toBe(true);
    expect((err as BusinessError).code).toBe(ERROR_CODES.OPS_VIEW_TOKEN_INVALID);
  });

  // 1c-4 — PIN 검증 실패 (신규 E6122)
  it('OPS_CLAIM_PIN_INVALID → OPS_CLAIM_PIN_INVALID', () => {
    const err = captureThrown({ message: 'OPS_CLAIM_PIN_INVALID: 연결 PIN 불일치' });
    expect(isBusinessError(err)).toBe(true);
    expect((err as BusinessError).code).toBe(ERROR_CODES.OPS_CLAIM_PIN_INVALID);
  });

  // 1c-4 — 이미 클레임됨 (기존 E6121 유지)
  it('OPS_CLAIM_ALREADY_CLAIMED → OPS_CLAIM_ALREADY_CLAIMED', () => {
    const err = captureThrown({ message: 'OPS_CLAIM_ALREADY_CLAIMED: 이미 다른 계정 연결' });
    expect(isBusinessError(err)).toBe(true);
    expect((err as BusinessError).code).toBe(ERROR_CODES.OPS_CLAIM_ALREADY_CLAIMED);
  });

  // 1d — bust/reentry/ITM (Task 8)
  it.each([
    ['PARTICIPANT_ALREADY_BUSTED: x', ERROR_CODES.OPS_PARTICIPANT_ALREADY_BUSTED],
    ['PARTICIPANT_NOT_BUSTED: x', ERROR_CODES.OPS_PARTICIPANT_NOT_BUSTED],
    ['PARTICIPANT_LAST_SURVIVOR: x', ERROR_CODES.OPS_PARTICIPANT_LAST_SURVIVOR],
    ['REENTRY_NOT_ALLOWED: x', ERROR_CODES.OPS_REENTRY_NOT_ALLOWED],
    ['MAX_REENTRIES_EXCEEDED: x', ERROR_CODES.OPS_MAX_REENTRIES_EXCEEDED],
    ['PRIZE_STRUCTURE_INVALID: x', ERROR_CODES.OPS_PRIZE_STRUCTURE_INVALID],
    // 1f — 넉아웃/탈락취소/상금정정 (Task 8)
    ['ELIMINATOR_INVALID: 넉아웃 상대가 올바르지 않습니다', ERROR_CODES.OPS_ELIMINATOR_INVALID],
    [
      'UNDO_INVALID_STATE: 탈락 상태의 참가자만 취소할 수 있습니다',
      ERROR_CODES.OPS_UNDO_INVALID_STATE,
    ],
    [
      'PRIZE_CORRECTION_INVALID: 금액은 0 이상이어야 합니다',
      ERROR_CODES.OPS_PRIZE_CORRECTION_INVALID,
    ],
  ])('maps %s → %s', (msg, code) => {
    expect(() => mapOpsRpcError({ message: msg }, { operation: 't' })).toThrow(
      expect.objectContaining({ code })
    );
  });

  // 회귀 — PERMISSION_DENIED 는 PREFIX_MAP 밖 별도 분기
  it('PERMISSION_DENIED → BUSINESS_INVALID_STATE + 권한 메시지 (회귀)', () => {
    const err = captureThrown({ message: 'PERMISSION_DENIED' });
    expect((err as BusinessError).code).toBe(ERROR_CODES.BUSINESS_INVALID_STATE);
    expect((err as BusinessError).userMessage).toBe('이 작업을 수행할 권한이 없습니다');
  });

  // 폴백 — 알 수 없는 에러는 handleSupabaseError 로 위임 (BusinessError 아님)
  it('알 수 없는 에러 → handleSupabaseError 폴백 (BusinessError 아님)', () => {
    const input = { message: 'SOME_RANDOM_DB_ERROR', code: '23505' };
    const err = captureThrown(input);
    expect(isBusinessError(err)).toBe(false);
    expect((err as Error).message).toBe(FALLTHROUGH_SENTINEL);
    expect(mockHandleSupabaseError).toHaveBeenCalledWith(input, {
      operation: 'test-op',
      table: 'ops',
    });
  });
});

describe('opsRpcError — 배정 신규 prefix', () => {
  it('SEAT_ASSIGNMENT_INVALID → E6129 + 한글 userMessage', () => {
    const e = captureThrown({
      message: 'SEAT_ASSIGNMENT_INVALID: 좌석 배정 정보가 올바르지 않아요.',
    }) as BusinessError;
    expect(e.code).toBe('E6129');
    expect(e.userMessage).toBe('좌석 배정 정보가 올바르지 않아요.'); // ERROR_MESSAGES 누락 시 UNKNOWN 폴백 → 적발
  });
  it('INVALID_REDRAW_MODE → E6131', () => {
    expect((captureThrown({ message: 'INVALID_REDRAW_MODE: x' }) as BusinessError).code).toBe(
      'E6131'
    );
  });
  it('SEAT_ASSIGNMENT_INVALID는 SEAT_TAKEN(E6106)으로 오매핑 안 됨(상호 부분문자열 아님)', () => {
    expect((captureThrown({ message: 'SEAT_ASSIGNMENT_INVALID: x' }) as BusinessError).code).toBe(
      'E6129'
    );
  });
});

describe('opsRpcError — 1f 신규 prefix (한글 userMessage 존재)', () => {
  // ERROR_MESSAGES 누락 시 UNKNOWN 폴백 메시지로 떨어지므로 userMessage 단언으로 적발.
  it('ELIMINATOR_INVALID → E6132 + 한글 userMessage', () => {
    const e = captureThrown({ message: 'ELIMINATOR_INVALID: x' }) as BusinessError;
    expect(e.code).toBe('E6132');
    expect(e.userMessage).toBe('넉아웃 상대가 올바르지 않아요.');
  });
  it('UNDO_INVALID_STATE → E6133 + 한글 userMessage', () => {
    const e = captureThrown({ message: 'UNDO_INVALID_STATE: x' }) as BusinessError;
    expect(e.code).toBe('E6133');
    expect(e.userMessage).toBe('탈락 취소를 할 수 없는 상태예요.');
  });
  it('PRIZE_CORRECTION_INVALID → E6134 + 한글 userMessage (PRIZE_STRUCTURE_INVALID 아님)', () => {
    const e = captureThrown({ message: 'PRIZE_CORRECTION_INVALID: x' }) as BusinessError;
    expect(e.code).toBe('E6134');
    expect(e.code).not.toBe(ERROR_CODES.OPS_PRIZE_STRUCTURE_INVALID);
    expect(e.userMessage).toBe('상금 정정 대상이나 값이 올바르지 않아요.');
  });
});
