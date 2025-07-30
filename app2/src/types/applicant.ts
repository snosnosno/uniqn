// 지원자 관련 타입 정의
import { Timestamp } from 'firebase/firestore';

export interface Applicant {
  id: string;
  userId: string;
  postingId: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  timeSlot?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  appliedAt: Timestamp | Date;
  reviewedAt?: Timestamp | Date;
  reviewedBy?: string;
  notes?: string;
  experience?: string;
  availability?: string[];
  preferredTime?: string;
  bankName?: string;
  accountNumber?: string;
}