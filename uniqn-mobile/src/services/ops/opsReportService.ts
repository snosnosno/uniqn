/**
 * ops 공개뷰 신고 서비스 (S1 B2) — 경계 검증(zod+XSS) + Repository 위임.
 * 공개 라우트(무계정)에서 호출 — authStore 비의존. 서버 가드 트리거가 토큰 해석·rate limit 전담.
 */
import { logger } from '@/utils/logger';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { isAppError, ValidationError, ERROR_CODES } from '@/errors';
import { opsReportRepository } from '@/repositories/ops';
import { opsPublicReportSchema, type OpsPublicReportInput } from '@/schemas/opsPublicReport.schema';

const COMPONENT = 'opsReportService';

export async function submitReport(input: OpsPublicReportInput): Promise<void> {
  try {
    logger.info('ops 공개뷰 신고 접수', { component: COMPONENT, tokenKind: input.tokenKind });
    const parsed = opsPublicReportSchema.safeParse(input);
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: typeof first === 'string' ? first : '입력값을 확인해 주세요.',
      });
    }
    await opsReportRepository.submit({
      tokenKind: parsed.data.tokenKind,
      token: parsed.data.token,
      reason: parsed.data.reason,
      details: parsed.data.details ?? null,
    });
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '공개뷰 신고',
      component: COMPONENT,
      context: { tokenKind: input.tokenKind },
    });
  }
}
