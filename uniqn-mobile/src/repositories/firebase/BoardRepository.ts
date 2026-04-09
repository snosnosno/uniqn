import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  documentId,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import {
  type BoardAuthorRole,
  type BoardComment,
  type BoardCommentReaction,
  type BoardImageAttachment,
  type BoardMembership,
  type BoardPost,
  type BoardPostStatus,
  type BoardReport,
  type BoardVote,
  type BoardVoteType,
  type CommentReactionType,
  type CreateBoardCommentInput,
  type CreateBoardPostInput,
  type CreateBoardReportInput,
  type ScheduleBoardSyncInput,
  type ScheduleMembershipSyncItem,
  type UpdateBoardCommentInput,
  type UpdateBoardPostInput,
} from '@/types/board';
import { buildScheduleBoardPostId } from '@/shared/board/boardIds';
import { logger } from '@/utils/logger';
import type {
  FetchBoardRepositoryPostsOptions,
  FetchBoardReportsOptions,
  FetchScheduleMembershipsOptions,
  IBoardRepository,
} from '../interfaces/IBoardRepository';

const BOARD_POSTS_COLLECTION = 'boardPosts';
const BOARD_MEMBERSHIPS_COLLECTION = 'boardMemberships';
const BOARD_REPORTS_COLLECTION = 'boardReports';
const COMMENTS_SUBCOLLECTION = 'comments';
const VOTES_SUBCOLLECTION = 'votes';
const REACTIONS_SUBCOLLECTION = 'reactions';
const MAX_BATCH_OPERATIONS = 450;

