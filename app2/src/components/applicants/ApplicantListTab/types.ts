// Applicant 관련 타입 정의
import { Timestamp } from 'firebase/firestore';
import { JobPosting } from '@/types/jobPosting';
import { ApplicationGroup, ApplicationAssignment, DateBasedAssignment } from '@/types/unifiedData';
import { Assignment } from '@/types/application';

export interface Applicant {
  id: string;
  applicantName: string;
  applicantId: string;
  status: 'applied' | 'confirmed' | 'cancelled';
  assignedRole?: string;
  assignedTime?: string;
  appliedAt: Timestamp | string | Date;  // any → 구체적 타입으로 수정 (TypeScript strict mode 준수)
  // 추가된 사용자 정보
  gender?: string;
  age?: number;
  experience?: string;
  region?: string;          // 지역 정보
  assignedDate?: string;    // 할당된 날짜 (yyyy-MM-dd 형식)
  email?: string;
  phone?: string;  // ProfilePage와 일치하도록 phone으로 변경
  
  // 다중 선택 지원을 위한 새로운 필드들 (하위 호환성을 위해 선택적)
  assignedRoles?: string[];   // 선택한 역할들
  assignedTimes?: string[];   // 선택한 시간들
  assignedDates?: string[];   // 선택한 날짜들
  assignedDurations?: Array<{  // 각 선택에 대한 duration 정보
    type: 'single' | 'multi';
    endDate?: string;
  } | null>;
  
  // 🚀 최신 메인 필드 - 날짜 기반 구조 (최우선)
  dateAssignments?: DateBasedAssignment[];
  
  // 🆕 기존 메인 필드 - 그룹 중심 assignments 구조 (마이그레이션 기간)
  assignments?: ApplicationAssignment[];
  
  // 🔧 Legacy 그룹 기반 필드 - 연속된 날짜 그룹 정보 보존 (deprecated)
  assignedGroups?: ApplicationGroup[];
  
  // 사전질문 답변
  preQuestionAnswers?: Array<{
    questionId: string;
    question: string;
    answer: string;
    required?: boolean;
  }>;
  
  // 추가 필드들
  eventId?: string;  // 구인공고 ID
  notes?: string;    // 메모
}

export interface ApplicantListTabProps {
  jobPosting?: JobPosting; // any → JobPosting 타입으로 수정 (TypeScript strict mode 준수)
}

// Assignment 타입은 통합된 types/application.ts에서 import함 (중복 제거)
export type { Assignment } from '@/types/application';

export type SelectedAssignments = { [key: string]: Assignment[] };