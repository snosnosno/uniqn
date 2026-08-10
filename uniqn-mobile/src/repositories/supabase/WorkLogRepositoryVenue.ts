/**
 * UNIQN Mobile - Supabase WorkLog Repository Venue (운영처 스팬 정산 / 슬롯 편집)
 *
 * @description 근무표의 work_logs 경로.
 * - getByVenueSpanInRange: 운영처 스팬 + 날짜범위 정산 근무 기록 조회(Phase 4).
 * - updateSlot: 슬롯 편집 — 예정 시간/역할/색상/메모 + 실적(출퇴근) 부분 수정.
 *   실적 쓰기의 단일 관문이다(2026-08-06, 직접 UPDATE 2경로 흡수).
 *
 * SupabaseWorkLogRepository 가 본 모듈로 위임한다(800줄 하드캡 분리, 동작 무변경).
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { handleSupabaseError } from '@/utils/supabase';
import { STATUS } from '@/constants';
import {
  AlreadySettledError,
  BusinessError,
  PermissionError,
  ValidationError,
  ERROR_CODES,
  type AppError,
} from '@/errors';
import { assertSlotColor, assertSlotMemo, assertSlotStartTime } from '@/domains/workSchedule';
import { assertWorkTimeReason } from '@/domains/staff';
import { settledLockMessage } from '@/domains/settlement';
import type { WorkLog } from '@/types';
import type { UpdateSlotInput } from '../interfaces';
import {
  TABLE,
  TABLE_COLUMNS,
  MAX_STATS_PAGE_SIZE,
  rowsToWorkLogs,
  rethrowOrHandle,
} from './WorkLogRepositoryHelpers';

/**
 * 운영처(venue) 스팬 + 날짜범위 근무 기록 조회 (근무표 Phase 4 정산).
 *
 * E1: venue 스팬은 venue_span_posting_ids(SSOT) RPC 로 취득 — `venue_id=:V OR id=:V` 손수
 * 재작성 금지(발산 방지). R5: 날짜범위는 SQL 경계(.gte/.lte)에서 적용(전기간 풀 pull 금지).
 * status NOT IN(cancelled,no_show) 도 SQL 레벨 제외(정산 비대상).
 */
export async function getByVenueSpanInRange(
  venueId: string,
  fromDate: string,
  toDate: string
): Promise<WorkLog[]> {
  try {
    logger.info('운영처 스팬 정산 근무 기록 조회', { venueId, fromDate, toDate });

    // E1: venue 스팬 SSOT — 컨테이너 자기행 + venue_id 매칭 공고의 posting id 집합.
    // INVOKER 권한(RLS)이라 호출자가 볼 수 있는 공고만 반환(외부인=빈 스팬, fail-closed).
    const { data: spanData, error: spanError } = await supabase.rpc('venue_span_posting_ids', {
      p_venue: venueId,
    });
    if (spanError) handleSupabaseError(spanError, { operation: '운영처 스팬 조회', table: TABLE });

    // SETOF uuid 응답 — 스칼라 배열/객체(venue_span_posting_ids 키) 양형 방어 파싱(경계 검증).
    const spanIds = ((spanData ?? []) as unknown[])
      .map((row) => {
        if (typeof row === 'string') return row;
        if (row && typeof row === 'object') {
          const value = (row as Record<string, unknown>).venue_span_posting_ids;
          return typeof value === 'string' ? value : null;
        }
        return null;
      })
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    // 스팬이 비면(외부인 fail-closed 또는 공고 0개) work_logs 조회를 생략한다.
    if (spanIds.length === 0) {
      logger.info('운영처 스팬 비어있음 — 빈 결과', { venueId });
      return [];
    }

    const { data, error } = await supabase
      .from(TABLE)
      .select(TABLE_COLUMNS)
      .in('job_posting_id', spanIds)
      .gte('date', fromDate)
      .lte('date', toDate)
      .not('status', 'in', `(${STATUS.WORK_LOG.CANCELLED},${STATUS.WORK_LOG.NO_SHOW})`)
      .order('date', { ascending: false })
      .limit(MAX_STATS_PAGE_SIZE);

    if (error)
      handleSupabaseError(error, { operation: '운영처 스팬 정산 근무 기록 조회', table: TABLE });

    const items = rowsToWorkLogs((data ?? []) as Record<string, unknown>[]);
    if (items.length === MAX_STATS_PAGE_SIZE) {
      logger.warn(
        '운영처 스팬 정산 근무 기록 조회 상한 도달 — 날짜범위 축소/페이지네이션 필요 가능',
        {
          venueId,
          limit: MAX_STATS_PAGE_SIZE,
        }
      );
    }
    logger.info('운영처 스팬 정산 근무 기록 조회 완료', { venueId, count: items.length });
    return items;
  } catch (error) {
    rethrowOrHandle(error, '운영처 스팬 정산 근무 기록 조회', { venueId, fromDate, toDate });
  }
}

