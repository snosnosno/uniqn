/**
 * 패널티 관련 타입 정의
 *
 * 사용자에게 부여되는 패널티 정보를 정의합니다.
 *
 * @version 1.1
 * @since 2025-01-01
 * @author T-HOLDEM Development Team
 */
import { Timestamp } from 'firebase/firestore';
import { FirebaseDocument } from './common';

/**
 * 패널티 유형
 * @description warning: 경고 배너 표시, loginBlock: 로그인 차단
 */
export type PenaltyType = 'warning' | 'loginBlock';

/**
 * 경고 패널티 기간 타입
 */
export type WarningDuration = '3d' | '7d' | '30d';

/**
 * 로그인 차단 패널티 기간 타입
 */
export type LoginBlockDuration = '1d' | '3d' | '7d' | '30d' | '90d' | 'permanent';

/**
 * 패널티 기간 타입 (통합)
 * @description 패널티 지속 기간을 나타내는 문자열 리터럴 타입
 */
export type PenaltyDuration = WarningDuration | LoginBlockDuration;

/**
 * 패널티 상태 타입
 * @description 패널티의 현재 상태
 */
export type PenaltyStatus = 'active' | 'expired' | 'cancelled';

/**
 * 패널티 레코드 인터페이스
 * @description Firestore에 저장되는 패널티 문서 구조
 */
export interface Penalty extends FirebaseDocument {
  /** 대상 사용자 ID */
  userId: string;

  /** 패널티 유형 */
  type: PenaltyType;

  /** 패널티 사유 (직접 입력) */
  reason: string;

  /** 상세 내용 (직접 입력, 선택) */
  details?: string;

  /** 패널티 기간 */
  duration: PenaltyDuration;

  /** 패널티 시작일 */
  startDate: Timestamp;

  /** 패널티 종료일 (permanent인 경우 null) */
  endDate: Timestamp | null;

  /** 패널티 상태 */
  status: PenaltyStatus;

  /** 패널티 부여자 ID */
  createdBy: string;

  /** 취소 사유 (cancelled 상태인 경우) */
  cancelReason?: string;

  /** 취소자 ID */
  cancelledBy?: string;

  /** 취소 일시 */
  cancelledAt?: Timestamp;
}

/**
 * 패널티 생성 입력 인터페이스
 * @description 새 패널티 생성 시 필요한 데이터
 */
export interface PenaltyCreateInput {
  userId: string;
  type: PenaltyType;
  reason: string;
  details?: string;
  duration: PenaltyDuration;
}

/**
 * 기간별 일수 매핑
 * @description 각 기간 코드에 해당하는 일수 (영구는 null)
 */
export const PENALTY_DURATION_DAYS: Record<PenaltyDuration, number | null> = {
  '1d': 1,
  '3d': 3,
  '7d': 7,
  '30d': 30,
  '90d': 90,
  permanent: null,
};

/**
 * 기간 표시용 옵션 배열 (기존 호환)
 * @description UI 셀렉트 박스에서 사용
 */
export const PENALTY_DURATION_OPTIONS: Array<{
  value: PenaltyDuration;
  labelKey: string;
}> = [
  { value: '1d', labelKey: 'penalty.duration.1day' },
  { value: '3d', labelKey: 'penalty.duration.3days' },
  { value: '7d', labelKey: 'penalty.duration.7days' },
  { value: '30d', labelKey: 'penalty.duration.30days' },
  { value: '90d', labelKey: 'penalty.duration.90days' },
  { value: 'permanent', labelKey: 'penalty.duration.permanent' },
];

/**
 * 경고 패널티 기간 옵션
 * @description 경고 유형 선택 시 표시되는 기간 옵션
 */
export const WARNING_DURATION_OPTIONS: Array<{
  value: WarningDuration;
  labelKey: string;
}> = [
  { value: '3d', labelKey: 'penalty.duration.3days' },
  { value: '7d', labelKey: 'penalty.duration.7days' },
  { value: '30d', labelKey: 'penalty.duration.30days' },
];

/**
 * 로그인 차단 패널티 기간 옵션
 * @description 로그인 차단 유형 선택 시 표시되는 기간 옵션
 */
export const LOGIN_BLOCK_DURATION_OPTIONS: Array<{
  value: LoginBlockDuration;
  labelKey: string;
}> = [
  { value: '1d', labelKey: 'penalty.duration.1day' },
  { value: '3d', labelKey: 'penalty.duration.3days' },
  { value: '7d', labelKey: 'penalty.duration.7days' },
  { value: '30d', labelKey: 'penalty.duration.30days' },
  { value: '90d', labelKey: 'penalty.duration.90days' },
  { value: 'permanent', labelKey: 'penalty.duration.permanent' },
];
