/**
 * UNIQN Mobile - WorkLog Repository Transactions
 *
 * @description WorkLogRepository에서 사용하는 대형 트랜잭션 함수
 * updatePayrollStatusTransaction, processQRCheckInOutTransaction
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { BusinessError, ERROR_CODES, isAppError } from '@/errors';
import {
  InvalidQRCodeError,
  AlreadyCheckedInError,
  NotCheckedInError,
} from '@/errors/BusinessErrors';
import { handleSupabaseError } from '@/utils/supabase';
import { settledLockMessage, ALREADY_SETTLED_MESSAGE } from '@/domains/settlement';
import { STATUS } from '@/constants';
import type { PayrollStatus, QRCodeAction, QRProcessAction } from '@/types';
import { TABLE, TABLE_COLUMNS, toWorkLog, rethrowOrHandle } from './WorkLogRepositoryHelpers';

// ============================================================================
// updatePayrollStatusTransaction
// ============================================================================

export async function executeUpdatePayrollStatus(
  workLogId: string,
  status: PayrollStatus,
  amount?: number
): Promise<void> {
  try {
    logger.info('정산 상태 업데이트 (Transaction)', { workLogId, status });

    // 1. 현재 상태 조회
    const { data: current, error: fetchError } = await supabase
      .from(TABLE)
      .select(TABLE_COLUMNS)
      .eq('id', workLogId)
      .maybeSingle();

    if (fetchError) handleSupabaseError(fetchError, { operation: '정산 상태 조회', table: TABLE });
    if (!current) {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_WORKLOG, {
        userMessage: '근무 기록을 찾을 수 없습니다',
      });
    }

    const workLog = toWorkLog(current as Record<string, unknown>);
    if (!workLog) {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_WORKLOG, {
        userMessage: '근무 기록 데이터가 올바르지 않습니다',
      });
    }

    // 2. 중복 정산 방지
    if (status === STATUS.PAYROLL.COMPLETED && workLog.payrollStatus === STATUS.PAYROLL.COMPLETED) {
      throw new BusinessError(ERROR_CODES.BUSINESS_ALREADY_SETTLED, {
        userMessage: ALREADY_SETTLED_MESSAGE,
      });
    }

    // 3. 업데이트
    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = {
      payroll_status: status,
      updated_at: now,
    };

    if (amount !== undefined) {
      updateData.payroll_amount = amount;
    }

    if (status === STATUS.PAYROLL.COMPLETED) {
      updateData.payroll_date = now;
    }

    const { error } = await supabase.from(TABLE).update(updateData).eq('id', workLogId);

    if (error)
      handleSupabaseError(error, { operation: '정산 상태 업데이트 (Transaction)', table: TABLE });

    logger.info('정산 상태 업데이트 완료', { workLogId, status });
  } catch (error) {
    if (isAppError(error)) throw error;
    rethrowOrHandle(error, '정산 상태 업데이트 (Transaction)', { workLogId, status });
  }
}

// ============================================================================
// processQRCheckInOutTransaction
// ============================================================================
// T-B4+B5: SELECT FOR UPDATE 기반 단일 트랜잭션으로 race window 제거.
// read-validate-write 분리 → process_qr_checkin_atomically RPC 단일 호출.

interface QRCheckinRpcResult {
  success: boolean;
  action?: QRCodeAction;
  check_in_time?: string;
  check_out_time?: string;
  work_duration?: number;
  error?: string;
}

function mapQRCheckinErrorToException(errorCode: string, workLogId: string): never {
  switch (errorCode) {
    case 'already_settled':
      throw new BusinessError(ERROR_CODES.BUSINESS_ALREADY_SETTLED, {
        userMessage: settledLockMessage('출퇴근을 처리할'),
      });
    case 'already_checked_in':
      throw new AlreadyCheckedInError({
        message: '이미 출근 처리되었습니다',
        userMessage: '이미 출근 처리가 완료되었습니다',
        workLogId,
      });
    case 'not_checked_in':
      throw new NotCheckedInError({
        message: '먼저 출근 처리가 필요합니다',
        userMessage: '출근 처리 후 퇴근할 수 있습니다',
      });
    case 'work_log_not_found':
      throw new InvalidQRCodeError({
        message: '근무 기록이 존재하지 않습니다',
        userMessage: '근무 기록을 찾을 수 없습니다',
      });
    case 'job_posting_not_found':
      throw new InvalidQRCodeError({
        message: '공고가 존재하지 않습니다',
        userMessage: '공고를 찾을 수 없습니다',
      });
    case 'job_posting_inactive':
      throw new InvalidQRCodeError({
        message: '공고 상태가 활성 아닙니다',
        userMessage: '종료된 공고입니다',
      });
    case 'staff_id_mismatch':
      throw new InvalidQRCodeError({
        message: 'WorkLog staffId 불일치',
        userMessage: '권한이 없는 근무 기록입니다',
      });
    case 'job_posting_id_mismatch':
      throw new InvalidQRCodeError({
        message: 'WorkLog jobPostingId 불일치',
        userMessage: 'QR 코드와 근무 기록이 일치하지 않습니다',
      });
    case 'date_mismatch':
      throw new InvalidQRCodeError({
        message: 'QR date와 WorkLog date 불일치',
        userMessage: 'QR 코드의 날짜가 근무 날짜와 일치하지 않습니다',
      });
    default:
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_WORKLOG, {
        userMessage: `출퇴근 처리 실패: ${errorCode}`,
      });
  }
}

export async function executeProcessQRCheckInOut(
  workLogId: string,
  staffId: string,
  jobPostingId: string,
  action: QRProcessAction,
  checkTime: Date,
  date: string
): Promise<{
  action: QRCodeAction;
  hasExistingCheckInTime: boolean;
  workDuration: number;
}> {
  try {
    logger.info('QR 체크인/아웃 (RPC)', { workLogId, staffId, action });

    const { data, error } = await supabase.rpc('process_qr_checkin_atomically', {
      p_work_log_id: workLogId,
      p_staff_id: staffId,
      p_job_posting_id: jobPostingId,
      p_action: action,
      p_check_time: checkTime.toISOString(),
      p_expected_date: date ?? null,
    });

    if (error) {
      handleSupabaseError(error, { operation: 'QR 체크인/아웃 RPC', table: TABLE });
    }

    const result = data as QRCheckinRpcResult | null;
    if (!result) {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_WORKLOG, {
        userMessage: 'QR 처리 응답이 비었습니다',
      });
    }

    if (!result.success) {
      mapQRCheckinErrorToException(result.error ?? 'unknown', workLogId);
    }

    // 'auto' 호출이어도 서버는 성공 시 해소된 action('checkIn'|'checkOut')을 반환한다.
    // 누락 시(이론상 없음) 'auto'면 출근을 기본값으로 안전 폴백.
    const resolvedAction: QRCodeAction = result.action ?? (action === 'auto' ? 'checkIn' : action);

    return {
      action: resolvedAction,
      hasExistingCheckInTime: !!result.check_in_time,
      workDuration: result.work_duration ?? 0,
    };
  } catch (error) {
    if (isAppError(error)) throw error;
    rethrowOrHandle(error, 'QR 체크인/아웃 (Transaction)', { workLogId, staffId, action });
  }
}