function mapBoardPost(docSnap: QueryDocumentSnapshot<DocumentData>): BoardPost {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    boardType: data.boardType,
    source: data.source ?? 'board',
    title: data.title,
    body: data.body,
    authorId: data.authorId,
    authorName: data.authorName,
    authorRole: data.authorRole as BoardAuthorRole,
    visibility: data.visibility,
    status: data.status,
    linkedJobPostingId: data.linkedJobPostingId ?? null,
    isAutoCreated: data.isAutoCreated ?? false,
    isLocked: data.isLocked ?? false,
    lockedBy: data.lockedBy ?? null,
    lockedAt: data.lockedAt ?? null,
    likeCount: data.likeCount ?? 0,
    dislikeCount: data.dislikeCount ?? 0,
    commentCount: data.commentCount ?? 0,
    viewCount: data.viewCount ?? 0,
    imageAttachments: (data.imageAttachments ?? []) as BoardImageAttachment[],
    lastActivityAt: data.lastActivityAt ?? null,
    announcementCategory: data.announcementCategory,
    isPinned: data.isPinned ?? false,
    jobSummary: data.jobSummary,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function mapBoardComment(docSnap: QueryDocumentSnapshot<DocumentData>): BoardComment {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    postId: data.postId,
    parentCommentId: data.parentCommentId ?? null,
    body: data.body ?? '',
    authorId: data.authorId,
    authorName: data.authorName,
    authorRole: data.authorRole as BoardAuthorRole,
    mentionedUserIds: data.mentionedUserIds ?? [],
    reactionCounts: data.reactionCounts ?? {},
    isPinned: data.isPinned ?? false,
    pinnedAt: data.pinnedAt ?? null,
    pinnedBy: data.pinnedBy ?? null,
    status: data.status ?? 'active',
    imageAttachments: data.imageAttachments ?? [],
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function mapBoardMembership(docSnap: QueryDocumentSnapshot<DocumentData>): BoardMembership {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    boardType: data.boardType,
    userId: data.userId,
    postId: data.postId,
    jobPostingId: data.jobPostingId,
    role: data.role,
    displayName: data.displayName ?? undefined,
    canRead: data.canRead ?? false,
    canComment: data.canComment ?? false,
    title: data.title,
    workDate: data.workDate,
    authorId: data.authorId,
    lastActivityAt: data.lastActivityAt ?? null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function mapBoardReport(docSnap: QueryDocumentSnapshot<DocumentData>): BoardReport {
  const data = docSnap.data();

  return {
    id: docSnap.id,
    targetType: data.targetType,
    targetId: data.targetId,
    postId: data.postId,
    reporterId: data.reporterId,
    reason: data.reason,
    details: data.details,
    status: data.status,
    resolvedBy: data.resolvedBy ?? null,
    resolvedAt: data.resolvedAt ?? null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function chunkIds(ids: string[], chunkSize = 10): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += chunkSize) {
    chunks.push(ids.slice(index, index + chunkSize));
  }
  return chunks;
}

function getReactionCountField(type: CommentReactionType): string {
  return `reactionCounts.${type}`;
}

function getMembershipDocId(postId: string, userId: string): string {
  return `${postId}_${userId}`;
}

type BatchWriteOperation = (batch: ReturnType<typeof writeBatch>) => void;

async function commitWriteOperations(operations: BatchWriteOperation[]): Promise<void> {
  if (operations.length === 0) {
    return;
  }

  const db = getFirebaseDb();

  for (let index = 0; index < operations.length; index += MAX_BATCH_OPERATIONS) {
    const batch = writeBatch(db);
    operations.slice(index, index + MAX_BATCH_OPERATIONS).forEach((operation) => operation(batch));
    await batch.commit();
  }
}

export class FirebaseBoardRepository implements IBoardRepository {
  async getPostById(postId: string): Promise<BoardPost | null> {
    const snapshot = await getDoc(doc(getFirebaseDb(), BOARD_POSTS_COLLECTION, postId));
    if (!snapshot.exists()) {
      return null;
    }

    return mapBoardPost(snapshot as QueryDocumentSnapshot<DocumentData>);
  }

  async getPosts(options: FetchBoardRepositoryPostsOptions = {}): Promise<BoardPost[]> {
    const constraints: Parameters<typeof query>[1][] = [];

    if (options.boardTypes?.length === 1) {
      constraints.push(where('boardType', '==', options.boardTypes[0]));
    } else if ((options.boardTypes?.length ?? 0) > 1) {
      constraints.push(where('boardType', 'in', options.boardTypes!.slice(0, 10)));
    }

    if (options.authorId) {
      constraints.push(where('authorId', '==', options.authorId));
    }

    if (options.linkedJobPostingId) {
      constraints.push(where('linkedJobPostingId', '==', options.linkedJobPostingId));
    }

    if (options.statuses?.length === 1) {
      constraints.push(where('status', '==', options.statuses[0]));
    } else if ((options.statuses?.length ?? 0) > 1) {
      constraints.push(where('status', 'in', options.statuses!.slice(0, 10)));
    }

    if (options.onlyPinned) {
      constraints.push(where('isPinned', '==', true));
    }

    constraints.push(orderBy(options.sortBy ?? 'lastActivityAt', options.sortDirection ?? 'desc'));

    if (options.limitCount) {
      constraints.push(limit(options.limitCount));
    }

    const snapshot = await getDocs(
      query(collection(getFirebaseDb(), BOARD_POSTS_COLLECTION), ...constraints)
    );

    return snapshot.docs.map(mapBoardPost);
  }

  async getPostsByIds(postIds: string[]): Promise<BoardPost[]> {
    if (postIds.length === 0) {
      return [];
    }

    const snapshots = await Promise.all(
      chunkIds(postIds).map((ids) =>
        getDocs(
          query(collection(getFirebaseDb(), BOARD_POSTS_COLLECTION), where(documentId(), 'in', ids))
        )
      )
    );

    const posts = snapshots.flatMap((snapshot) => snapshot.docs.map(mapBoardPost));
    const ordering = new Map(postIds.map((id, index) => [id, index]));
    return posts.sort(
      (left, right) => (ordering.get(left.id) ?? 0) - (ordering.get(right.id) ?? 0)
    );
  }

  async createPost(input: CreateBoardPostInput): Promise<string> {
    const docRef = await addDoc(collection(getFirebaseDb(), BOARD_POSTS_COLLECTION), {
      boardType: input.boardType,
      source: 'board',
      title: input.title,
      body: input.body,
      authorId: input.authorId,
      authorName: input.authorName,
      authorRole: input.authorRole,
      visibility: 'public',
      status: 'active',
      linkedJobPostingId: null,
      isAutoCreated: false,
      isLocked: false,
      likeCount: 0,
      dislikeCount: 0,
      commentCount: 0,
      viewCount: 0,
      imageAttachments: input.imageAttachments ?? [],
      lastActivityAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    logger.info('Board post created', { component: 'BoardRepository', postId: docRef.id });
    return docRef.id;
  }

  async updatePost(postId: string, input: UpdateBoardPostInput): Promise<void> {
    await updateDoc(doc(getFirebaseDb(), BOARD_POSTS_COLLECTION, postId), {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.imageAttachments !== undefined ? { imageAttachments: input.imageAttachments } : {}),
      updatedAt: serverTimestamp(),
      lastActivityAt: serverTimestamp(),
    });
  }

  async setPostStatus(postId: string, status: BoardPostStatus): Promise<void> {
    await updateDoc(doc(getFirebaseDb(), BOARD_POSTS_COLLECTION, postId), {
      status,
      updatedAt: serverTimestamp(),
    });
  }

  async setPostLock(postId: string, isLocked: boolean, actorId: string): Promise<void> {
    await updateDoc(doc(getFirebaseDb(), BOARD_POSTS_COLLECTION, postId), {
      isLocked,
      status: isLocked ? 'locked' : 'active',
      lockedBy: isLocked ? actorId : null,
      lockedAt: isLocked ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    });
  }

  async incrementViewCount(postId: string): Promise<void> {
    await updateDoc(doc(getFirebaseDb(), BOARD_POSTS_COLLECTION, postId), {
      viewCount: increment(1),
    });
  }

  async getComments(postId: string): Promise<BoardComment[]> {
    const snapshot = await getDocs(
      query(
        collection(getFirebaseDb(), BOARD_POSTS_COLLECTION, postId, COMMENTS_SUBCOLLECTION),
        orderBy('createdAt', 'asc')
      )
    );

    return snapshot.docs.map(mapBoardComment);
  }

  async getCommentById(postId: string, commentId: string): Promise<BoardComment | null> {
    const snapshot = await getDoc(
      doc(getFirebaseDb(), BOARD_POSTS_COLLECTION, postId, COMMENTS_SUBCOLLECTION, commentId)
    );

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();

    return {
      id: snapshot.id,
      postId: data.postId ?? postId,
      parentCommentId: data.parentCommentId ?? null,
      body: data.body ?? '',
      authorId: data.authorId,
      authorName: data.authorName,
      authorRole: data.authorRole as BoardAuthorRole,
      mentionedUserIds: data.mentionedUserIds ?? [],
      reactionCounts: data.reactionCounts ?? {},
      isPinned: data.isPinned ?? false,
      pinnedAt: data.pinnedAt ?? null,
      pinnedBy: data.pinnedBy ?? null,
      status: data.status ?? 'active',
      imageAttachments: data.imageAttachments ?? [],
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  async createComment(input: CreateBoardCommentInput): Promise<string> {
    const db = getFirebaseDb();
    const commentsRef = collection(
      db,
      BOARD_POSTS_COLLECTION,
      input.postId,
      COMMENTS_SUBCOLLECTION
    );
    const commentRef = doc(commentsRef);
    const batch = writeBatch(db);

    batch.set(commentRef, {
      postId: input.postId,
      parentCommentId: input.parentCommentId ?? null,
      body: input.body,
      authorId: input.authorId,
      authorName: input.authorName,
      authorRole: input.authorRole,
      mentionedUserIds: input.mentionedUserIds ?? [],
      reactionCounts: {},
      isPinned: false,
      pinnedAt: null,
      pinnedBy: null,
      status: 'active',
      imageAttachments: input.imageAttachments ?? [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.update(doc(db, BOARD_POSTS_COLLECTION, input.postId), {
      commentCount: increment(1),
      lastActivityAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    return commentRef.id;
  }

  async updateComment(
    postId: string,
    commentId: string,
    input: UpdateBoardCommentInput
  ): Promise<void> {
    await updateDoc(
      doc(getFirebaseDb(), BOARD_POSTS_COLLECTION, postId, COMMENTS_SUBCOLLECTION, commentId),
      {
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.imageAttachments !== undefined
          ? { imageAttachments: input.imageAttachments }
          : {}),
        updatedAt: serverTimestamp(),
      }
    );
  }

  async setCommentStatus(
    postId: string,
    commentId: string,
    status: BoardComment['status']
  ): Promise<void> {
    const placeholder =
      status === 'hidden' ? '관리자에 의해 숨김된 댓글입니다.' : '삭제된 댓글입니다.';
    const db = getFirebaseDb();
    const postRef = doc(db, BOARD_POSTS_COLLECTION, postId);
    const commentRef = doc(db, BOARD_POSTS_COLLECTION, postId, COMMENTS_SUBCOLLECTION, commentId);

    await runTransaction(db, async (transaction) => {
      const commentSnap = await transaction.get(commentRef);
      if (!commentSnap.exists()) {
        return;
      }

      const previousStatus = (commentSnap.data().status ?? 'active') as BoardComment['status'];
      if (previousStatus !== 'active' || status === 'active') {
        return;
      }

      transaction.update(commentRef, {
        status,
        body: placeholder,
        isPinned: false,
        pinnedAt: null,
        pinnedBy: null,
        imageAttachments: [],
        mentionedUserIds: [],
        updatedAt: serverTimestamp(),
      });

      const postUpdate: Record<string, unknown> = {
        lastActivityAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        commentCount: increment(-1),
      };

      transaction.update(postRef, postUpdate);
    });
  }

  async setCommentPinned(
    postId: string,
    commentId: string,
    isPinned: boolean,
    actorId: string
  ): Promise<void> {
    await updateDoc(
      doc(getFirebaseDb(), BOARD_POSTS_COLLECTION, postId, COMMENTS_SUBCOLLECTION, commentId),
      {
        isPinned,
        pinnedAt: isPinned ? serverTimestamp() : null,
        pinnedBy: isPinned ? actorId : null,
        updatedAt: serverTimestamp(),
      }
    );
  }

  async togglePostVote(
    postId: string,
    userId: string,
    type: BoardVoteType
  ): Promise<BoardVoteType | null> {
    const db = getFirebaseDb();
    const postRef = doc(db, BOARD_POSTS_COLLECTION, postId);
    const voteRef = doc(db, BOARD_POSTS_COLLECTION, postId, VOTES_SUBCOLLECTION, userId);

    return runTransaction(db, async (transaction) => {
      const postSnap = await transaction.get(postRef);
      if (!postSnap.exists()) {
        return null;
      }

      const voteSnap = await transaction.get(voteRef);
      const previousType = voteSnap.exists() ? (voteSnap.data().type as BoardVoteType) : null;

      if (previousType === type) {
        transaction.delete(voteRef);
        transaction.update(postRef, {
          [`${type}Count`]: increment(-1),
          updatedAt: serverTimestamp(),
        });
        return null;
      }

      if (previousType) {
        transaction.update(voteRef, {
          type,
          updatedAt: serverTimestamp(),
        });
        transaction.update(postRef, {
          [`${previousType}Count`]: increment(-1),
          [`${type}Count`]: increment(1),
          updatedAt: serverTimestamp(),
        });
      } else {
        transaction.set(voteRef, {
          postId,
          userId,
          type,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        transaction.update(postRef, {
          [`${type}Count`]: increment(1),
          updatedAt: serverTimestamp(),
        });
      }

      return type;
    });
  }

  async getPostVote(postId: string, userId: string): Promise<BoardVote | null> {
    const snapshot = await getDoc(
      doc(getFirebaseDb(), BOARD_POSTS_COLLECTION, postId, VOTES_SUBCOLLECTION, userId)
    );
    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();
    return {
      id: snapshot.id,
      postId,
      userId,
      type: data.type,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  async toggleCommentReaction(
    postId: string,
    commentId: string,
    userId: string,
    type: CommentReactionType
  ): Promise<CommentReactionType | null> {
    const db = getFirebaseDb();
    const commentRef = doc(db, BOARD_POSTS_COLLECTION, postId, COMMENTS_SUBCOLLECTION, commentId);
    const reactionRef = doc(
      db,
      BOARD_POSTS_COLLECTION,
      postId,
      COMMENTS_SUBCOLLECTION,
      commentId,
      REACTIONS_SUBCOLLECTION,
      userId
    );

    return runTransaction(db, async (transaction) => {
      const commentSnap = await transaction.get(commentRef);
      if (!commentSnap.exists()) {
        return null;
      }

      const reactionSnap = await transaction.get(reactionRef);
      const previousType = reactionSnap.exists()
        ? (reactionSnap.data().type as CommentReactionType)
        : null;

      if (previousType === type) {
        transaction.delete(reactionRef);
        transaction.update(commentRef, {
          [getReactionCountField(type)]: increment(-1),
          updatedAt: serverTimestamp(),
        });
        return null;
      }

      if (previousType) {
        transaction.update(reactionRef, {
          type,
          updatedAt: serverTimestamp(),
        });
        transaction.update(commentRef, {
          [getReactionCountField(previousType)]: increment(-1),
          [getReactionCountField(type)]: increment(1),
          updatedAt: serverTimestamp(),
        });
      } else {
        transaction.set(reactionRef, {
          postId,
          commentId,
          userId,
          type,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        transaction.update(commentRef, {
          [getReactionCountField(type)]: increment(1),
          updatedAt: serverTimestamp(),
        });
      }

      return type;
    });
  }

  async getCommentReaction(
    postId: string,
    commentId: string,
    userId: string
  ): Promise<BoardCommentReaction | null> {
    const snapshot = await getDoc(
      doc(
        getFirebaseDb(),
        BOARD_POSTS_COLLECTION,
        postId,
        COMMENTS_SUBCOLLECTION,
        commentId,
        REACTIONS_SUBCOLLECTION,
        userId
      )
    );
    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();
    return {
      id: snapshot.id,
      commentId,
      userId,
      type: data.type,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  async getCommentReactionsByUser(
    postId: string,
    userId: string
  ): Promise<Record<string, CommentReactionType>> {
    const snapshot = await getDocs(
      query(
        collectionGroup(getFirebaseDb(), REACTIONS_SUBCOLLECTION),
        where('postId', '==', postId),
        where('userId', '==', userId)
      )
    );

    return snapshot.docs.reduce<Record<string, CommentReactionType>>((acc, reactionDoc) => {
      const data = reactionDoc.data();
      if (typeof data.commentId === 'string' && data.type) {
        acc[data.commentId] = data.type as CommentReactionType;
      }

      return acc;
    }, {});
  }

  async getMembershipsByUser(
    userId: string,
    options: FetchScheduleMembershipsOptions = {}
  ): Promise<BoardMembership[]> {
    const constraints: Parameters<typeof query>[1][] = [
      where('userId', '==', userId),
      where('boardType', '==', 'schedule'),
    ];

    if (options.canReadOnly) {
      constraints.push(where('canRead', '==', true));
    }

    constraints.push(orderBy(options.sortBy ?? 'workDate', options.sortDirection ?? 'asc'));

    if (options.limitCount) {
      constraints.push(limit(options.limitCount));
    }

    const snapshot = await getDocs(
      query(collection(getFirebaseDb(), BOARD_MEMBERSHIPS_COLLECTION), ...constraints)
    );

    return snapshot.docs.map(mapBoardMembership);
  }

  async getMembershipsByPost(postId: string): Promise<BoardMembership[]> {
    const snapshot = await getDocs(
      query(
        collection(getFirebaseDb(), BOARD_MEMBERSHIPS_COLLECTION),
        where('postId', '==', postId),
        where('boardType', '==', 'schedule')
      )
    );

    return snapshot.docs.map(mapBoardMembership);
  }

  async getMembership(postId: string, userId: string): Promise<BoardMembership | null> {
    const snapshot = await getDoc(
      doc(getFirebaseDb(), BOARD_MEMBERSHIPS_COLLECTION, getMembershipDocId(postId, userId))
    );
    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();

    return {
      id: snapshot.id,
      boardType: data.boardType,
      userId: data.userId,
      postId: data.postId ?? postId,
      jobPostingId: data.jobPostingId,
      role: data.role,
      displayName: data.displayName ?? undefined,
      canRead: data.canRead ?? false,
      canComment: data.canComment ?? false,
      title: data.title ?? '',
      workDate: data.workDate ?? '',
      authorId: data.authorId ?? '',
      lastActivityAt: data.lastActivityAt ?? null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  async replaceScheduleMemberships(
    postId: string,
    jobPostingId: string,
    members: ScheduleMembershipSyncItem[]
  ): Promise<void> {
    const db = getFirebaseDb();
    const existingSnapshot = await getDocs(
      query(
        collection(db, BOARD_MEMBERSHIPS_COLLECTION),
        where('postId', '==', postId),
        where('boardType', '==', 'schedule')
      )
    );

    const incomingIds = new Set(members.map((member) => getMembershipDocId(postId, member.userId)));
    const operations: BatchWriteOperation[] = [];

    existingSnapshot.docs.forEach((membershipDoc) => {
      if (!incomingIds.has(membershipDoc.id)) {
        operations.push((batch) => batch.delete(membershipDoc.ref));
      }
    });

    members.forEach((member) => {
      operations.push((batch) =>
        batch.set(
          doc(db, BOARD_MEMBERSHIPS_COLLECTION, getMembershipDocId(postId, member.userId)),
          {
            boardType: 'schedule',
            userId: member.userId,
            postId,
            jobPostingId,
            role: member.role,
            displayName: member.displayName ?? null,
            canRead: member.canRead,
            canComment: member.canComment,
            title: member.title,
            workDate: member.workDate,
            authorId: member.authorId,
            lastActivityAt: member.lastActivityAt ?? serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )
      );
    });

    await commitWriteOperations(operations);
  }

  async upsertSchedulePost(input: ScheduleBoardSyncInput): Promise<string> {
    const db = getFirebaseDb();
    const postId = buildScheduleBoardPostId(input.jobPostingId);
    const postRef = doc(db, BOARD_POSTS_COLLECTION, postId);

    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(postRef);
      const payload = {
        boardType: 'schedule',
        source: 'board',
        title: input.title,
        body: input.body,
        authorId: input.ownerId,
        authorName: input.ownerName,
        authorRole: input.ownerRole,
        visibility: 'participants_only',
        linkedJobPostingId: input.jobPostingId,
        isAutoCreated: true,
        imageAttachments: [],
        lastActivityAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        jobSummary: {
          jobPostingId: input.jobPostingId,
          title: input.title,
          workDate: input.workDate,
          workDates: input.workDates ?? [],
          locationName: input.locationName ?? '',
          totalPositions: input.totalPositions ?? 0,
          filledPositions: input.filledPositions ?? 0,
          compensationLabel: input.compensationLabel ?? '',
          jobPostingStatus: input.jobPostingStatus ?? '',
        },
      };

      if (snapshot.exists()) {
        transaction.update(postRef, payload);
        return;
      }

      transaction.set(postRef, {
        ...payload,
        status: 'active',
        isLocked: false,
        lockedBy: null,
        lockedAt: null,
        likeCount: 0,
        dislikeCount: 0,
        commentCount: 0,
        viewCount: 0,
        createdAt: serverTimestamp(),
      });
    });

    return postId;
  }

  async createReport(input: CreateBoardReportInput): Promise<string> {
    const docRef = await addDoc(collection(getFirebaseDb(), BOARD_REPORTS_COLLECTION), {
      ...input,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  }

  async getReportById(reportId: string): Promise<BoardReport | null> {
    const snapshot = await getDoc(doc(getFirebaseDb(), BOARD_REPORTS_COLLECTION, reportId));
    if (!snapshot.exists()) {
      return null;
    }

    return mapBoardReport(snapshot);
  }

  async getReports(options: FetchBoardReportsOptions = {}): Promise<BoardReport[]> {
    const snapshot = await getDocs(
      query(collection(getFirebaseDb(), BOARD_REPORTS_COLLECTION), orderBy('createdAt', 'desc'))
    );

    const reports = snapshot.docs.map(mapBoardReport);

    const filtered =
      options.status && options.status !== 'all'
        ? reports.filter((report) => report.status === options.status)
        : reports;

    return options.limitCount ? filtered.slice(0, options.limitCount) : filtered;
  }

  async getReportsByPostId(postId: string): Promise<BoardReport[]> {
    const snapshot = await getDocs(
      query(collection(getFirebaseDb(), BOARD_REPORTS_COLLECTION), where('postId', '==', postId))
    );

    return snapshot.docs.map(mapBoardReport);
  }

  async reviewReport(
    reportId: string,
    status: Extract<BoardReport['status'], 'resolved' | 'dismissed'>,
    resolvedBy: string
  ): Promise<void> {
    await updateDoc(doc(getFirebaseDb(), BOARD_REPORTS_COLLECTION, reportId), {
      status,
      resolvedBy,
      resolvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}
