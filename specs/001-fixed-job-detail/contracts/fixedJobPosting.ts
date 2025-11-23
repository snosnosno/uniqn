/**
 * API Contracts: 고정공고 상세보기
 *
 * Phase 4 - 조회수 증가 및 상세보기 데이터 인터페이스
 *
 * @see ../spec.md
 * @see ../data-model.md
 */

import type { WorkSchedule, RequiredRoleWithCount } from '../../../app2/src/types/jobPosting';

/**
 * 조회수 증가 서비스 인터페이스
 *
 * @description
 * 고정공고 조회수를 Firestore increment() 원자적 연산으로 증가시키는 서비스
 *
 * @example
 * ```typescript
 * const service: ViewCountService = {
 *   async incrementViewCount(postingId: string): Promise<void> {
 *     const docRef = doc(db, 'jobPostings', postingId);
 *     await updateDoc(docRef, {
 *       'fixedData.viewCount': increment(1)
 *     });
 *   }
 * };
 * ```
 */
export interface ViewCountService {
  /**
   * 고정공고 조회수 증가
   *
   * @param postingId - 공고 ID
   * @throws 네트워크 오류 시 에러 발생하지만 사용자 경험 방해하지 않음
   * @returns Promise<void> - fire-and-forget 패턴
   *
   * @remarks
   * - Firestore increment() 사용 (동시성 안전)
   * - 에러 발생 시 logger.error로 기록만 하고 사용자 방해 금지
   * - 모달 오픈은 조회수 증가 실패와 무관하게 정상 작동
   */
  incrementViewCount(postingId: string): Promise<void>;
}

/**
 * 상세보기 데이터 인터페이스
 *
 * @description
 * JobDetailModal에 전달되는 고정공고 데이터 구조
 *
 * @example
 * ```typescript
 * const jobDetail: JobDetailData = {
 *   id: 'posting-123',
 *   title: '홀덤 토너먼트 정규직 딜러 모집',
 *   location: '서울',
 *   status: 'active',
 *   workSchedule: {
 *     daysPerWeek: 5,
 *     startTime: '09:00',
 *     endTime: '18:00'
 *   },
 *   requiredRolesWithCount: [
 *     { name: '딜러', count: 3 },
 *     { name: '플로어', count: 2 }
 *   ],
 *   viewCount: 42
 * };
 * ```
 */
export interface JobDetailData {
  /** 공고 ID */
  id: string;

  /** 공고 제목 */
  title: string;

  /** 근무 지역 */
  location: string;

  /** 공고 상태 (active, closed 등) */
  status: string;

  /** 근무 일정 */
  workSchedule: WorkSchedule;

  /** 모집 역할 및 인원 */
  requiredRolesWithCount: RequiredRoleWithCount[];

  /** 조회수 */
  viewCount: number;
}

/**
 * 조회수 증가 에러 타입
 *
 * @description
 * incrementViewCount 실패 시 발생하는 에러 타입
 *
 * @example
 * ```typescript
 * try {
 *   await incrementViewCount(postingId);
 * } catch (error) {
 *   const viewCountError: ViewCountError = {
 *     type: 'network',
 *     message: 'Firestore 연결 실패'
 *   };
 *   logger.error('조회수 증가 실패', viewCountError);
 * }
 * ```
 */
export type ViewCountError =
  | { type: 'network'; message: string }       // 네트워크 오류
  | { type: 'permission'; message: string }    // 권한 오류
  | { type: 'unknown'; message: string };      // 알 수 없는 오류
