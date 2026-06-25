/**
 * ops SECDEF RPC 의 P0001 RAISE 접두사 → AppError 매핑 (EmployerApplicationRepository.mapRpcError 패턴).
 * 알려지지 않은 에러는 handleSupabaseError 로 폴백(전송/일반 분류).
 */
import { BusinessError, ERROR_CODES } from '@/errors';
import { handleSupabaseError } from '@/utils/supabase';

interface RpcErrorLike {
  message?: string;
  code?: string;
}

const PREFIX_MAP: readonly (readonly [string, string, string])[] = [
  ['REGISTRATION_CLOSED', ERROR_CODES.OPS_REGISTRATION_CLOSED, ERROR_CODES.OPS_REGISTRATION_CLOSED],
  [
    'INVALID_STATUS',
    ERROR_CODES.OPS_INVALID_TOURNAMENT_TRANSITION,
    ERROR_CODES.OPS_INVALID_TOURNAMENT_TRANSITION,
  ],
  // 좌석/테이블 — 더 구체적인 접두사 우선 (부분일치 방지)
  [
    'SEAT_VERSION_CONFLICT',
    ERROR_CODES.OPS_SEAT_VERSION_CONFLICT,
    ERROR_CODES.OPS_SEAT_VERSION_CONFLICT,
  ],
  ['SEAT_TAKEN', ERROR_CODES.OPS_SEAT_TAKEN, ERROR_CODES.OPS_SEAT_TAKEN],
  ['SEAT_NOT_OCCUPIED', ERROR_CODES.OPS_SEAT_NOT_OCCUPIED, ERROR_CODES.OPS_SEAT_NOT_OCCUPIED],
  ['SEAT_NOT_FOUND', ERROR_CODES.OPS_SEAT_NOT_OCCUPIED, ERROR_CODES.OPS_SEAT_NOT_OCCUPIED],
  ['TABLE_HAS_OCCUPANTS', ERROR_CODES.OPS_TABLE_HAS_OCCUPANTS, ERROR_CODES.OPS_TABLE_HAS_OCCUPANTS],
  ['TABLE_NOT_FOUND', ERROR_CODES.OPS_TABLE_NOT_FOUND, ERROR_CODES.OPS_TABLE_NOT_FOUND],
  ['TABLE_NOT_OPEN', ERROR_CODES.OPS_SEAT_TAKEN, ERROR_CODES.OPS_SEAT_TAKEN],
  // 참가자 — PARTICIPANT_ALREADY_SEATED 를 NOT_* 앞에
  [
    'PARTICIPANT_ALREADY_SEATED',
    ERROR_CODES.OPS_PARTICIPANT_ALREADY_SEATED,
    ERROR_CODES.OPS_PARTICIPANT_ALREADY_SEATED,
  ],
  [
    'PARTICIPANT_NOT_ACTIVE',
    ERROR_CODES.OPS_PARTICIPANT_NOT_ACTIVE,
    ERROR_CODES.OPS_PARTICIPANT_NOT_ACTIVE,
  ],
  [
    'PARTICIPANT_NOT_FOUND',
    ERROR_CODES.OPS_PARTICIPANT_NOT_FOUND,
    ERROR_CODES.OPS_PARTICIPANT_NOT_FOUND,
  ],
  [
    'TOURNAMENT_NOT_FOUND',
    ERROR_CODES.OPS_TOURNAMENT_NOT_FOUND,
    ERROR_CODES.OPS_TOURNAMENT_NOT_FOUND,
  ],
  ['INVALID_MOVE', ERROR_CODES.BUSINESS_INVALID_STATE, ERROR_CODES.BUSINESS_INVALID_STATE],
];

export function mapOpsRpcError(error: unknown, ctx: { operation: string }): never {
  const message = (error as RpcErrorLike)?.message ?? '';

  for (const [prefix, code] of PREFIX_MAP) {
    if (message.includes(prefix)) {
      // userMessage 는 ERROR_MESSAGES[code] (한글) 가 자동 적용됨.
      throw new BusinessError(code);
    }
  }

  if (message.includes('PERMISSION_DENIED')) {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '이 작업을 수행할 권한이 없습니다',
    });
  }

  // 알 수 없는 에러(전송/제약 등) → 표준 핸들러로 분류.
  handleSupabaseError(error, { operation: ctx.operation, table: 'ops' });
}
