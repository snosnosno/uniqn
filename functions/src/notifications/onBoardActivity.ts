import * as admin from "firebase-admin";
import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { handleTriggerError } from "../errors/errorHandler";
import { createAndSendNotification } from "../utils/notificationUtils";

const db = admin.firestore();

type BoardNotificationType =
  | "board_comment"
  | "board_reply"
  | "board_mention"
  | "board_locked";

interface BoardPostData {
  boardType?: string;
  title?: string;
  authorId?: string;
  isLocked?: boolean;
  lockedBy?: string | null;
}

interface BoardCommentData {
  authorId?: string;
  authorName?: string;
  parentCommentId?: string | null;
  mentionedUserIds?: string[];
  status?: string;
}

interface RecipientNotification {
  type: BoardNotificationType;
  title: string;
  body: string;
}

type RecipientMap = Map<string, RecipientNotification>;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function buildBoardLink(postId: string): string {
  return `/board/post/${postId}`;
}

function getBoardTitle(post: BoardPostData): string {
  return isNonEmptyString(post.title) ? post.title : "게시글";
}

function getCommentAuthorName(comment: BoardCommentData): string {
  return isNonEmptyString(comment.authorName) ? comment.authorName : "사용자";
}

function createCommentNotification(
  type: Extract<BoardNotificationType, "board_comment" | "board_reply">,
  authorName: string,
  boardTitle: string,
): RecipientNotification {
  if (type === "board_reply") {
    return {
      type,
      title: "새 답글",
      body: `${authorName}님이 "${boardTitle}"에 답글을 남겼습니다.`,
    };
  }

  return {
    type,
    title: "새 댓글",
    body: `${authorName}님이 "${boardTitle}"에 댓글을 남겼습니다.`,
  };
}

function createMentionNotification(
  authorName: string,
  boardTitle: string,
): RecipientNotification {
  return {
    type: "board_mention",
    title: "멘션",
    body: `${authorName}님이 "${boardTitle}"에서 회원님을 멘션했습니다.`,
  };
}

async function getBoardPost(postId: string): Promise<BoardPostData | null> {
  const snapshot = await db.collection("boardPosts").doc(postId).get();
  if (!snapshot.exists) {
    return null;
  }

  return snapshot.data() as BoardPostData;
}

async function getBoardComment(
  postId: string,
  commentId: string,
): Promise<BoardCommentData | null> {
  const snapshot = await db
    .collection("boardPosts")
    .doc(postId)
    .collection("comments")
    .doc(commentId)
    .get();

  if (!snapshot.exists) {
    return null;
  }

  return snapshot.data() as BoardCommentData;
}

async function getScheduleMemberIds(postId: string): Promise<string[]> {
  const snapshot = await db
    .collection("boardMemberships")
    .where("postId", "==", postId)
    .where("boardType", "==", "schedule")
    .where("canRead", "==", true)
    .get();

  return snapshot.docs.map((doc) => doc.data().userId).filter(isNonEmptyString);
}

async function getBoardCommentAuthorIds(postId: string): Promise<string[]> {
  const snapshot = await db
    .collection("boardPosts")
    .doc(postId)
    .collection("comments")
    .get();

  return snapshot.docs
    .map((doc) => doc.data().authorId)
    .filter(isNonEmptyString);
}

async function getActiveBoardCommentAuthorIds(
  postId: string,
): Promise<string[]> {
  const snapshot = await db
    .collection("boardPosts")
    .doc(postId)
    .collection("comments")
    .where("status", "==", "active")
    .get();

  return snapshot.docs
    .map((doc) => doc.data().authorId)
    .filter(isNonEmptyString);
}

function addRecipient(
  recipients: RecipientMap,
  recipientId: string,
  notification: RecipientNotification,
): void {
  const current = recipients.get(recipientId);
  if (!current || notification.type === "board_mention") {
    recipients.set(recipientId, notification);
  }
}

async function sendBoardNotification(
  recipientId: string,
  notification: RecipientNotification,
  postId: string,
  post: BoardPostData,
  senderId?: string,
  extraData: Record<string, string> = {},
): Promise<void> {
  await createAndSendNotification(
    recipientId,
    notification.type,
    notification.title,
    notification.body,
    {
      link: buildBoardLink(postId),
      priority:
        notification.type === "board_locked" ||
        notification.type === "board_mention"
          ? "high"
          : "normal",
      relatedId: postId,
      senderId,
      data: {
        postId,
        boardTitle: getBoardTitle(post),
        boardType: post.boardType ?? "",
        ...extraData,
      },
    },
  );
}

