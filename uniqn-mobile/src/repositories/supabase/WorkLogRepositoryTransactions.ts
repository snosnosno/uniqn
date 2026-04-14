/**
 * UNIQN Mobile - WorkLog Repository Transactions
 *
 * @description WorkLogRepository에서 사용하는 대형 트랜잭션 함수
 * updateWorkTimeTransaction, updatePayrollStatusTransaction, processQRCheckInOutTransaction
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
import { TimeNormalizer } from '@/shared/time';
import { STATUS } from '@/constants';
import type { PayrollStatus, QRCodeAction } from '@/types';
import { TABLE, TABLE_COLUMNS, toWorkLog, rethrowOrHandle } from './WorkLogRepositoryHelpers';

// ============================================================================
// updateWorkTimeTransaction
// ============================================================================

export async function executeUpdateWorkTime(
  workLogId: string,
  updates: {
    checkInTime?: Date;
    checkOutTime?: Date;
    notes?: string;
  }
): Promise<void> {
  try {
    logger.info('근무 시간 수정', { workLogId });

    // 1. 현재 상태 조회
    const { data: current, error: fetchError } = await supabase
      .from(TABLE)
      .select(TABLE_COLUMNS)
      .eq('id', workLogId)
      .maybeSingle();

    if (fetchError)
      handleSupabaseError(fetchError, { operation: '근무 시간 수정 조회', table: TABLE });
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

    // 2. 정산 완료된 경우 수정 불가
    if (workLog.payrollStatus === STATUS.PAYROLL.COMPLETED) {
      throw new BusinessError(ERROR_CODES.BUSINESS_ALREADY_SETTLED, {
        userMessage: '이미 정산 완료된 근무 기록은 수정할 수 없습니다',
      });
    }

    // 3. 업데이트 데이터 구성
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.checkInTime) {
      updateData.check_in_time = updates.checkInTime.toISOString();
    }

    if (updates.checkOutTime) {
      updateData.check_out_time = updates.checkOutTime.toISOString();
    }

    if (updates.notes !== undefined) {
      updateData.notes = updates.notes;
    }

    // workDuration 재계산
    const finalCheckIn =
      updates.checkInTime ?? TimeNormalizer.parseTime(workLog.checkInTime ?? null);
    const finalCheckOut =
      updates.checkOutTime ?? TimeNormalizer.parseTime(workLog.checkOutTime ?? null);

    if (finalCheckIn && finalCheckOut) {
      const durationMinutes = Math.round(
        (finalCheckOut.getTime() - finalCheckIn.getTime()) / (1000 * 60)
      );
      updateData.work_duration = Math.round((durationMinutes / 60) * 100) / 100;
    }

    // 4. 상태 업데이트 (check_in/out 둘 다 있으면 checked_out)
    if (updates.checkInTime && updates.checkOutTime) {
      updateData.status = STATUS.WORK_LOG.CHECKED_OUT;
    } else if (updates.checkInTime && !workLog.checkOutTime && !updates.checkOutTime) {
      updateData.status = STATUS.WORK_LOG.CHECKED_IN;
    }

    const { error } = await supabase.from(TABLE).update(updateData).eq('id', workLogId);

    if (error) handleSupabaseError(error, { operation: '근무 시간 수정', table: TABLE });

    logger.info('근무 시간 수정 완료', { workLogId });
  } catch (error) {
    if (isAppError(error)) throw error;
    rethrowOrHandle(error, '근무 시간 수정 (Transaction)', { workLogId });
  }
}

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
        userMessage: '이미 정산 완료된 근무 기록입니다',
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
        userMessage: '이미 정산 완료된 근무는 출퇴근 처리할 수 없습니다',
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
        userMessage: '활성 상태가 아닌 공고입니다',
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
  action: QRCodeAction,
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

    return {
      action: result.action ?? action,
      hasExistingCheckInTime: false,
      workDuration: result.work_duration ?? 0,
    };
  } catch (error) {
    if (isAppError(error)) throw error;
    rethrowOrHandle(error, 'QR 체크인/아웃 (Transaction)', { workLogId, staffId, action });
  }
}
