/**
 * UNIQN Mobile - 공지사항(Announcement) 타입 정의
 *
 * @description 관리자 공지사항 관리 및 사용자 열람 관련 타입
 * @version 1.0.0
 */

import { Timestamp } from 'firebase/firestore';
import type { FirebaseDocument, UserRole } from './common';
import { toDate } from './common';

// ============================================================================
// 카테고리 및 상태
// ============================================================================

/**
 * 공지사항 카테고리
 */
export type AnnouncementCategory =
  | 'notice' // 일반 공지
  | 'update' // 업데이트/변경
  | 'event' // 이벤트
  | 'maintenance'; // 점검 안내

/**
 * 공지사항 상태
 */
export type AnnouncementStatus =
  | 'draft' // 초안
  | 'published' // 발행됨
  | 'archived'; // 보관됨

/**
 * 공지사항 우선순위
 */
export type AnnouncementPriority = 0 | 1 | 2; // 0: 일반, 1: 중요, 2: 긴급

// ============================================================================
// 대상 설정
// ============================================================================

/**
 * 공지사항 대상 설정
 */
export interface TargetAudience {
  /** 대상 유형 */
  type: 'all' | 'roles';
  /** 대상 역할 (type이 'roles'일 때만) */
  roles?: UserRole[];
}

// ============================================================================
// 이미지 타입
// ============================================================================

/**
 * 공지사항 이미지 (다중 이미지 지원)
 */
export interface AnnouncementImage {
  /** 고유 ID (uuid) */
  id: string;
  /** 다운로드 URL */
  url: string;
  /** Storage 경로 */
  storagePath: string;
  /** 정렬 순서 */
  order: number;
}

/** 최대 이미지 개수 */
export const MAX_ANNOUNCEMENT_IMAGES = 10;

// ============================================================================
// 공지사항 인터페이스
// ============================================================================

/**
 * 공지사항 인터페이스
 */
export interface Announcement extends FirebaseDocument {
  /** 제목 */
  title: string;

  /** 내용 */
  content: string;

  /** 카테고리 */
  category: AnnouncementCategory;

  /** 상태 */
  status: AnnouncementStatus;

  /** 우선순위 (0: 일반, 1: 중요, 2: 긴급) */
  priority: AnnouncementPriority;

  /** 상단 고정 여부 */
  isPinned: boolean;

  /** 대상 설정 */
  targetAudience: TargetAudience;

  /** 작성자 ID */
  authorId: string;

  /** 작성자 이름 */
  authorName: string;

  /** 조회수 */
  viewCount: number;

  /** 발행일시 (선택) */
  publishedAt?: Timestamp;

  /** 첨부 이미지 URL (선택, 단일 이미지 - 호환성 유지) */
  imageUrl?: string | null;

  /** 첨부 이미지 Storage 경로 (선택, 단일 이미지 - 호환성 유지) */
  imageStoragePath?: string | null;

  /** 첨부 이미지 배열 (다중 이미지) */
  images?: AnnouncementImage[];
}

// ============================================================================
// 입력 타입
// ============================================================================

/**
 * 공지사항 생성 입력 (관리자)
 */
export interface CreateAnnouncementInput {
  title: string;
  content: string;
  category: AnnouncementCategory;
  priority?: AnnouncementPriority;
  isPinned?: boolean;
  targetAudience: TargetAudience;
  /** 첨부 이미지 URL (선택, 단일 이미지 - 호환성 유지) */
  imageUrl?: string | null;
  /** 첨부 이미지 Storage 경로 (선택, 단일 이미지 - 호환성 유지) */
  imageStoragePath?: string | null;
  /** 첨부 이미지 배열 (다중 이미지) */
  images?: AnnouncementImage[];
}

/**
 * 공지사항 수정 입력 (관리자)
 */
export interface UpdateAnnouncementInput {
  title?: string;
  content?: string;
  category?: AnnouncementCategory;
  priority?: AnnouncementPriority;
  isPinned?: boolean;
  targetAudience?: TargetAudience;
  /** 첨부 이미지 URL (선택, 단일 이미지 - 호환성 유지) */
  imageUrl?: string | null;
  /** 첨부 이미지 Storage 경로 (선택, 단일 이미지 - 호환성 유지) */
  imageStoragePath?: string | null;
  /** 첨부 이미지 배열 (다중 이미지) */
  images?: AnnouncementImage[];
}

/**
 * 공지사항 필터
 */
export interface AnnouncementFilters {
  status?: AnnouncementStatus | 'all';
  category?: AnnouncementCategory | 'all';
}

// ============================================================================
// 상수 및 라벨
// ============================================================================

/**
 * 카테고리 정보
 */
export interface AnnouncementCategoryInfo {
  key: AnnouncementCategory;
  label: string;
  description: string;
  icon: string;
}

/**
 * 카테고리 목록
 */