export const onBoardCommentCreated = onDocumentCreated(
  {
    document: "boardPosts/{postId}/comments/{commentId}",
    region: "asia-northeast3",
  },
  async (event) => {
    const { postId, commentId } = event.params;
    const comment = event.data?.data() as BoardCommentData | undefined;
    if (
      !comment ||
      comment.status === "hidden" ||
      comment.status === "deleted"
    ) {
      return;
    }

    const commentAuthorId = comment.authorId;
    if (!isNonEmptyString(commentAuthorId)) {
      return;
    }

    try {
      const post = await getBoardPost(postId);
      if (!post) {
        logger.warn("Board notification skipped because post was missing.", {
          postId,
          commentId,
        });
        return;
      }

      const authorName = getCommentAuthorName(comment);
      const boardTitle = getBoardTitle(post);
      const recipients: RecipientMap = new Map();
      const isReply = isNonEmptyString(comment.parentCommentId);
      const commentNotificationType: Extract<
        BoardNotificationType,
        "board_comment" | "board_reply"
      > = isReply ? "board_reply" : "board_comment";
      const scheduleMemberIds =
        post.boardType === "schedule" ? await getScheduleMemberIds(postId) : [];

      if (post.boardType === "schedule") {
        const participantIds = new Set<string>(scheduleMemberIds);
        if (isNonEmptyString(post.authorId)) {
          participantIds.add(post.authorId);
        }

        participantIds.forEach((recipientId) => {
          if (recipientId === commentAuthorId) {
            return;
          }

          addRecipient(
            recipients,
            recipientId,
            createCommentNotification(
              commentNotificationType,
              authorName,
              boardTitle,
            ),
          );
        });
      }

      if (isReply && isNonEmptyString(comment.parentCommentId)) {
        const parentComment = await getBoardComment(
          postId,
          comment.parentCommentId,
        );
        if (
          parentComment &&
          isNonEmptyString(parentComment.authorId) &&
          parentComment.authorId !== commentAuthorId
        ) {
          addRecipient(
            recipients,
            parentComment.authorId,
            createCommentNotification("board_reply", authorName, boardTitle),
          );
        }
      } else if (
        isNonEmptyString(post.authorId) &&
        post.authorId !== commentAuthorId
      ) {
        addRecipient(
          recipients,
          post.authorId,
          createCommentNotification("board_comment", authorName, boardTitle),
        );
      }

      if (
        isReply &&
        isNonEmptyString(post.authorId) &&
        post.authorId !== commentAuthorId
      ) {
        addRecipient(
          recipients,
          post.authorId,
          createCommentNotification("board_reply", authorName, boardTitle),
        );
      }

      const allowedMentionIds =
        post.boardType === "schedule"
          ? new Set<string>(
              [...scheduleMemberIds, post.authorId].filter(isNonEmptyString),
            )
          : new Set<string>(
              [
                post.authorId,
                ...(await getActiveBoardCommentAuthorIds(postId)),
              ].filter(isNonEmptyString),
            );

      const mentionIds = [...new Set(comment.mentionedUserIds ?? [])].filter(
        (userId) =>
          isNonEmptyString(userId) &&
          userId !== commentAuthorId &&
          allowedMentionIds.has(userId),
      );

      mentionIds.forEach((userId) => {
        addRecipient(
          recipients,
          userId,
          createMentionNotification(authorName, boardTitle),
        );
      });

      if (recipients.size === 0) {
        return;
      }

      await Promise.all(
        [...recipients.entries()].map(([recipientId, notification]) =>
          sendBoardNotification(
            recipientId,
            notification,
            postId,
            post,
            commentAuthorId,
            {
              commentId,
            },
          ),
        ),
      );
    } catch (error: unknown) {
      handleTriggerError(error, {
        operation: "게시판 댓글 알림 처리",
        context: { postId, commentId, authorId: commentAuthorId },
      });
    }
  },
);

export const onBoardPostLocked = onDocumentUpdated(
  { document: "boardPosts/{postId}", region: "asia-northeast3" },
  async (event) => {
    const { postId } = event.params;
    const before = event.data?.before.data() as BoardPostData | undefined;
    const after = event.data?.after.data() as BoardPostData | undefined;
    if (!before || !after) {
      return;
    }

    if (before.isLocked === after.isLocked || after.isLocked !== true) {
      return;
    }

    try {
      const recipientIds = new Set<string>();

      if (isNonEmptyString(after.authorId)) {
        recipientIds.add(after.authorId);
      }

      const [commentAuthorIds, scheduleMemberIds] = await Promise.all([
        getBoardCommentAuthorIds(postId),
        after.boardType === "schedule"
          ? getScheduleMemberIds(postId)
          : Promise.resolve([]),
      ]);

      commentAuthorIds.forEach((userId) => recipientIds.add(userId));
      scheduleMemberIds.forEach((userId) => recipientIds.add(userId));

      const actorId = isNonEmptyString(after.lockedBy)
        ? after.lockedBy
        : after.authorId;
      if (isNonEmptyString(actorId)) {
        recipientIds.delete(actorId);
      }

      if (recipientIds.size === 0) {
        return;
      }

      const notification: RecipientNotification = {
        type: "board_locked",
        title: "게시글 잠금",
        body: `"${getBoardTitle(after)}" 글이 잠겼습니다.`,
      };

      await Promise.all(
        [...recipientIds].map((recipientId) =>
          sendBoardNotification(
            recipientId,
            notification,
            postId,
            after,
            actorId ?? undefined,
          ),
        ),
      );
    } catch (error: unknown) {
      handleTriggerError(error, {
        operation: "게시글 잠금 알림 처리",
        context: { postId, lockedBy: after.lockedBy ?? null },
      });
    }
  },
);
