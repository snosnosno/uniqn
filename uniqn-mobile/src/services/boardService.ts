/**
 * UNIQN Mobile - Board Service (thin 진입점)
 *
 * @description boardService는 7개 도메인 모듈로 분할되었습니다.
 * 본 파일은 기존 import 경로(`@/services/boardService`)와 named export
 * 호환을 위한 re-export 진입점입니다. 신규 코드는 가능하면 도메인 모듈을
 * 직접 import 하세요.
 *
 * - board/boardServiceShared    : 상수·타입·헬퍼·권한 가드·공통 조회
 * - board/boardScheduleService  : 일정게시판 동기화/정렬 헬퍼
 * - board/boardPostService      : 게시글 조회/작성/수정/잠금/숨김
 * - board/boardCommentService   : 댓글 작성/수정/상태/고정·멘션 후보
 * - board/boardReactionService  : 게시글/댓글 반응
 * - board/boardReportService    : 게시판 신고
 * - board/boardSubstituteService: 대타 구인 글
 */
import {
  fetchBoardPosts,
  getBoardHomeData,
  getBoardPostDetail,
  incrementBoardPostViewCount,
  createBoardPost,
  updateBoardPost,
  setBoardPostLock,
  hideBoardPost,
} from './board/boardPostService';
import {
  getBoardMentionCandidates,
  createBoardComment,
  updateBoardComment,
  setBoardCommentStatus,
  setBoardCommentPinned,
} from './board/boardCommentService';
import { toggleBoardPostVote, toggleBoardCommentReaction } from './board/boardReactionService';
import {
  createBoardReport,
  getBoardReportsForAdmin,
  getBoardReportDetailForAdmin,
  reviewBoardReport,
} from './board/boardReportService';
// 일정게시판 sync 함수(@deprecated T-B12)는 named import 시 lint 규칙에 걸리므로
// 네임스페이스 import로 boardService 객체 호환성만 유지한다.
import * as boardScheduleService from './board/boardScheduleService';
import {
  createSubstitutePost,
  archiveSubstitutePostByLinkedPosting,
} from './board/boardSubstituteService';

export * from './board/boardServiceShared';
export * from './board/boardScheduleService';
export * from './board/boardPostService';
export * from './board/boardCommentService';
export * from './board/boardReactionService';
export * from './board/boardReportService';
export * from './board/boardSubstituteService';

export const boardService = {
  fetchBoardPosts,
  getBoardHomeData,
  getBoardPostDetail,
  getBoardMentionCandidates,
  incrementBoardPostViewCount,
  createBoardPost,
  createSubstitutePost,
  archiveSubstitutePostByLinkedPosting,
  updateBoardPost,
  setBoardPostLock,
  hideBoardPost,
  createBoardComment,
  updateBoardComment,
  setBoardCommentStatus,
  setBoardCommentPinned,
  toggleBoardPostVote,
  toggleBoardCommentReaction,
  createBoardReport,
  getBoardReportsForAdmin,
  getBoardReportDetailForAdmin,
  reviewBoardReport,
  syncScheduleBoardForJobPosting: boardScheduleService.syncScheduleBoardForJobPosting,
  syncScheduleBoardByJobPostingId: boardScheduleService.syncScheduleBoardByJobPostingId,
  syncScheduleBoardByApplicationId: boardScheduleService.syncScheduleBoardByApplicationId,
  archiveScheduleBoard: boardScheduleService.archiveScheduleBoard,
};

export default boardService;
