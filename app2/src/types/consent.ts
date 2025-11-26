/**
 * 동의 관리 시스템 타입 정의
 *
 * @description
 * 사용자 동의 관리를 위한 타입 정의
 * - 필수 동의: 이용약관, 개인정보 처리방침
 * - 선택 동의: 마케팅, 위치 서비스, 푸시 알림
 *
 * @version 1.0.0
 * @since 2025-01-23
 */

import { Timestamp as FirebaseTimestamp } from 'firebase/firestore';

/**
 * 개별 동의 항목
 */
export interface ConsentItem {
  agreed: boolean;
  agreedAt?: FirebaseTimestamp | Date;
  revokedAt?: FirebaseTimestamp | Date;
  version?: string; // 약관 버전 (필수 동의만 사용)
  ipAddress?: string; // 동의 시 IP 주소 (보안용)
}

/**
 * 동의 기록 (Firestore: users/{userId}/consents/current)
 */
export interface ConsentRecord {
  version: string; // 문서 버전 (1.0.0)
  userId: string;

  // 필수 동의
  termsOfService: {
    agreed: true;
    agreedAt: FirebaseTimestamp | Date;
    version: string;
    ipAddress?: string;
  };
  privacyPolicy: {
    agreed: true;
    agreedAt: FirebaseTimestamp | Date;
    version: string;
    ipAddress?: string;
  };

  // 선택 동의
  marketing?: ConsentItem;
  locationService?: ConsentItem;
  pushNotification?: ConsentItem;

  // 메타데이터
  createdAt: FirebaseTimestamp | Date;
  updatedAt: FirebaseTimestamp | Date;
}

/**
 * 동의 변경 이력 (Firestore: users/{userId}/consents/history/{changeId})
 */
export interface ConsentChange {
  id: string;
  timestamp: FirebaseTimestamp | Date;
  changedFields: string[]; // ['marketing', 'locationService']
  previousValues: Record<string, boolean>;
  newValues: Record<string, boolean>;
  ipAddress?: string;
}

/**
 * 동의 생성 입력
 */
export interface ConsentCreateInput {
  userId: string;
  termsOfService: {
    agreed: true; // 필수이므로 true만 허용
    version: string;
    agreedAt?: Date;
    ipAddress?: string;
  };
  privacyPolicy: {
    agreed: true;
    version: string;
    agreedAt?: Date;
    ipAddress?: string;
  };
  marketing?: {
    agreed: boolean;
    agreedAt?: Date;
  };
  locationService?: {
    agreed: boolean;
    agreedAt?: Date;
  };
  pushNotification?: {
    agreed: boolean;
    agreedAt?: Date;
  };
}

/**
 * 동의 업데이트 입력 (선택 동의만 변경 가능)
 */
export interface ConsentUpdateInput {
  marketing?: {
    agreed: boolean;
    agreedAt?: Date;
  };
  locationService?: {
    agreed: boolean;
    agreedAt?: Date;
  };
  pushNotification?: {
    agreed: boolean;
    agreedAt?: Date;
  };
}

/**
 * 약관 버전 정보
 */
export interface ConsentVersion {
  version: string;
  effectiveDate: Date;
  content: {
    ko: string;
    en: string;
  };
}

/**
 * 현재 약관 버전
 */
export const CURRENT_TERMS_VERSION = '1.0';
export const CURRENT_PRIVACY_VERSION = '1.0';

/**
 * Firestore 타임스탬프를 Date로 변환
 */
export const convertConsentTimestamp = (timestamp: Date | FirebaseTimestamp): Date => {
  if (timestamp instanceof Date) {
    return timestamp;
  }
  return timestamp.toDate();
};
