/**
 * UNIQN Mobile - QR 출퇴근 서비스
 *
 * @description 현장 출퇴근용 고정 QR 처리 서비스
 * @version 3.0.0 - 회전 QR(event) 제거, 공고당 고정 QR(venue) 단일 경로
 *
 * 흐름:
 * 1. 구인자가 공고별 고정 QR 을 출력/공유해 현장에 비치 (QR 은 바뀌지 않는다)
 * 2. 스태프가 QR 스캔
 * 3. 서버가 현재 상태와 시간창으로 출근/퇴근을 자동 판별해 원자 처리
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
import { createJobDeepLink, trackCheckIn, trackCheckOut } from '@/services/observability';
import { toISODateString } from '@/utils/date';
import { workLogRepository } from '@/repositories';
import type { VenueQRDisplayData, QRProcessResult } from '@/types';
import { QR_MESSAGES, QR_PAYLOAD_TYPES } from '@/constants/qr';
import { SHARE_SOURCES } from '@/constants/shareSource';
import { WEB_PREFIX } from '@/services/observability/internal/deepLinkConstants';

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
    if (data.type !== QR_PAYLOAD_TYPES.venue) return null;
    if (!data.jobPostingId || typeof data.jobPostingId !== 'string') return null;

    return { type: 'venue', jobPostingId: data.jobPostingId };
  } catch (error) {
    logger.debug('QR 데이터 JSON 파싱 실패', { qrString: qrString.slice(0, 50), error });
    return null;
  }
}

/**
 * QR 페이로드의 `type` 만 읽는다 (형식이 아니면 null).
 *
 * 출근 스캐너가 "왜 안 되는지" 를 말하기 위해 필요하다 — 정체불명 QR 과
 * **지원 QR** 은 사용자가 취해야 할 행동이 다르다(전자는 다른 QR 을 찾아야 하고,
 * 후자는 자기가 스캐너를 잘못 열었다).
 */
function readQRPayloadType(qrString: string): string | null {
  try {
    const data = JSON.parse(qrString);
    return typeof data?.type === 'string' ? data.type : null;
  } catch {
    return null;
  }
}

/**
 * 지원 QR 문자열 생성 — 구직자가 찍으면 공고 상세가 열린다.
 *
 * 🚨 **URL 이어야 한다. JSON 이면 안 된다.**
 *    출근 QR(`{type:'venue',...}`)은 **우리 앱 스캐너**가 읽는다 — 그래서 JSON 이 맞다.
 *    지원 QR 은 **모르는 사람의 기본 카메라**가 읽는다. 카메라는 JSON 을 받으면 그냥
 *    의미 없는 글자를 보여줄 뿐 아무 데도 못 간다 — 기능이 통째로 죽는다.
 *    (2026-08-14 리뷰에서 실제로 이 상태로 적발됐다. 처음엔 출근 QR 페이로드를 복사해
 *     `{type:'apply'}` JSON 을 넣었는데, 그걸 읽는 소비자가 코드베이스에 **0곳**이었다.)
 *
 * 🔑 URL 이라서 얻는 것: 폰 카메라가 바로 연다 · 앱이 깔려 있으면 유니버설 링크로 앱이 열린다 ·
 *    `?src=apply_qr` 이 붙어 **QR 유입이 공유 퍼널에 그대로 잡힌다**(S3-5 의 나머지 절반과 연결).
 *    그리고 URL 은 출근 QR 의 JSON 과 형태부터 달라 혼동 위험도 그대로 없다.
 */
export function buildApplyQRString(jobPostingId: string): string {
  return createJobDeepLink(jobPostingId, true, SHARE_SOURCES.applyQr);
}

/** 우리 공고 링크인가 — 출근 스캐너가 "이건 지원 QR" 이라고 짚어 주기 위한 판별. */
function isJobPostingUrl(qrString: string): boolean {
  return qrString.startsWith(WEB_PREFIX) && qrString.includes('/jobs/');
}

function formatAppliedTime(value: Date): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(value);
}

// ============================================================================
// QR Service
// ============================================================================

/**
 * QR 스캔 출퇴근 처리 (유일한 스캔 진입점)
 *
 * @description 앱은 공고 ID와 본인 ID만 보내며, 서버가 날짜·허용 시간창·현재 상태를
 *   한 트랜잭션에서 판별한다. 후보가 둘 이상일 때만 선택 결과를 앱으로 돌려준다.
 */
export async function processQRCheckIn(
  qrString: string,
  staffId: string,
  selectedWorkLogId?: string,
  selectionToken?: string
): Promise<QRProcessResult> {
  const venueData = parseVenueQRData(qrString);

  if (!venueData) {
    // 지원 QR 을 출근 스캐너에 댄 경우는 따로 말해 준다 — "출근 QR이 아닙니다" 만 보면
    // 사용자는 무엇이 잘못됐는지 모르고 같은 QR 을 반복해서 찍는다.
    // 지원 QR 은 URL 이다(buildApplyQRString 주석 참고). 구 JSON 형태(type:'apply')도 함께
    // 본다 — 이미 인쇄돼 나간 물건이 있을 수 있고 판별 비용이 0 이다.
    const isApplyQR =
      isJobPostingUrl(qrString) || readQRPayloadType(qrString) === QR_PAYLOAD_TYPES.apply;
    throw new InvalidQRCodeError({
      message: isApplyQR ? '지원 QR 을 출근 스캐너에 스캔' : 'venue 형식이 아닌 QR',
      userMessage: isApplyQR ? QR_MESSAGES.applyQRScannedAtCheckIn : QR_MESSAGES.notCheckInQR,
    });
  }

  const { jobPostingId } = venueData;

  try {
    logger.info('QR 스캔 출퇴근 처리', { jobPostingId, staffId, selectedWorkLogId });
    const result = await workLogRepository.processPostingQRAttendance(
      jobPostingId,
      staffId,
      selectedWorkLogId,
      selectionToken
    );
    if (!result.success) return result;

    // Analytics는 트랜잭션 외부 — 실패해도 출퇴근은 성공이다.
    if (result.action === 'checkIn') {
      trackCheckIn(toISODateString(result.scannedAt) || '');
      logger.info('QR 출근 처리 완료', { workLogId: result.workLogId, staffId });
    } else {
      trackCheckOut(toISODateString(result.scannedAt) || '', result.workDuration ?? 0);
      logger.info('QR 퇴근 처리 완료', { workLogId: result.workLogId, staffId });
    }

    return {
      ...result,
      message: `${result.action === 'checkIn' ? '출근' : '퇴근'} 완료 · 스캔 ${formatAppliedTime(result.scannedAt)} → ${formatAppliedTime(result.appliedTime)} 적용`,
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
