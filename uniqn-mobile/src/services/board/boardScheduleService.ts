import { ERROR_CODES, handleServiceError, isAppError } from '@/errors';
import { boardRepository } from '@/repositories';
import { type BoardMembership, type BoardPost } from '@/types/board';
import { buildScheduleBoardPostId } from '@/shared/board/boardIds';
import { toDate } from '@/utils/date';
import { ACTIVE_POST_STATUSES, COMPONENT } from './boardServiceShared';

export function sortSchedulePosts(
  posts: BoardPost[],
  memberships?: BoardMembership[]
): BoardPost[] {
  const membershipMap = memberships
    ? new Map(memberships.map((membership) => [membership.postId, membership]))
    : null;

  return [...posts].sort((left, right) => {
    const leftActivity =
      toDate(left.lastActivityAt ?? left.updatedAt ?? left.createdAt)?.getTime() ?? 0;
    const rightActivity =
      toDate(right.lastActivityAt ?? right.updatedAt ?? right.createdAt)?.getTime() ?? 0;
    const activityComparison = rightActivity - leftActivity;

    if (activityComparison !== 0) {
      return activityComparison;
    }

    const leftDate = membershipMap?.get(left.id)?.workDate ?? left.jobSummary?.workDate ?? '';
    const rightDate = membershipMap?.get(right.id)?.workDate ?? right.jobSummary?.workDate ?? '';
    return leftDate.localeCompare(rightDate);
  });
}

export function isActiveSchedulePostStatus(
  status: BoardPost['status']
): status is (typeof ACTIVE_POST_STATUSES)[number] {
  return ACTIVE_POST_STATUSES.includes(status as (typeof ACTIVE_POST_STATUSES)[number]);
}

export function isSkippableScheduleMembershipPostError(error: unknown): boolean {
  if (isAppError(error)) {
    return (
      error.code === ERROR_CODES.INFRA_NOT_FOUND ||
      error.code === ERROR_CODES.INFRA_PERMISSION_DENIED ||
      error.code === ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS
    );
  }

  return false;
}

export async function getReadableSchedulePostsByMemberships(
  memberships: BoardMembership[]
): Promise<BoardPost[]> {
  if (memberships.length === 0) {
    return [];
  }

  const posts = await Promise.all(
    memberships.map(async (membership) => {
      try {
        const post = await boardRepository.getPostById(membership.postId);

        if (!post || !isActiveSchedulePostStatus(post.status)) {
          return null;
        }

        return post;
      } catch (error) {
        if (isSkippableScheduleMembershipPostError(error)) {
          return null;
        }

        throw error;
      }
    })
  );

  return posts.filter((post): post is BoardPost => post !== null);
}

export async function getSchedulePostsForMemberships(
  memberships: BoardMembership[],
  limitCount?: number
): Promise<BoardPost[]> {
  if (memberships.length === 0) {
    return [];
  }

  const posts = await getReadableSchedulePostsByMemberships(memberships);
  const sortedPosts = sortSchedulePosts(posts, memberships);
  return limitCount ? sortedPosts.slice(0, limitCount) : sortedPosts;
}

export async function setScheduleBoardStatusIfExists(
  jobPostingId: string,
  status: Extract<BoardPost['status'], 'archived' | 'hidden'>
): Promise<boolean> {
  const postId = buildScheduleBoardPostId(jobPostingId);
  const existingPost = await boardRepository.getPostById(postId);

  if (!existingPost) {
    return false;
  }

  await boardRepository.setPostStatus(postId, status);
  return true;
}

export async function archiveScheduleBoard(jobPostingId: string): Promise<void> {
  try {
    await setScheduleBoardStatusIfExists(jobPostingId, 'archived');
  } catch (error) {
    throw handleServiceError(error, {
      operation: '일정게시판 보관',
      component: COMPONENT,
      context: { jobPostingId },
    });
  }
}
