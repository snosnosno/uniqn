/**
 * 계정 삭제/탈퇴 타입 정의
 *
 * @description
 * 계정 삭제 요청 및 처리를 위한 타입 정의
 * - 30일 유예기간 관리
 * - 탈퇴 사유 수집
 *
 * @version 1.0.0
 * @since 2025-01-23
 */

import { Timestamp as FirebaseTimestamp } from 'firebase/firestore';

/**
 * 계정 삭제 상태
 */
export type DeletionStatus = 'pending' | 'cancelled' | 'completed';

/**
 * 탈퇴 사유 카테고리
 */
export type DeletionReasonCategory =
  | 'not_useful' // 서비스가 유용하지 않음
  | 'privacy_concerns' // 개인정보 보호 우려
  | 'switching_service' // 다른 서비스로 전환
  | 'too_many_emails' // 알림이 너무 많음
  | 'difficult_to_use' // 사용이 어려움
  | 'other'; // 기타

/**
 * 계정 삭제 요청 (Firestore: deletionRequests/{requestId})
 */
export interface DeletionRequest {
  requestId: string;
  userId: string;
  userEmail: string;
  userName: string;

  // 삭제 정보
  reason?: string; // 선택 사유
  reasonCategory?: DeletionReasonCategory;
  requestedAt: FirebaseTimestamp | Date;
  scheduledDeletionAt: FirebaseTimestamp | Date; // 30일 후

  // 상태 관리
  status: DeletionStatus;
  cancelledAt?: FirebaseTimestamp | Date;
  completedAt?: FirebaseTimestamp | Date;

  // 보안
  verificationToken?: string; // 취소 링크용 토큰
  ipAddress?: string;
}

/**
 * 계정 삭제 요청 입력
 */
export interface DeletionRequestInput {
  password: string; // 본인 확인용 (필수)
  reason?: string; // 선택 사유
  reasonCategory?: DeletionReasonCategory;
  ipAddress?: string;
}

/**
 * 계정 삭제 취소 입력
 */
export interface DeletionCancellationInput {
  requestId: string;
  verificationToken?: string;
}

/**
 * 삭제 대상 데이터
 */
export interface DeletionTargetData {
  userId: string;
  collections: string[]; // 삭제할 컬렉션 목록
  subcollections: {
    path: string;
    parentId: string;
  }[];
}

/**
 * 삭제 유예기간 (일)
 */
export const DELETION_GRACE_PERIOD_DAYS = 30;

/**
 * 삭제 예정일 계산
 */
export const calculateDeletionDate = (requestDate: Date = new Date()): Date => {
  const deletionDate = new Date(requestDate);
  deletionDate.setDate(deletionDate.getDate() + DELETION_GRACE_PERIOD_DAYS);
  return deletionDate;
};

/**
 * 남은 일수 계산
 */
export const calculateRemainingDays = (deletionDate: Date): number => {
  const now = new Date();
  const diff = deletionDate.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

/**
 * 탈퇴 사유 카테고리 레이블
 */
export const getDeletionReasonLabel = (category: DeletionReasonCategory): string => {
  const labels: Record<DeletionReasonCategory, string> = {
    not_useful: '서비스가 유용하지 않음',
    privacy_concerns: '개인정보 보호 우려',
    switching_service: '다른 서비스로 전환',
    too_many_emails: '알림이 너무 많음',
    difficult_to_use: '사용이 어려움',
    other: '기타',
  };
  return labels[category];
};

/**
 * Firestore 타임스탬프를 Date로 변환
 */
export const convertDeletionTimestamp = (
  timestamp: Date | FirebaseTimestamp
): Date => {
  if (timestamp instanceof Date) {
    return timestamp;
  }
  return timestamp.toDate();
};
