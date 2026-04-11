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
    logger.info('QR 체크인/아웃', { workLogId, staffId, action });

    // 1. 근무 기록 + 공고 조회 (병렬)
    const [workLogResult, jobPostingResult] = await Promise.all([
      supabase.from(TABLE).select(TABLE_COLUMNS).eq('id', workLogId).maybeSingle(),
      supabase
        .from('job_postings')
        .select('id, status, owner_id')
        .eq('id', jobPostingId)
        .maybeSingle(),
    ]);

    if (workLogResult.error)
      handleSupabaseError(workLogResult.error, { operation: 'QR 근무 기록 조회', table: TABLE });
    if (!workLogResult.data) {
      throw new InvalidQRCodeError({
        message: '근무 기록이 존재하지 않습니다',
        userMessage: '근무 기록을 찾을 수 없습니다',
      });
    }

    const workLog = toWorkLog(workLogResult.data as Record<string, unknown>);
    if (!workLog) {
      throw new InvalidQRCodeError({
        message: '근무 기록 데이터가 유효하지 않습니다',
        userMessage: '근무 기록을 처리할 수 없습니다',
      });
    }

    // 공고 상태 확인
    if (jobPostingResult.error || !jobPostingResult.data) {
      throw new InvalidQRCodeError({
        message: '공고가 존재하지 않습니다',
        userMessage: '공고를 찾을 수 없습니다',
      });
    }

    const jpData = jobPostingResult.data as Record<string, unknown>;
    if (jpData.status !== 'active') {
      throw new InvalidQRCodeError({
        message: `공고 상태가 ${jpData.status as string}입니다`,
        userMessage: '활성 상태가 아닌 공고입니다',
      });
    }

    // 방어적 검증
    if (workLog.staffId !== staffId) {
      throw new InvalidQRCodeError({
        message: 'WorkLog staffId 불일치',
        userMessage: '권한이 없는 근무 기록입니다',
      });
    }

    if (workLog.jobPostingId !== jobPostingId) {
      throw new InvalidQRCodeError({
        message: 'WorkLog jobPostingId 불일치',
        userMessage: 'QR 코드와 근무 기록이 일치하지 않습니다',
      });
    }

    if (!workLog.isFixedPosting && workLog.date !== date) {
      throw new InvalidQRCodeError({
        message: `QR date(${date})와 WorkLog date(${workLog.date}) 불일치`,
        userMessage: 'QR 코드의 날짜가 근무 날짜와 일치하지 않습니다',
      });
    }

    if (workLog.payrollStatus === STATUS.PAYROLL.COMPLETED) {
      throw new BusinessError(ERROR_CODES.BUSINESS_ALREADY_SETTLED, {
        userMessage: '이미 정산 완료된 근무는 출퇴근 처리할 수 없습니다',
      });
    }

    const now = new Date().toISOString();

    if (action === 'checkIn') {
      if (
        workLog.status === STATUS.WORK_LOG.CHECKED_IN ||
        workLog.status === STATUS.WORK_LOG.CHECKED_OUT
      ) {
        throw new AlreadyCheckedInError({
          message: '이미 출근 처리되었습니다',
          userMessage: '이미 출근 처리가 완료되었습니다',
          workLogId,
        });
      }

      const { error } = await supabase
        .from(TABLE)
        .update({
          status: STATUS.WORK_LOG.CHECKED_IN,
          check_in_time: now,
          updated_at: now,
        })
        .eq('id', workLogId);

      if (error) handleSupabaseError(error, { operation: 'QR 출근 처리', table: TABLE });

      return {
        action: 'checkIn' as const,
        hasExistingCheckInTime: !!workLog.checkInTime,
        workDuration: 0,
      };
    } else {
      if (workLog.status !== STATUS.WORK_LOG.CHECKED_IN) {
        throw new NotCheckedInError({
          message: '먼저 출근 처리가 필요합니다',
          userMessage: '출근 처리 후 퇴근할 수 있습니다',
        });
      }

      let workDuration = 0;
      const checkInSource = workLog.checkInTime;
      if (checkInSource) {
        const startTime = TimeNormalizer.parseTime(checkInSource);
        if (startTime) {
          const durationMinutes = Math.round(
            (checkTime.getTime() - startTime.getTime()) / (1000 * 60)
          );
          workDuration = Math.round((durationMinutes / 60) * 100) / 100;
        }
      }

      const { error } = await supabase
        .from(TABLE)
        .update({
          status: STATUS.WORK_LOG.CHECKED_OUT,
          check_out_time: now,
          updated_at: now,
        })
        .eq('id', workLogId);

      if (error) handleSupabaseError(error, { operation: 'QR 퇴근 처리', table: TABLE });

      return {
        action: 'checkOut' as const,
        hasExistingCheckInTime: false,
        workDuration,
      };
    }
  } catch (error) {
    if (isAppError(error)) throw error;
    rethrowOrHandle(error, 'QR 체크인/아웃 (Transaction)', { workLogId, staffId, action });
  }
}
