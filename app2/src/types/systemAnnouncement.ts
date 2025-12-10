/**
 * 시스템 공지사항 타입 정의
 *
 * @description
 * 전체 사용자 대상 시스템 공지를 관리하는 타입 정의
 *
 * @version 1.0.0
 * @since 2025-10-25
 */

import { Timestamp } from 'firebase/firestore';

/**
 * 공지사항 우선순위
 */
export type AnnouncementPriority = 'normal' | 'important' | 'urgent';

/**
 * 공지사항 상태
 */
export type AnnouncementStatus = 'draft' | 'sending' | 'active' | 'expired' | 'deleted';

/**
 * 시스템 공지사항 인터페이스
 *
 * @description
 * Firestore의 `systemAnnouncements` 컬렉션에 저장되는 문서 구조
 */
export interface SystemAnnouncement {
  /** 공지 고유 ID */
  id: string;

  /** 공지 제목 (최대 100자) */
  title: string;

  /** 공지 내용 (최대 2000자) */
  content: string;

  /** 우선순위 */
  priority: AnnouncementPriority;

  /** 공개 시작일 */
  startDate: Timestamp;

  /** 공개 종료일 (null이면 무기한) */
  endDate: Timestamp | null;

  /** 작성자 User ID */
  createdBy: string;

  /** 작성자 이름 */
  createdByName: string;

  /** 생성 시간 */
  createdAt: Timestamp;

  /** 수정 시간 */
  updatedAt: Timestamp;

  /** 활성 상태 */
  isActive: boolean;

  /** 조회수 */
  viewCount: number;

  /** 배너로 표시 여부 */
  showAsBanner: boolean;

  /** 첨부 이미지 URL */
  imageUrl?: string;

  /** 첨부 이미지 Storage 경로 */
  imageStoragePath?: string;
}

/**
 * 공지사항 생성 입력 데이터
 */
export interface CreateSystemAnnouncementInput {
  /** 공지 제목 */
  title: string;

  /** 공지 내용 */
  content: string;

  /** 우선순위 */
  priority: AnnouncementPriority;

  /** 공개 시작일 */
  startDate: Date;

  /** 공개 종료일 (선택) */
  endDate?: Date | null;

  /** 배너로 표시 여부 */
  showAsBanner?: boolean;

  /** 첨부 이미지 URL */
  imageUrl?: string;

  /** 첨부 이미지 Storage 경로 */
  imageStoragePath?: string;
}

/**
 * 공지사항 수정 입력 데이터
 */
export interface UpdateSystemAnnouncementInput {
  /** 공지 제목 */
  title?: string;

  /** 공지 내용 */
  content?: string;

  /** 우선순위 */
  priority?: AnnouncementPriority;

  /** 공개 시작일 */
  startDate?: Date;

  /** 공개 종료일 */
  endDate?: Date | null;

  /** 활성 상태 */
  isActive?: boolean;

  /** 배너로 표시 여부 */
  showAsBanner?: boolean;

  /** 첨부 이미지 URL */
  imageUrl?: string;

  /** 첨부 이미지 Storage 경로 */
  imageStoragePath?: string;
}

/**
 * 공지사항 필터 옵션
 */
export interface SystemAnnouncementFilter {
  /** 우선순위 */
  priority?: AnnouncementPriority;

  /** 활성 상태만 */
  activeOnly?: boolean;

  /** 시작 날짜 */
  startDate?: Date;

  /** 종료 날짜 */
  endDate?: Date;
}

/**
 * 페이지네이션 상태
 */
export interface AnnouncementPaginationState {
  /** 현재 페이지 (1부터 시작) */
  currentPage: number;

  /** 페이지당 항목 수 */
  pageSize: number;

  /** 전체 항목 수 */
  totalCount: number;

  /** 전체 페이지 수 */
  totalPages: number;

  /** 다음 페이지 존재 여부 */
  hasNextPage: boolean;

  /** 이전 페이지 존재 여부 */
  hasPrevPage: boolean;
}

/**
 * 공지사항 유효성 검증
 */
export const validateSystemAnnouncement = (
  input: CreateSystemAnnouncementInput
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // 제목 검증
  if (!input.title || input.title.trim().length === 0) {
    errors.push('공지 제목은 필수입니다.');
  } else if (input.title.length > 100) {
    errors.push('공지 제목은 최대 100자까지 입력 가능합니다.');
  }

  // 내용 검증
  if (!input.content || input.content.trim().length === 0) {
    errors.push('공지 내용은 필수입니다.');
  } else if (input.content.length > 2000) {
    errors.push('공지 내용은 최대 2000자까지 입력 가능합니다.');
  }

  // 우선순위 검증
  if (!['normal', 'important', 'urgent'].includes(input.priority)) {
    errors.push('올바른 우선순위를 선택해주세요.');
  }

  // 날짜 검증
  if (!input.startDate) {
    errors.push('공개 시작일은 필수입니다.');
  }

  if (input.endDate && input.startDate) {
    if (input.endDate < input.startDate) {
      errors.push('종료일은 시작일보다 이후여야 합니다.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * 우선순위 레이블 가져오기
 */
export const getPriorityLabel = (priority: AnnouncementPriority): string => {
  const labels: Record<AnnouncementPriority, string> = {
    normal: '일반',
    important: '중요',
    urgent: '긴급',
  };
  return labels[priority];
};

/**
 * 우선순위 색상 가져오기 (Tailwind CSS)
 */
export const getPriorityColor = (priority: AnnouncementPriority): string => {
  const colors: Record<AnnouncementPriority, string> = {
    normal: 'blue',
    important: 'orange',
    urgent: 'red',
  };
  return colors[priority];
};

/**
 * 우선순위 배지 스타일 가져오기
 */
export const getPriorityBadgeStyle = (priority: AnnouncementPriority): string => {
  const styles: Record<AnnouncementPriority, string> = {
    normal:
      'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700',
    important:
      'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 border border-orange-300 dark:border-orange-700',
    urgent:
      'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-700',
  };
  return styles[priority];
};
