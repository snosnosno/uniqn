/**
 * 시간 정규화 타입 정의
 *
 * @description Phase 3 - 시간 필드 정규화
 * checkInTime/checkOutTime 시간 필드를 통일된 인터페이스로 정규화
 */

import type { Timestamp } from 'firebase/firestore';

/**
 * 정규화된 근무 시간
 *
 * @description 다양한 시간 필드 형식을 통일된 Date 타입으로 정규화
 */
export interface NormalizedWorkTime {
  /** 예정 출근 시간 */
  scheduledStart: Date | null;
  /** 예정 퇴근 시간 */
  scheduledEnd: Date | null;
  /** 실제 출근 시간 (checkInTime) */
  actualStart: Date | null;
  /** 실제 퇴근 시간 (checkOutTime) */
  actualEnd: Date | null;
  /** 예상 금액 여부 (실제 시간이 없어서 예정 시간 사용 시 true) */
  isEstimate: boolean;
}

/**
 * 시간 필드를 가진 객체 인터페이스
 *
 * @description TimeNormalizer.normalize()에 전달할 수 있는 객체 타입
 * WorkLog, ConfirmedStaff 등 다양한 시간 필드 조합 지원
 */
export interface TimeFieldsInput {
  /** 실제 출근 시간 (QR 스캔 또는 관리자 수정) */
  checkInTime?: Timestamp | Date | string | null;
  /** 실제 퇴근 시간 (QR 스캔 또는 관리자 수정) */
  checkOutTime?: Timestamp | Date | string | null;

  // 예정 시간
  /** 예정 출근 시간 */
  scheduledStartTime?: Timestamp | Date | string | null;
  /** 예정 퇴근 시간 */
  scheduledEndTime?: Timestamp | Date | string | null;
}
