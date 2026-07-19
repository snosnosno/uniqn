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
import { toISODateString, getTodayString, getYesterdayString } from '@/utils/date';
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
 * 어제 자 후보를 "아직 출근 중인 것"만 남기고 걸러낸다
 *
 * @description 어제 자 배정은 아직 출근 중인 것만 후보로 인정한다 —
 *   자정 넘는 근무의 퇴근 스캔을 위한 것이지, 지난 근무에 새로 출근하기 위한 것이 아니다.
 *   오늘 자·FIXED_SCHEDULE 후보는 그대로 통과시킨다.
 * @remarks 새 배열을 반환한다(입력 불변).
 */
function keepOnlyActiveYesterdayCandidates(candidates: WorkLog[], yesterday: string): WorkLog[] {
  return candidates.filter(
    (workLog) => workLog.date !== yesterday || workLog.status === WORK_LOG_STATUS_VALUES.CHECKED_IN
  );
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

    // 3. 어제 자 후보는 '아직 출근 중'인 것만 인정 (자정 넘는 근무의 퇴근 스캔용)
    const candidates = keepOnlyActiveYesterdayCandidates(rawCandidates, yesterday);

    // 4. 처리 대상 자동 선택 (하루 다중 배정 대응)
    const checkTime = new Date();
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