/**
 * `update_work_log_slot` RPC 가 RAISE 한 도메인 에러를 앱 에러로 변환.
 * (매칭되지 않으면 null 반환 → 공통 핸들러로 위임)
 *
 * 서버 메시지는 `CODE: 사용자 문구` 형식이라 접두사를 떼어 그대로 노출한다 —
 * 같은 문구를 클라와 서버 두 곳에서 따로 관리하면 조용히 갈라진다(정산 RPC 와 동일 관용구).
 */
function toUpdateSlotError(error: unknown, settledVerb = '시간을 수정할'): AppError | null {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';

  const userMessage = (fallback: string): string => {
    const idx = message.indexOf(': ');
    return idx >= 0 ? message.slice(idx + 2).trim() : fallback;
  };

  // 🔑 데드락은 **재시도하면 성공하는** 실패다. 이 RPC 는 applications → work_logs 순으로 잠그는데,
  //    QR 체크아웃 경로는 work_logs 를 잠근 뒤 `tr_sync_application_completion` 트리거가
  //    applications 를 갱신해 순서가 역전된다(선재 클래스 — `cancel_application_atomically` 와
  //    같은 트리거 사이에도 이미 존재한다). 같은 지원서에서 두 작업이 겹치면 한쪽이 40P01 로 중단된다.
  //    매핑하지 않으면 '알 수 없는 오류'로 보여 사용자가 재시도할 이유를 알 수 없다.
  if (code === '40P01' || message.includes('deadlock detected')) {
    return new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '다른 작업과 겹쳤어요. 잠시 후 다시 시도해주세요.',
    });
  }

  if (message.includes('PERMISSION_DENIED')) {
    return new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
      userMessage: userMessage('권한이 있는 공고의 근무 기록만 수정할 수 있습니다'),
    });
  }
  if (message.includes('WORK_LOG_NOT_FOUND')) {
    return new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
      userMessage: '근무 기록을 찾을 수 없습니다',
    });
  }
  // 정산 완료 잠금 — 서버가 **실적 키(checkIn/checkOut)에만** 건다(20260806140000:350).
  //
  // 🔑 문구만은 서버 메시지를 쓰지 않는다. 이 잠금 안내는 UI→Repository→트리거 4계층에 걸쳐
  //    있어 `settledLockMessage` 를 단일 소스로 못박아 뒀고(문구가 4종으로 갈라졌던 이력),
  //    서버 문장에는 "정산을 되돌린 뒤 다시 시도" 라는 **탈출 경로**가 빠져 있다.
  //    에러 클래스도 흡수 전 두 리포지토리가 던지던 AlreadySettledError(E6009)로 되돌린다 —
  //    형제 경로 `settle_work_log` 의 ALREADY_SETTLED 매핑과 같은 관용구다.
  //    🔑 `settledVerb` 로 갈라 두는 이유: status 패치는 시각이 아니라 **상태**를 막는다
  //       (서버가 실적 키와 다른 규칙을 쓴다 — 시각 변경 여부와 무관하게 거부). "시간을 수정할"
  //       로 고정하면 상태 변경 버튼을 눌렀는데 시간 얘기가 나온다.
  if (message.includes('ALREADY_SETTLED')) {
    return new AlreadySettledError({ userMessage: settledLockMessage(settledVerb) });
  }
  if (message.includes('INVALID_INPUT')) {
    return new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
      userMessage: userMessage('수정 요청이 올바르지 않습니다'),
    });
  }
  return null;
}

