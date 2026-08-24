/**
 * UNIQN Mobile - 공고 일괄 공지 Repository (S3-2)
 *
 * @description 확정 스태프 전원에게 공지를 보내고(RPC), 발송 이력을 조회한다.
 *
 * 알림 INSERT 와 이력 기록은 **한 트랜잭션**이어야 하므로 반드시 RPC 경유다
 * (마이그 20260813140000). 클라이언트가 notifications 에 직접 쓰는 경로는 애초에 없다 —
 * RLS 에 INSERT 정책이 존재하지 않는다.
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { BusinessError, ERROR_CODES, toError } from '@/errors';
import { handleSupabaseError, toCamelCase } from '@/utils/supabase';
import { notFound } from '@/constants/messages';

const TABLE = 'job_posting_announcements';

export interface JobPostingAnnouncement {
  id: string;
  jobPostingId: string;
  senderId: string;
  title: string;
  body: string;
  recipientCount: number;
  createdAt: string;
}

/**
 * RPC 가 던지는 에러 문자열 → BusinessError.
 *
 * 🔑 서버는 `'CODE: 사람이 읽을 문장'` 형태로 던지고, postgrest 는 그걸 message 로만 전달한다
 *    (에러 `code` 는 살아남지 않는다). 그래서 **문자열 마커로** 판별한다 —
 *    이건 이 저장소의 확립된 관용구다(ConfirmedStaffRepository.toDirectStaffBusinessError).
 */
function toAnnouncementBusinessError(error: unknown): BusinessError | null {
  const message = error instanceof Error ? error.message : String(error ?? '');

  if (message.includes('RATE_LIMITED')) {
    return new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '방금 공지를 보냈어요. 잠시 후 다시 시도해주세요.',
    });
  }
  if (message.includes('VALIDATION_FAILED')) {
    return new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      // 서버 문장을 그대로 쓰지 않는 이유: 접두사가 섞여 나가면 사용자에게 코드가 보인다.
      userMessage: message.split('VALIDATION_FAILED:').pop()?.trim() || '입력값을 확인해주세요.',
    });
  }
  if (message.includes('PERMISSION_DENIED')) {
    return new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '이 공고에 공지를 보낼 권한이 없습니다.',
    });
  }
  if (message.includes('NOT_FOUND')) {
    return new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: notFound('공고'),
    });
  }
  return null;
}

class SupabaseJobPostingAnnouncementRepository {
  /**
   * 확정 스태프 전원에게 공지 발송.
   *
   * @returns 실제 수신자 수. 0 이면 보낼 대상이 없었다는 뜻이며 이력에는 남는다.
   */
  async send(jobPostingId: string, title: string, body: string): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('send_job_posting_announcement', {
        p_job_posting_id: jobPostingId,
        p_title: title,
        p_body: body,
      });

      if (error) {
        const business = toAnnouncementBusinessError(new Error(error.message));
        if (business) throw business;
        handleSupabaseError(error, { operation: '공지 발송', table: TABLE });
      }

      const count = Number(data ?? 0);
      logger.info('공고 공지 발송 완료', { jobPostingId, recipientCount: count });
      return Number.isFinite(count) ? count : 0;
    } catch (error) {
      const business = toAnnouncementBusinessError(error);
      if (business) throw business;
      if (error instanceof BusinessError) throw error;
      logger.error('공고 공지 발송 실패', toError(error), { jobPostingId });
      throw error;
    }
  }

  /** 이 공고의 발송 이력 (최신순). RLS 가 관리 권한자만 보게 한다. */
  async listByPosting(jobPostingId: string): Promise<JobPostingAnnouncement[]> {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .eq('job_posting_id', jobPostingId)
        .order('created_at', { ascending: false });

      if (error) handleSupabaseError(error, { operation: '공지 이력 조회', table: TABLE });

      return ((data ?? []) as Record<string, unknown>[]).map(
        (row) => toCamelCase(row) as unknown as JobPostingAnnouncement
      );
    } catch (error) {
      logger.error('공지 이력 조회 실패', toError(error), { jobPostingId });
      throw error;
    }
  }
}

export const jobPostingAnnouncementRepository = new SupabaseJobPostingAnnouncementRepository();
