/**
 * UNIQN Mobile - QR 출퇴근 서비스
 *
 * @description 현장 출퇴근용 고정 QR 처리 서비스
 * @version 3.0.0 - 회전 QR(event) 제거, 공고당 고정 QR(venue) 단일 경로
 *
 * 흐름:
 * 1. 구인자가 공고별 고정 QR 을 출력/공유해 현장에 비치 (QR 은 바뀌지 않는다)
 * 2. 스태프가 QR 스캔
 * 3. 처리 대상 work_log 자동 선택 후 서버가 출/퇴근을 자동 판정 (p_action='auto')
 *
 * QR 코드 데이터 구조:
 * { type: 'venue', jobPostingId: string }
 *
 * @note 위치(GPS) 검증을 추가할 경우 이 파일의 processQRCheckIn 한 곳만 수정하면 된다.
 */

import { logger } from '@/utils/logger';
import { toError, isAppError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { InvalidQRCodeError } from '@/errors/BusinessErrors';
import { trackCheckIn, trackCheckOut } from '@/services/observability';
import { toDate, toISODateString, getTodayString, getYesterdayString } from '@/utils/date';
import { WORK_LOG_STATUS_VALUES } from '@/constants/statusValues';
import { workLogRepository } from '@/repositories';
import { selectWorkLogForQR, type QRSelectionFailureReason } from './selectWorkLogForQR';
import type { VenueQRDisplayData, EventQRScanResult, WorkLog } from '@/types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 고정 QR 데이터 파싱
 *
 * @description type='venue' + jobPostingId 만 가진 고정 QR. 그 외 형식은 null.
 */
function parseVenueQRData(qrString: string): VenueQRDisplayData | null {
  try {
    const data = JSON.parse(qrString);
    if (data.type !== 'venue') return null;
    if (!data.jobPostingId || typeof data.jobPostingId !== 'string') return null;

    return { type: 'venue', jobPostingId: data.jobPostingId };
  } catch (error) {
    logger.debug('QR 데이터 JSON 파싱 실패', { qrString: qrString.slice(0, 50), error });
    return null;
  }
}

/**
 * 자정 넘는 근무로 인정할 출근 후 최대 경과 시간 (16시간)
 *
 * @description 정상적인 자정 넘김 근무(18:00 출근 → 다음날 02:00 퇴근 = 8시간)는 통과하고,
 *   퇴근 스캔을 깜빡해 하루가 지난 건(20시간 이상)은 제외되는 경계값이다.
 *
 *   상한이 없으면 D일 퇴근을 깜빡한 스태프가 D+1 아침 출근 스캔을 할 때 어제 자
 *   checked_in 이 선택되어(선택 규칙 ① checked_in 우선) 24시간짜리 허위 work_duration 이
 *   기록되고, 정작 오늘 출근은 되지 않는다. RPC 의 시각 클램프는 p_check_time 과 서버
 *   now() 의 편차만 보정하고 work_duration 은 `GREATEST(0, ...)` 로 음수만 막을 뿐 상한이
 *   없어, 이 필터가 정산 오염을 막는 유일한 지점이다.
 *
 *   상한은 **날짜가 아니라 상태(checked_in)** 를 기준으로 건다. 날짜 기준으로 걸면
 *   `date === 'FIXED_SCHEDULE'` 인 고정 공고 행이 검사를 통째로 건너뛴다.
 * @remarks 어떤 값을 골라도 휴리스틱이다 — "가장 긴 정상 근무"와 "퇴근을 깜빡한 하루 경과"
 *   사이 어딘가를 자르는 값이며, 16시간을 넘는 실제 근무는 이 경로로 퇴근할 수 없다.
 */
const MAX_OVERNIGHT_SHIFT_MS = 16 * 60 * 60 * 1000;

/**
 * 상한을 넘겼거나 되살릴 수 없는 후보를 걸러낸다
 *
 * @description 두 축을 본다 — **상태 축**과 **날짜 축**.
 *
 *   ① 상태 축(모든 날짜에 적용): `checked_in` 후보는 출근 후 경과 시간이 0 이상
 *      MAX_OVERNIGHT_SHIFT_MS 이내여야 한다. 이 검사를 어제 자에만 걸면 고정 공고
 *      후보(`date === 'FIXED_SCHEDULE'`)가 상한을 통째로 우회한다 — 고정 공고는
 *      스태프·공고당 work_log 가 1행뿐이라 퇴근 스캔을 놓치면 `checked_in` 으로
 *      무기한 남고, 며칠 뒤 스캔이 그 행을 퇴근시켜 수십 시간짜리 work_duration 을
 *      정산으로 흘려보낸다. 방어는 날짜가 아니라 상태에 걸어야 정직하다.
 *   ② 날짜 축: 어제 자 배정은 자정 넘는 근무의 **퇴근 스캔용**이지, 지난 근무에 새로
 *      출근하기 위한 것이 아니다. 그래서 어제 자는 `checked_in` 인 것만 남긴다.
 *
 * @remarks checkInTime 이 없거나 파싱 불가면 제외한다(fail-closed). 경과 시간을 판정할
 *   근거가 없는데 통과시키면 근거 없이 24시간짜리 근무를 기록하게 된다 — 스캔 실패가 낫다.
 * @remarks 경과 시간이 음수(미래 checkInTime — 기기 클럭 스큐·오염 데이터)인 것도 제외한다.
 *   상한만 보면 미래 시각이 검사를 통과해 버린다.
 * @remarks 새 배열을 반환한다(입력 불변).
 */
function filterStaleCandidates(candidates: WorkLog[], yesterday: string, now: Date): WorkLog[] {
  return candidates.filter((workLog) => {
    // ① 상태 축 — 날짜와 무관하게 출근 중인 후보의 경과 시간 상한을 강제한다.
    if (workLog.status === WORK_LOG_STATUS_VALUES.CHECKED_IN) {
      const checkInTime = toDate(workLog.checkInTime);
      if (!checkInTime) return false;

      const elapsedMs = now.getTime() - checkInTime.getTime();
      if (elapsedMs < 0 || elapsedMs > MAX_OVERNIGHT_SHIFT_MS) return false;
    }

    // ② 날짜 축 — 어제 자는 퇴근 스캔용이므로 출근 중인 것만 남긴다.
    if (workLog.date === yesterday) {
      return workLog.status === WORK_LOG_STATUS_VALUES.CHECKED_IN;
    }

    return true;
  });
}

/** 선택 실패 사유별 사용자 문구 */
const SELECTION_FAILURE_MESSAGES: Record<QRSelectionFailureReason, string> = {
  no_assignment: '오늘 이 공고에 배정된 근무가 없습니다',
  all_checked_out: '오늘 근무는 이미 퇴근 처리됐습니다',
  not_active: '취소되었거나 처리할 수 없는 근무입니다',
};

// ============================================================================
// QR Service
// ============================================================================

/**
 * QR 스캔 출퇴근 처리 (유일한 스캔 진입점)
 *
 * @description 고정 QR 스캔 → 오늘·어제·고정 스케줄 배정 후보 조회 →
 *   어제 자 필터 → 처리 대상 자동 선택 → process_qr_checkin_atomically(p_action='auto').
 *   서버가 현재 status 로 출근/퇴근을 결정한다(TOCTOU 방지).
 *
 *   어제까지 조회하는 이유는 자정 넘는 근무(18:00~02:00)다 — work_logs.date 가 시작일이라
 *   D+1 새벽 퇴근 스캔이 오늘 날짜로는 후보를 못 찾는다.
 */
export async function processQRCheckIn(
  qrString: string,
  staffId: string
): Promise<EventQRScanResult> {
  const venueData = parseVenueQRData(qrString);

  if (!venueData) {
    throw new InvalidQRCodeError({
      message: 'venue 형식이 아닌 QR',
      userMessage: 'UNIQN 출근 QR이 아닙니다',
    });
  }

  const { jobPostingId } = venueData;

  try {
    logger.info('QR 스캔 출퇴근 처리', { jobPostingId, staffId });

    // 1. 스캔 시점 기준 날짜 (QR 에 날짜 미인코딩)
    const today = getTodayString();
    const yesterday = getYesterdayString();

    // 2. 후보 조회 (고정 공고의 'FIXED_SCHEDULE' + 자정 넘는 근무용 어제 포함)
    const rawCandidates = await workLogRepository.findQRCandidates(
      jobPostingId,
      staffId,
      today,
      yesterday
    );

    // 3. 상한을 넘긴 후보 제거 — 출근 중(checked_in) 후보는 날짜와 무관하게 경과 시간 상한을
    //    적용하고, 어제 자는 추가로 '출근 중'인 것만 인정한다(자정 넘는 근무의 퇴근 스캔용).
    //    시계는 여기서 한 번만 읽어 필터와 선택이 같은 기준 시각을 쓰게 한다.
    const checkTime = new Date();
    const candidates = filterStaleCandidates(rawCandidates, yesterday, checkTime);

    // 4. 처리 대상 자동 선택 (하루 다중 배정 대응)
    const selection = selectWorkLogForQR(candidates, checkTime);

    if (!selection.workLog) {
      throw new InvalidQRCodeError({
        message: `QR 처리 대상 없음: ${selection.reason}`,
        userMessage: SELECTION_FAILURE_MESSAGES[selection.reason],
      });
    }

    const workLog = selection.workLog;
    const workLogId = workLog.id;

    // 5. auto 액션으로 원자적 처리 — 서버가 현재 status 로 출/퇴근 결정
    //    p_expected_date 는 **선택된 work_log 자신의 date**. 오늘 날짜를 고정으로 넘기면
    //    자정 넘는 근무(어제 자 행)를 RPC 의 date_mismatch 가드가 거부한다.
    const result = await workLogRepository.processQRCheckInOutTransaction(
      workLogId,
      staffId,
      jobPostingId,
      'auto',
      checkTime,
      workLog.date
    );

    // 6. Analytics (트랜잭션 외부 — 실패해도 출퇴근은 성공)
    if (result.action === 'checkIn') {
      trackCheckIn(toISODateString(checkTime) || '');
      logger.info('QR 출근 처리 완료', { workLogId, staffId });
    } else {
      trackCheckOut(toISODateString(checkTime) || '', result.workDuration);
      logger.info('QR 퇴근 처리 완료', { workLogId, staffId, workDuration: result.workDuration });
    }

    return {
      success: true,
      workLogId,
      assignmentGroupId: workLog.assignmentGroupId ?? null,
      timeSlot: workLog.timeSlot ?? null,
      action: result.action,
      checkTime,
      message: result.action === 'checkIn' ? '출근이 완료되었습니다.' : '퇴근이 완료되었습니다.',
    };
  } catch (error) {
    logger.error('QR 스캔 출퇴근 처리 실패', toError(error), { jobPostingId, staffId });

    if (isAppError(error)) throw error;

    throw handleServiceError(error, {
      operation: 'QR 스캔 출퇴근 처리',
      component: 'eventQRService',
      context: { jobPostingId, staffId },
    });
  }
}

/**
 * 공고별 고정 QR 문자열 생성
 *
 * @description 서버 왕복 없이 공고 ID 만으로 만들어진다. QR 은 바뀌지 않으므로
 *   생성·만료·갱신 개념이 없다.
 */
export function buildVenueQRString(jobPostingId: string): string {
  const data: VenueQRDisplayData = { type: 'venue', jobPostingId };
  return JSON.stringify(data);
}