/**
 * 슬롯 편집 — 예정 시간/역할/색상/메모 + **실적(출퇴근)** 부분 수정.
 *
 * 🔴 **실적 쓰기의 유일한 경로다.** 예전엔 근무표(B2)만 이 RPC 를 쓰고 출퇴근 수정은
 * `ConfirmedStaffRepository`·`SettlementRepository` 의 클라 직접 UPDATE 2곳이었다. 편집기를
 * 시트 하나로 합치면 "저장 한 번"이 **호출 두 번**(RPC + PATCH)이 되어 한쪽만 성공하는 부분
 * 실패가 생기므로, 실적을 이 RPC 로 흡수했다(20260806140000). 권한·정산 완료 잠금·근태 상태
 * 파생·수정 이력 append 는 전부 서버 안에서 끝난다 — 클라가 다단계로 흉내내지 않는다.
 *
 * 예정 축도 같은 이유로 이미 여기 있다: `work_logs` 만 직접 UPDATE 하면 `applications.assignments[]`
 * 가 낡은 채 남아 **두 원천이 표류**했다(세션 E 는 병합 키를 FK 로 바꿔 화면 증상만 막았고,
 * 원천 불일치는 남아 있었다). RPC 는 둘을 한 트랜잭션에서 갱신한다. 매칭이 모호하면 서버가
 * assignments 동기화만 건너뛰고 `assignmentSynced:false` 를 돌려준다 — 남의 원소를 오염시키는
 * 것보다 표류가 싸다.
 *
 * 검증 경계(Repository): color 는 토큰 화이트리스트(자유 hex 거부), memo 는 XSS 검증
 * 통과분만 기록(S1/U3), 출근 예정 시각은 'HH:mm' 형식 검증(범위·자유 텍스트 거부).
 * 🔑 이 관문들은 **RPC 호출 전에** 던진다 — 위반이면 서버에 아예 도달하지 않는다(fail-closed).
 * 서버도 같은 보안 불변식(길이·XSS·enum·시각 형식)을 재현하지만, 색 토큰 화이트리스트만은
 * 제품 규칙이라 클라에 남는다(팔레트를 늘릴 때마다 마이그가 필요해지지 않도록).
 *
 * 시간 축(§K 정본): `time_slot` = 출근 예정 시각 **단일값** 또는 미기록(=미정).
 * 시간 축을 안 보내면 패치에 시간 키를 만들지 않는다 — 색상·메모만 고치는 저장이 기존 시간을
 * 덮어쓰지 않도록(GRID-1). 스칼라 NULL 로는 '미제공'과 '비움'을 구분할 수 없어 패치는 jsonb 다.
 */
