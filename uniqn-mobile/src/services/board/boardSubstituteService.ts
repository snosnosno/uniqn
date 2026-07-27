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
}

/**
 * 대타 구인 글 제목·본문 — 폼 미리보기와 실제 게시물이 **같은 함수**를 쓰도록 분리했다.
 * 둘이 갈라지면 "이렇게 올라갑니다" 가 거짓 고지가 된다.
 */
export function buildSubstitutePostTitle(jobSummary: BoardJobSummary): string {
  return `대타 구해요 · ${jobSummary.title}`;
}

/**
 * ⚠️ 취소 사유는 **절대 싣지 않는다**(W1-10 / CANCEL-12).
 *
 * 이 게시판은 실명(작성자 = 프로필 이름)으로 전체 공개(`visibility: 'public'`)된다.
 * 예전에는 취소 사유 원문이 본문 첫 줄이었다 — 사용자는 사장에게만 말한다고 믿고
 * 질병·가족 문제 같은 사적 사유를 적는다. 사유는 사장에게만 전달하고, 게시판에는
 * 대타를 구하는 데 실제로 필요한 정보(일정·지점·보상)만 싣는다.
 *
 * 첫 줄 고정 문구는 장식이 아니다 — 프로덕션 호출부는 compensationLabel 을 넘기지 않고
 * workDate 도 빌 수 있어, 이 줄이 없으면 본문이 통째로 비어 assertSafeText 가 throw 한다.
 */
export function buildSubstitutePostBody(jobSummary: BoardJobSummary): string {
  const dateInfo = jobSummary.workDate || '';
  const locationInfo = jobSummary.locationName || '';
  const compensationInfo = jobSummary.compensationLabel || '';

  return [
    '아래 일정에 함께할 대타를 구합니다.',
    '',
    dateInfo ? `📅 ${dateInfo}` : '',
    locationInfo ? `📍 ${locationInfo}` : '',
    compensationInfo ? `💰 ${compensationInfo}` : '',
  ]
    .filter(Boolean)
    .join('\n');
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

  const title = buildSubstitutePostTitle(input.jobSummary);
  const body = buildSubstitutePostBody(input.jobSummary);

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
