/**
 * UNIQN Mobile - 신고 서비스
 *
 * @description 스태프 신고 관련 비즈니스 로직
 * @version 1.0.0
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import type {
  Report,
  CreateReportInput,
  ReviewReportInput,
  ReportStatus,
} from '@/types/report';
import { getReportSeverity } from '@/types/report';

// ============================================================================
// Constants
// ============================================================================

const REPORTS_COLLECTION = 'reports';

// ============================================================================
// Create Report
// ============================================================================

/**
 * 신고 생성 (구인자 → 스태프)
 */
export async function createReport(input: CreateReportInput): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('인증이 필요합니다.');
  }

  logger.info('Creating report', {
    type: input.type,
    targetId: input.targetId,
    jobPostingId: input.jobPostingId,
  });

  try {
    // Firestore에서 프로필 조회하여 이름 가져오기
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userProfile = userDoc.exists() ? userDoc.data() : null;
    const reporterName = userProfile?.name || userProfile?.nickname || '익명';

    const reportData = {
      type: input.type,
      reporterId: user.uid,
      reporterName,
      targetId: input.targetId,
      targetName: input.targetName,
      jobPostingId: input.jobPostingId,
      jobPostingTitle: input.jobPostingTitle || '',
      workLogId: input.workLogId,
      workDate: input.workDate,
      description: input.description,
      evidenceUrls: input.evidenceUrls || [],
      status: 'pending' as ReportStatus,
      severity: getReportSeverity(input.type),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, REPORTS_COLLECTION), reportData);

    logger.info('Report created', { reportId: docRef.id });

    return docRef.id;
  } catch (error) {
    logger.error('Failed to create report', error as Error, { input });
    throw error;
  }
}

// ============================================================================
// Get Reports
// ============================================================================

/**
 * 공고별 신고 목록 조회
 */
export async function getReportsByJobPosting(jobPostingId: string): Promise<Report[]> {
  logger.info('Getting reports by job posting', { jobPostingId });

  try {
    const q = query(
      collection(db, REPORTS_COLLECTION),
      where('jobPostingId', '==', jobPostingId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as Report[];
  } catch (error) {
    logger.error('Failed to get reports by job posting', error as Error, { jobPostingId });
    throw error;
  }
}

/**
 * 스태프별 신고 목록 조회
 */
export async function getReportsByStaff(staffId: string): Promise<Report[]> {
  logger.info('Getting reports by staff', { staffId });

  try {
    const q = query(
      collection(db, REPORTS_COLLECTION),
      where('targetId', '==', staffId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as Report[];
  } catch (error) {
    logger.error('Failed to get reports by staff', error as Error, { staffId });
    throw error;
  }
}

/**
 * 내가 신고한 목록 조회
 */
export async function getMyReports(): Promise<Report[]> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('인증이 필요합니다.');
  }

  logger.info('Getting my reports', { userId: user.uid });

  try {
    const q = query(
      collection(db, REPORTS_COLLECTION),
      where('reporterId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as Report[];
  } catch (error) {
    logger.error('Failed to get my reports', error as Error);
    throw error;
  }
}

/**
 * 신고 상세 조회
 */
export async function getReportById(reportId: string): Promise<Report | null> {
  logger.info('Getting report by id', { reportId });

  try {
    const docRef = doc(db, REPORTS_COLLECTION, reportId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data(),
    } as Report;
  } catch (error) {
    logger.error('Failed to get report by id', error as Error, { reportId });
    throw error;
  }
}

// ============================================================================
// Review Report (Admin)
// ============================================================================

/**
 * 신고 처리 (관리자용)
 */
export async function reviewReport(input: ReviewReportInput): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('인증이 필요합니다.');
  }

  logger.info('Reviewing report', { reportId: input.reportId, status: input.status });

  try {
    const docRef = doc(db, REPORTS_COLLECTION, input.reportId);

    await updateDoc(docRef, {
      status: input.status,
      reviewerId: user.uid,
      reviewerNotes: input.reviewerNotes || '',
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    logger.info('Report reviewed', { reportId: input.reportId });
  } catch (error) {
    logger.error('Failed to review report', error as Error, { input });
    throw error;
  }
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * 스태프별 신고 횟수 조회
 */
export async function getReportCountByStaff(staffId: string): Promise<{
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}> {
  logger.info('Getting report count by staff', { staffId });

  try {
    const reports = await getReportsByStaff(staffId);

    return {
      total: reports.length,
      critical: reports.filter((r) => r.severity === 'critical').length,
      high: reports.filter((r) => r.severity === 'high').length,
      medium: reports.filter((r) => r.severity === 'medium').length,
      low: reports.filter((r) => r.severity === 'low').length,
    };
  } catch (error) {
    logger.error('Failed to get report count by staff', error as Error, { staffId });
    throw error;
  }
}

// ============================================================================
// Export
// ============================================================================

export const reportService = {
  createReport,
  getReportsByJobPosting,
  getReportsByStaff,
  getMyReports,
  getReportById,
  reviewReport,
  getReportCountByStaff,
};

export default reportService;