export async function updateSlot(workLogId: string, input: UpdateSlotInput): Promise<void> {
  try {
    logger.info('배치 슬롯 편집', { workLogId, fields: Object.keys(input) });

    const patch: Record<string, unknown> = {};

    // 시간: 미정이면 비우고, 아니면 출근 예정 시각 단일값으로 갱신(형식 위반은 throw).
    // 미정 우선 — 인원 추가 경로(addSlotPayload.buildTimeSlot)와 우선순위를 맞춘다.
    // 유효한 축 하나만 실어 보낸다(서버의 우선순위 분기와 이중 관리되지 않도록).
    if (input.timeUndecided) {
      patch.timeUndecided = true;
    } else if (input.startTime !== undefined) {
      patch.startTime = assertSlotStartTime(input.startTime);
    }

    // 역할(StaffRole)
    if (input.staffRole !== undefined) {
      patch.staffRole = input.staffRole;
    }

    // 커스텀 역할명 3상 — undefined=키 없음(미변경) / null=JSON null(삭제) / 문자열=설정.
    // ⚠️ `if (input.customRole)` 로 쓰면 **null 삭제가 조용히 무시된다**. `!== undefined` 로 본다.
    //
    // 🔑 memo·color·reason 과 달리 **클라 관문을 새로 만들지 않는다.** 이 값의 출처는 자유 입력이
    //    아니라 닫힌 칩 목록(공고가 정의한 이름 또는 그 행에 이미 저장된 이름)이고, 길이·XSS·
    //    enum 라벨 충돌 판정은 서버가 전부 갖고 있다(마이그 20260807120000·20260807130000).
    //    여기서 같은 뜻의 문구를 새로 쓰면 서버 문구와 조용히 갈라진다 — `toUpdateSlotError` 가
    //    `INVALID_INPUT` 의 서버 문장을 그대로 노출하는 이유와 같은 판단이다.
    if (input.customRole !== undefined) {
      patch.customRole = input.customRole;
    }

    // 색상: 화이트리스트 검증(자유 hex 거부) — 위반 시 ValidationError 던짐
    if (input.color !== undefined) {
      patch.color = assertSlotColor(input.color);
    }

    // 메모: XSS/길이 검증 — 위반 시 ValidationError 던짐
    if (input.memo !== undefined) {
      patch.memo = assertSlotMemo(input.memo);
    }

    // 수정 행위자(운영자). 값은 서버가 auth.uid() 로 덮어쓴다 — 키는 "기록할지" 만 정한다.
    if (input.editedBy !== undefined) {
      patch.editedBy = input.editedBy;
    }

    // 실적(출퇴근) 3상 — undefined=키 없음(미변경) / null=JSON null(삭제) / Date=ISO 문자열.
    // ⚠️ `if (input.checkIn)` 로 쓰면 **null 삭제가 조용히 무시된다**. `!== undefined` 로 본다.
    //    예정(startTime)과 달리 이 축은 서버에서 status 파생·수정 이력·정산 완료 잠금을 발동시킨다.
    if (input.checkIn !== undefined) {
      patch.checkIn = input.checkIn ? input.checkIn.toISOString() : null;
    }
    if (input.checkOut !== undefined) {
      patch.checkOut = input.checkOut ? input.checkOut.toISOString() : null;
    }

    // 수정 사유: XSS/길이 검증 — 위반 시 ValidationError 던짐(memo 와 동일 관문).
    // 서버도 같은 불변식을 재현하지만 흡수 전 두 경로가 이미 여기서 걸렀으므로 관문을 유지한다
    // (RPC 왕복 없이 즉시 거부 + 클라 문구 노출). 서버 정규식이 더 엄격해 통과분 일부는
    // 서버에서 INVALID_INPUT 으로 돌아올 수 있다 — 그쪽도 사용자 문구로 매핑돼 있다.
    if (input.reason !== undefined) {
      patch.reason = assertWorkTimeReason(input.reason);
    }

    // 근태 상태 명시 지정(마이그 20260810100000). 서버가 이 값에서 출퇴근 시각을 역파생하고
    // 이력을 append 한다 — 흡수 전에는 클라가 타임스탬프 파생·이력 조립을 직접 했고, 그
    // 이력 read-modify-write 가 Lost Update 의 4번째 경로였다.
    //
    // 🔑 클라 관문을 새로 만들지 않는다. 허용 값은 타입(`ManualWorkLogStatus`)이 이미 좁히고,
    //    행 상태·정산 잠금 판정은 잠근 스냅샷이 있어야 하므로 서버만 할 수 있다.
    if (input.status !== undefined) {
      patch.status = input.status;
    }

    const { data, error } = await supabase.rpc('update_work_log_slot', {
      p_work_log_id: workLogId,
      p_patch: patch,
    });

    if (error) {
      const mapped = toUpdateSlotError(
        error,
        input.status !== undefined ? '상태를 변경할' : '시간을 수정할'
      );
      if (mapped) throw mapped;
      handleSupabaseError(error, { operation: '배치 슬롯 편집', table: TABLE });
    }

    // 동기화 스킵은 실패가 아니다(편집은 성사됐다) — 다만 조용히 넘기지 않고 관측 가능하게 남긴다.
    const result = (data ?? {}) as { assignmentSynced?: boolean; assignmentSyncReason?: string };
    if (result.assignmentSynced === false && result.assignmentSyncReason !== 'no_application') {
      logger.warn('배치 슬롯 편집 — 지원서 배정 동기화 건너뜀', {
        workLogId,
        reason: result.assignmentSyncReason,
      });
    }

    logger.info('배치 슬롯 편집 완료', {
      workLogId,
      assignmentSynced: result.assignmentSynced,
    });
  } catch (error) {
    rethrowOrHandle(error, '배치 슬롯 편집', { workLogId });
  }
}
