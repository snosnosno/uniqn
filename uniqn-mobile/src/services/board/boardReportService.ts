import { BusinessError, ERROR_CODES, ValidationError, handleServiceError } from '@/errors';
import { boardRepository, userRepository } from '@/repositories';
import { requireAdminUser, requireMatchingCurrentUser } from '@/services/auth/authorizationService';
import {
  type BoardAdminReportRecord,
  type BoardReport,
  type BoardReportFilterStatus,
  type BoardReportResolutionStatus,
  type CreateBoardReportInput,
} from '@/types/board';
import {
  COMPONENT,
  assertSafeText,
  buildDisplayName,
  getBoardPostInternal,
  getBoardPostOrThrow,
  sanitizeBoardText,
} from './boardServiceShared';

async function resolveBoardReporterInfo(
  reporterId: string
): Promise<Pick<BoardAdminReportRecord, 'reporterName' | 'reporterRole'>> {
  try {
    const reporter = await userRepository.getById(reporterId);

    return {
      reporterName: buildDisplayName(
        reporter?.name,
        reporter?.nickname,
        `사용자 ${reporterId.slice(-4)}`
      ),
      reporterRole: reporter?.role ?? 'staff',
    };
  } catch {
    return {
      reporterName: `사용자 ${reporterId.slice(-4)}`,
      reporterRole: 'staff',
    };
  }
}

async function buildBoardAdminReportRecord(report: BoardReport): Promise<BoardAdminReportRecord> {
  const [post, reporterInfo, targetComment] = await Promise.all([
    getBoardPostInternal(report.postId),
    resolveBoardReporterInfo(report.reporterId),
    report.targetType === 'comment'
      ? boardRepository.getCommentById(report.postId, report.targetId)
      : Promise.resolve(null),
  ]);

  const targetAuthorId =
    report.targetType === 'post' ? post?.authorId : (targetComment?.authorId ?? undefined);
  const targetAuthorName =
    report.targetType === 'post' ? post?.authorName : (targetComment?.authorName ?? undefined);

  return {
    report,
    post,
    targetComment,
    reporterName: reporterInfo.reporterName,
    reporterRole: reporterInfo.reporterRole,
    targetAuthorId,
    targetAuthorName,
  };
}

export async function createBoardReport(input: CreateBoardReportInput): Promise<string> {
  await requireMatchingCurrentUser(input.reporterId);
  assertSafeText('reason', input.reason, 80);
  if (input.details?.trim()) {
    assertSafeText('details', input.details, 1000);
  }

  try {
    const post = await getBoardPostOrThrow(input.postId, '신고 대상을 찾을 수 없습니다.');

    if (input.targetType === 'post') {
      if (post.boardType === 'notice') {
        throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
          userMessage: '공지사항은 신고할 수 없습니다.',
        });
      }

      if (post.authorId === input.reporterId) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '본인 게시글은 신고할 수 없습니다.',
        });
      }
    } else {
      if (post.boardType === 'notice') {
        throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
          userMessage: '공지사항 댓글은 신고할 수 없습니다.',
        });
      }

      const targetComment = await boardRepository.getCommentById(input.postId, input.targetId);
      if (!targetComment) {
        throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
          userMessage: '신고할 댓글을 찾을 수 없습니다.',
        });
      }

      if (targetComment.status !== 'active') {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '비활성화된 댓글은 신고할 수 없습니다.',
        });
      }

      if (targetComment.authorId === input.reporterId) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '본인 댓글은 신고할 수 없습니다.',
        });
      }
    }

    return await boardRepository.createReport({
      ...input,
      reason: sanitizeBoardText(input.reason),
      details: input.details ? sanitizeBoardText(input.details) : undefined,
    });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '게시판 신고',
      component: COMPONENT,
      context: { postId: input.postId, reporterId: input.reporterId },
    });
  }
}

export async function getBoardReportsForAdmin(
  adminUserId: string,
  options: { status?: BoardReportFilterStatus; limitCount?: number } = {}
): Promise<BoardAdminReportRecord[]> {
  await requireAdminUser(adminUserId);

  try {
    const reports = await boardRepository.getReports({
      status: options.status ?? 'all',
      limitCount: options.limitCount,
    });

    return Promise.all(reports.map((report) => buildBoardAdminReportRecord(report)));
  } catch (error) {
    throw handleServiceError(error, {
      operation: '게시판 신고 목록 조회',
      component: COMPONENT,
      context: { adminUserId, status: options.status ?? 'all' },
    });
  }
}

export async function getBoardReportDetailForAdmin(
  reportId: string,
  adminUserId: string
): Promise<BoardAdminReportRecord> {
  await requireAdminUser(adminUserId);

  try {
    const report = await boardRepository.getReportById(reportId);
    if (!report) {
      throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
        userMessage: '게시판 신고를 찾을 수 없습니다.',
      });
    }

    return buildBoardAdminReportRecord(report);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '게시판 신고 상세 조회',
      component: COMPONENT,
      context: { reportId, adminUserId },
    });
  }
}

export async function reviewBoardReport(
  reportId: string,
  adminUserId: string,
  status: BoardReportResolutionStatus
): Promise<void> {
  await requireAdminUser(adminUserId);

  try {
    const report = await boardRepository.getReportById(reportId);
    if (!report) {
      throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
        userMessage: '게시판 신고를 찾을 수 없습니다.',
      });
    }

    if (report.status !== 'pending') {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '이미 처리된 게시판 신고입니다.',
      });
    }

    await boardRepository.reviewReport(reportId, status, adminUserId);
  } catch (error) {
    throw handleServiceError(error, {
      operation: '게시판 신고 처리',
      component: COMPONENT,
      context: { reportId, adminUserId, status },
    });
  }
}
