// Applicant 관련 타입 정의
import { Timestamp } from 'firebase/firestore';
import { JobPosting } from '../../../types/jobPosting';

export interface Applicant {
  id: string;
  applicantName: string;
  applicantId: string;
  status: 'applied' | 'confirmed' | 'rejected';
  assignedRole?: string;
  assignedTime?: string;
  appliedAt: Timestamp | string | Date;  // any → 구체적 타입으로 수정 (TypeScript strict mode 준수)
  // 추가된 사용자 정보
  gender?: string;
  age?: number;
  experience?: string;
  assignedDate?: string;    // 할당된 날짜 (yyyy-MM-dd 형식)
  email?: string;
  phone?: string;  // ProfilePage와 일치하도록 phone으로 변경
  
  // 다중 선택 지원을 위한 새로운 필드들 (하위 호환성을 위해 선택적)
  assignedRoles?: string[];   // 선택한 역할들
  assignedTimes?: string[];   // 선택한 시간들
  assignedDates?: string[];   // 선택한 날짜들
  
  // 사전질문 답변
  preQuestionAnswers?: Array<{
    questionId: string;
    question: string;
    answer: string;
    required?: boolean;
  }>;
}

export interface ApplicantListTabProps {
  jobPosting?: JobPosting; // any → JobPosting 타입으로 수정 (TypeScript strict mode 준수)
}

export interface Assignment {
  timeSlot: string;
  role: string;
  date: string;
}

export type SelectedAssignments = { [key: string]: Assignment[] };