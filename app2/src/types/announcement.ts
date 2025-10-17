/**
 * 구인공고 공지 타입 정의
 *
 * @description
 * 각 공고마다 확정된 스태프들에게 일괄 공지를 보내는 기능의 타입 정의
 *
 * @version 1.0.0
 * @since 2025-09-30
 */

import { Timestamp } from 'firebase/firestore';

/**
 * 공지 상태
 */
export type AnnouncementStatus = 'draft' | 'sending' | 'sent' | 'failed';

/**
 * 공지 전송 결과
 */
export interface AnnouncementSendResult {
  /** 전송 성공한 수신자 ID 목록 */
  successIds: string[];
  /** 전송 실패한 수신자 ID 목록 */
  failedIds: string[];
  /** 전송 성공 수 */
  successCount: number;
  /** 전송 실패 수 */
  failedCount: number;
  /** 에러 메시지 (실패 시) */
  errors?: Array<{
    userId: string;
    error: string;
  }>;
}

/**
 * 공지 문서 타입
 *
 * @description
 * Firestore의 `jobPostingAnnouncements` 컬렉션에 저장되는 문서 구조
 *
 * @example
 * /jobPostingAnnouncements/{announcementId}
 */
export interface JobPostingAnnouncement {
  /** 공지 고유 ID */
  id: string;

  /** 이벤트 ID (공고 ID) */
  eventId: string;

  /** 공지 제목 (최대 50자) */
  title: string;

  /** 공지 내용 (최대 500자) */
  message: string;

  /** 발신자 User ID */
  createdBy: string;

  /** 발신자 이름 */
  createdByName: string;

  /** 수신 대상 스태프 ID 목록 */
  targetStaffIds: string[];

  /** 전송 성공 수 */
  sentCount: number;

  /** 전송 실패 수 */
  failedCount: number;

  /** 공지 상태 */
  status: AnnouncementStatus;

  /** 생성 시간 */
  createdAt: Timestamp;

  /** 전송 시간 */
  sentAt?: Timestamp;

  /** 메타데이터 */
  metadata?: {
    /** 공고 제목 */
    jobPostingTitle: string;
    /** 공고 위치 */
    location: string;
  };

  /** 전송 결과 상세 */
  sendResult?: AnnouncementSendResult;
}

/**
 * 공지 생성 입력 데이터
 */
export interface CreateAnnouncementInput {
  /** 이벤트 ID (공고 ID) */
  eventId: string;

  /** 공지 제목 */
  title: string;

  /** 공지 내용 */
  message: string;

  /** 수신 대상 스태프 ID 목록 */
  targetStaffIds: string[];

  /** 메타데이터 (선택) */
  metadata?: {
    jobPostingTitle: string;
    location: string;
  };
}

/**
 * 공지 전송 요청 데이터 (Firebase Functions 호출용)
 */
export interface SendAnnouncementRequest {
  /** 이벤트 ID (공고 ID) */
  eventId: string;

  /** 공지 제목 */
  title: string;

  /** 공지 내용 */
  message: string;

  /** 수신 대상 스태프 ID 목록 */
  targetStaffIds: string[];

  /** 공고 제목 (알림 제목에 자동 추가) */
  jobPostingTitle?: string;
}

/**
 * 공지 전송 응답 데이터
 */
export interface SendAnnouncementResponse {
  /** 성공 여부 */
  success: boolean;

  /** 공지 문서 ID */
  announcementId?: string;

  /** 전송 결과 */
  result?: AnnouncementSendResult;

  /** 에러 메시지 (실패 시) */
  error?: string;
}

/**
 * 공지 필터 옵션
 */
export interface AnnouncementFilterOptions {
  /** 이벤트 ID (공고 ID) */
  eventId?: string;

  /** 발신자 ID */
  createdBy?: string;

  /** 상태 */
  status?: AnnouncementStatus;

  /** 시작 날짜 */
  startDate?: Date;

  /** 종료 날짜 */
  endDate?: Date;
}

/**
 * 공지 유효성 검증
 */
export const validateAnnouncement = (input: CreateAnnouncementInput): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!input.title || input.title.trim().length === 0) {
    errors.push('공지 제목은 필수입니다.');
  } else if (input.title.length > 50) {
    errors.push('공지 제목은 최대 50자까지 입력 가능합니다.');
  }

  if (!input.message || input.message.trim().length === 0) {
    errors.push('공지 내용은 필수입니다.');
  } else if (input.message.length > 500) {
    errors.push('공지 내용은 최대 500자까지 입력 가능합니다.');
  }

  if (!input.eventId || input.eventId.trim().length === 0) {
    errors.push('공고 ID는 필수입니다.');
  }

  if (!input.targetStaffIds || input.targetStaffIds.length === 0) {
    errors.push('수신 대상 스태프가 최소 1명 이상 필요합니다.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};