export const ANNOUNCEMENT_CATEGORIES: AnnouncementCategoryInfo[] = [
  { key: 'notice', label: '공지', description: '일반 공지사항', icon: 'megaphone' },
  { key: 'update', label: '업데이트', description: '서비스 업데이트 안내', icon: 'rocket' },
  { key: 'event', label: '이벤트', description: '이벤트 및 프로모션', icon: 'gift' },
  { key: 'maintenance', label: '점검', description: '서비스 점검 안내', icon: 'wrench' },
];

/**
 * 카테고리 라벨 맵
 */
export const ANNOUNCEMENT_CATEGORY_LABELS: Record<AnnouncementCategory, string> = {
  notice: '공지',
  update: '업데이트',
  event: '이벤트',
  maintenance: '점검',
};

/**
 * 상태 스타일 정보
 */
export const ANNOUNCEMENT_STATUS_CONFIG: Record<
  AnnouncementStatus,
  {
    label: string;
    color: string;
    bgColor: string;
  }
> = {
  draft: {
    label: '초안',
    color: 'text-gray-700 dark:text-gray-300',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
  },
  published: {
    label: '발행됨',
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  archived: {
    label: '보관됨',
    color: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
  },
};

/**
 * 상태 라벨 맵
 */
export const ANNOUNCEMENT_STATUS_LABELS: Record<AnnouncementStatus, string> = {
  draft: '초안',
  published: '발행됨',
  archived: '보관됨',
};

/**
 * 우선순위 정보
 */
export const ANNOUNCEMENT_PRIORITY_CONFIG: Record<
  AnnouncementPriority,
  {
    label: string;
    color: string;
    bgColor: string;
  }
> = {
  0: {
    label: '일반',
    color: 'text-gray-700 dark:text-gray-300',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
  },
  1: {
    label: '중요',
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  2: {
    label: '긴급',
    color: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
};

/**
 * 우선순위 라벨 맵
 */
export const ANNOUNCEMENT_PRIORITY_LABELS: Record<AnnouncementPriority, string> = {
  0: '일반',
  1: '중요',
  2: '긴급',
};

/**
 * 대상 유형 라벨 맵
 */
export const TARGET_AUDIENCE_LABELS: Record<'all' | 'roles', string> = {
  all: '전체',
  roles: '역할 지정',
};

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * 카테고리 정보 조회
 */
export function getCategoryInfo(
  category: AnnouncementCategory
): AnnouncementCategoryInfo | undefined {
  return ANNOUNCEMENT_CATEGORIES.find((c) => c.key === category);
}

/**
 * 사용자 역할에 해당하는 공지사항인지 확인
 */
export function isAnnouncementForRole(
  announcement: Announcement,
  userRole: UserRole | null
): boolean {
  const { targetAudience } = announcement;

  // 전체 대상이면 true
  if (targetAudience.type === 'all') {
    return true;
  }

  // 역할 지정이면 해당 역할 확인
  if (targetAudience.type === 'roles' && targetAudience.roles && userRole) {
    return targetAudience.roles.includes(userRole);
  }

  return false;
}

/**
 * 공지사항 이미지 배열 조회 (호환성 유지)
 * - images 배열이 있으면 사용
 * - 없으면 기존 imageUrl/imageStoragePath로 변환
 */
export function getAnnouncementImages(announcement: Announcement): AnnouncementImage[] {
  // 새로운 images 배열이 있으면 사용
  if (announcement.images && announcement.images.length > 0) {
    return [...announcement.images].sort((a, b) => a.order - b.order);
  }

  // 기존 단일 이미지가 있으면 배열로 변환
  if (announcement.imageUrl) {
    return [
      {
        id: 'legacy-0',
        url: announcement.imageUrl,
        storagePath: announcement.imageStoragePath ?? '',
        order: 0,
      },
    ];
  }

  return [];
}

/**
 * 공지사항 정렬 (고정 > 우선순위 > 발행일)
 */
export function sortAnnouncements(announcements: Announcement[]): Announcement[] {
  return [...announcements].sort((a, b) => {
    // 1. 고정 공지 우선
    if (a.isPinned !== b.isPinned) {
      return a.isPinned ? -1 : 1;
    }

    // 2. 우선순위 높은 순
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }

    // 3. 발행일 최신순
    const aPublished = a.publishedAt ? toDate(a.publishedAt) : undefined;
    const bPublished = b.publishedAt ? toDate(b.publishedAt) : undefined;
    const aCreated = a.createdAt ? toDate(a.createdAt) : undefined;
    const bCreated = b.createdAt ? toDate(b.createdAt) : undefined;
    const aTime = (aPublished ?? aCreated ?? new Date(0)).getTime();
    const bTime = (bPublished ?? bCreated ?? new Date(0)).getTime();
    return bTime - aTime;
  });
}
