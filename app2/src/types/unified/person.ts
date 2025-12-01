import { Timestamp } from 'firebase/firestore';

/**
 * 통합된 Person 인터페이스
 * staff와 applicants를 하나의 컬렉션으로 통합
 * 기존 구조를 최대한 유지하면서 중복만 제거
 */
export interface Person {
  // 기본 식별 정보
  id: string;
  name: string;
  phone: string;
  email?: string;

  // 타입 구분 (staff 또는 applicant)
  type: 'staff' | 'applicant' | 'both'; // both는 스태프이면서 다른 공고에 지원자인 경우

  // ========== 기존 staff 필드들 ==========
  // 역할 및 근무 정보
  role?: string; // 기본 역할 (딜러, 매니저 등)
  assignedTime?: string; // 기본 배정 시간
  assignedDate?: string; // 기본 배정 날짜

  // 은행 정보
  bankName?: string;
  accountNumber?: string;

  // 상태 정보
  status?: string; // active, inactive 등
  isActive?: boolean;

  // 기타 staff 필드
  department?: string;
  position?: string;
  joinDate?: Timestamp | Date | string;

  // ========== 기존 applicant 필드들 ==========
  // 지원 관련 정보
  availableRoles?: string[]; // 지원 가능한 역할들
  availableDates?: string[]; // 지원 가능한 날짜들
  availableTimes?: string[]; // 지원 가능한 시간대들

  // 지원 이력
  applicationHistory?: string[]; // 지원한 공고 ID 목록
  applicationCount?: number; // 총 지원 횟수

  // 경력 및 자격
  experience?: string; // 경력 설명
  certifications?: string[]; // 보유 자격증
  skills?: string[]; // 보유 기술

  // ========== 공통 메타데이터 ==========
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string; // 생성한 사용자 ID
  updatedBy?: string; // 마지막 수정한 사용자 ID

  // 추가 정보 (확장 가능)
  metadata?: {
    [key: string]: unknown;
  };
}

/**
 * Staff 타입 (하위 호환성을 위한 타입 별칭)
 * 기존 코드에서 Staff 타입을 사용하는 곳을 위해 유지
 */
export type Staff = Person & {
  type: 'staff';
};

/**
 * Applicant 타입 (하위 호환성을 위한 타입 별칭)
 * 기존 코드에서 Applicant 타입을 사용하는 곳을 위해 유지
 */
export type Applicant = Person & {
  type: 'applicant';
};

/**
 * Person 생성을 위한 입력 타입
 * 필수 필드만 요구하고 나머지는 선택적
 */
export interface PersonCreateInput {
  name: string;
  phone: string;
  type: 'staff' | 'applicant' | 'both';
  email?: string;
  role?: string;
  bankName?: string;
  accountNumber?: string;
  availableRoles?: string[];
  metadata?: Record<string, any>;
}

/**
 * Person 업데이트를 위한 입력 타입
 * 모든 필드가 선택적
 */
export interface PersonUpdateInput {
  name?: string;
  phone?: string;
  email?: string;
  type?: 'staff' | 'applicant' | 'both';
  role?: string;
  assignedTime?: string;
  assignedDate?: string;
  bankName?: string;
  accountNumber?: string;
  status?: string;
  isActive?: boolean;
  availableRoles?: string[];
  availableDates?: string[];
  availableTimes?: string[];
  metadata?: Record<string, any>;
}

/**
 * 타입 가드 함수들
 */
export function isStaff(person: Person): person is Staff {
  return person.type === 'staff' || person.type === 'both';
}

export function isApplicant(person: Person): person is Applicant {
  return person.type === 'applicant' || person.type === 'both';
}

export function isBoth(person: Person): boolean {
  return person.type === 'both';
}

/**
 * Person 객체를 Staff로 변환 (하위 호환성)
 */
export function personToStaff(person: Person): Staff | null {
  if (!isStaff(person)) return null;
  return person as Staff;
}

/**
 * Person 객체를 Applicant로 변환 (하위 호환성)
 */
export function personToApplicant(person: Person): Applicant | null {
  if (!isApplicant(person)) return null;
  return person as Applicant;
}

/**
 * 기존 staffId/applicantId를 personId로 통합
 * 하위 호환성을 위한 헬퍼 함수
 */
export function getPersonId(entity: {
  id?: string;
  staffId?: string;
  applicantId?: string;
  personId?: string;
}): string | undefined {
  return entity.personId || entity.staffId || entity.applicantId || entity.id;
}
