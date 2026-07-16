import { ERROR_CODES, handleServiceError, isAppError } from '@/errors';
import { boardRepository } from '@/repositories';
import { type BoardMembership, type BoardPost } from '@/types/board';
import { buildScheduleBoardPostId } from '@/shared/board/boardIds';
import type { JobPosting, WorkLog } from '@/types';
import { toDate } from '@/utils/date';
import {
  ACTIVE_POST_STATUSES,
  COMPONENT,
  buildDisplayName,
  sanitizeBoardText,
} from './boardServiceShared';

export function formatCompensationLabel(jobPosting: JobPosting): string {
  const amount = jobPosting.compensation.defaultSalary?.amount;
  const type = jobPosting.compensation.defaultSalary?.type;
  if (!amount || !type) {
    return '';
  }

  const typeLabelMap: Record<string, string> = {
    hourly: '시급',
    daily: '일급',
    monthly: '월급',
    other: '급여',
  };

  return `${typeLabelMap[type] ?? '급여'} ${amount.toLocaleString('ko-KR')}원`;
}

export function buildScheduleBoardBody(jobPosting: JobPosting): string {
  const lines = [
    `이 게시글은 "${jobPosting.title}"의 단체 대화방이에요. 공지사항, 문의사항, 소통 등 자유롭게 사용가능합니다.`,
  ];

  if (jobPosting.description?.trim()) {
    lines.push('', sanitizeBoardText(jobPosting.description));
  }

  return lines.join('\n');
}

export function buildScheduleSyncMembers(
  jobPosting: JobPosting,
  workLogs: WorkLog[]
): BoardMembership[] {
  const memberMap = new Map<string, BoardMembership>();
  const baseDate = jobPosting.workDate || jobPosting.workDates?.[0] || '';
  const postId = buildScheduleBoardPostId(jobPosting.id);
  const lastActivityAt = toDate(jobPosting.updatedAt ?? jobPosting.createdAt ?? null);

  memberMap.set(jobPosting.ownerId, {
    id: `${postId}_${jobPosting.ownerId}`,
    boardType: 'schedule',
    userId: jobPosting.ownerId,
    postId,
    jobPostingId: jobPosting.id,
    role: 'author',
    displayName: buildDisplayName(
      jobPosting.ownerName,
      undefined,
      `구인자 ${jobPosting.ownerId.slice(-4)}`
    ),
    canRead: true,
    canComment: true,
    title: jobPosting.title,
    workDate: baseDate,
    authorId: jobPosting.ownerId,
    lastActivityAt,
    createdAt: undefined,
    updatedAt: undefined,
  });

  workLogs
    .filter((workLog) => workLog.status !== 'cancelled')
    .forEach((workLog) => {
      if (memberMap.has(workLog.staffId)) {
        return;
      }

      memberMap.set(workLog.staffId, {
        id: `${postId}_${workLog.staffId}`,
        boardType: 'schedule',
        userId: workLog.staffId,
        postId,
        jobPostingId: jobPosting.id,
        role: 'confirmed',
        displayName: buildDisplayName(
          workLog.staffName,
          workLog.staffNickname,
          `스태프 ${workLog.staffId.slice(-4)}`
        ),
        canRead: true,
        canComment: true,
        title: jobPosting.title,
        workDate: workLog.date || baseDate,
        authorId: jobPosting.ownerId,
        lastActivityAt: toDate(workLog.updatedAt ?? workLog.createdAt ?? lastActivityAt),
        createdAt: undefined,
        updatedAt: undefined,
      });
    });

  return [...memberMap.values()];
}

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
