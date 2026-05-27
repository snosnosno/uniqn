import { ERROR_CODES, ValidationError, handleServiceError } from '@/errors';
import { boardRepository } from '@/repositories';
import { requireMatchingCurrentUser } from '@/services/auth/authorizationService';
import { type BoardAuthorRole, type BoardJobSummary } from '@/types/board';
import { logger } from '@/utils/logger';
import { COMPONENT, assertSafeText, sanitizeBoardText } from './boardServiceShared';

export interface CreateSubstitutePostInput {
  authorId: string;
  authorName: string;
  authorRole: BoardAuthorRole;
  applicationId: string;
  jobSummary: BoardJobSummary;
  reason: string;
}

export async function createSubstitutePost(input: CreateSubstitutePostInput): Promise<string> {
  await requireMatchingCurrentUser(input.authorId);

  // 대타 글은 원 공고 연결이 필수 (아카이브 필터링 + 지원자 네비게이션에 사용).
  // 타입상 BoardJobSummary.jobPostingId는 string이지만 런타임 undefined/empty
  // 유입 방지를 위한 이중 가드.
  if (!input.jobSummary?.jobPostingId) {
    throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
      field: 'jobSummary.jobPostingId',
      userMessage: '대타 구인 글 작성 시 원 공고 연결이 필수입니다.',
    });
  }

  const title = `대타 구해요 · ${input.jobSummary.title}`;
  const dateInfo = input.jobSummary.workDate || '';
  const locationInfo = input.jobSummary.locationName || '';
  const compensationInfo = input.jobSummary.compensationLabel || '';

  const body = [
    input.reason,
    '',
    dateInfo ? `📅 ${dateInfo}` : '',
    locationInfo ? `📍 ${locationInfo}` : '',
    compensationInfo ? `💰 ${compensationInfo}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  assertSafeText('title', title, 120);
  assertSafeText('body', body, 5000);

  try {
    return await boardRepository.createPost({
      boardType: 'substitute',
      title: sanitizeBoardText(title),
      body: sanitizeBoardText(body),
      authorId: input.authorId,
      authorName: input.authorName,
      authorRole: input.authorRole,
      imageAttachments: [],
      linkedJobPostingId: input.jobSummary.jobPostingId,
      jobSummary: input.jobSummary,
    });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '대타 구인 글 작성',
      component: COMPONENT,
      context: { authorId: input.authorId, applicationId: input.applicationId },
    });
  }
}

export async function archiveSubstitutePostByLinkedPosting(
  linkedJobPostingId: string,
  authorId: string
): Promise<void> {
  try {
    const posts = await boardRepository.getPosts({
      boardTypes: ['substitute'],
      statuses: ['active'],
      linkedJobPostingId,
      authorId,
      limitCount: 10,
    });

    // Promise.allSettled: 각 post의 아카이브 시도는 독립적이어야 한다.
    // 순차 await 사용 시 N번째 실패가 N+1번째 시도를 막아 partial state가 남는다.
    const results = await Promise.allSettled(
      posts.map((post) => boardRepository.setPostStatus(post.id, 'archived'))
    );

    const failed = results
      .map((result, idx) => ({ result, postId: posts[idx].id }))
      .filter(({ result }) => result.status === 'rejected');
    const succeeded = results.length - failed.length;

    for (const { result, postId } of failed) {
      logger.warn('Substitute post archive failed for single post (non-blocking)', {
        postId,
        linkedJobPostingId,
        authorId,
        error: (result as PromiseRejectedResult).reason,
      });
    }

    if (posts.length > 0) {
      logger.info('Substitute posts archive result', {
        total: posts.length,
        succeeded,
        failed: failed.length,
        linkedJobPostingId,
        authorId,
      });
    }
  } catch (error) {
    logger.warn('Failed to archive substitute posts (non-blocking)', {
      linkedJobPostingId,
      authorId,
      error,
    });
  }
}
