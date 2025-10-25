import { useState, useCallback, useMemo } from 'react';
import { logger } from '../utils/logger';
import { collection, addDoc, query, updateDoc, deleteDoc, doc, getDoc, getDocs, where, writeBatch } from 'firebase/firestore';
import { useCollection } from 'react-firebase-hooks/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from './usePermissions';
import { JobPosting, JobPostingFormData } from '../types/jobPosting';
import { prepareFormDataForFirebase } from '../utils/jobPosting/jobPostingHelpers';
import { validateJobPostingForm } from '../utils/jobPosting/formValidation';
import { createSnapshotFromJobPosting } from '../utils/scheduleSnapshot';
import { ScheduleEvent } from '../types/schedule';

export const useJobPostingOperations = () => {
  const { currentUser } = useAuth();
  const { checkJobPostingPermission, permissions } = usePermissions();
  const navigate = useNavigate();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentPost, setCurrentPost] = useState<JobPosting | null>(null);
  const [isMatching, setIsMatching] = useState<string | null>(null);
  const [deleteConfirmPost, setDeleteConfirmPost] = useState<{ id: string; title: string } | null>(null);

  // Memoized query for better performance
  const jobPostingsQuery = useMemo(() => query(collection(db, 'jobPostings')), []);
  const [jobPostingsSnap, loading, error] = useCollection(jobPostingsQuery);

  // Memoized filtered job postings with permission-based filtering
  const jobPostings = useMemo(() => {
    if (!jobPostingsSnap || !currentUser || !permissions) return [];
    
    const allJobPostings = jobPostingsSnap.docs.map(d => ({ id: d.id, ...d.data() } as JobPosting));
    
    // Admin은 모든 공고를 볼 수 있음
    if (permissions.role === 'admin') {
      return allJobPostings;
    }
    
    // Manager와 Staff는 자신이 작성한 공고만 볼 수 있음
    if (permissions.role === 'manager' || permissions.role === 'staff') {
      return allJobPostings.filter(posting => 
        checkJobPostingPermission('view', posting.createdBy)
      );
    }
    
    return allJobPostings;
  }, [jobPostingsSnap, currentUser, permissions, checkJobPostingPermission]);

  // 공고 생성
  const handleCreateJobPosting = useCallback(async (formData: JobPostingFormData) => {
    if (!currentUser) {
      throw new Error('로그인이 필요합니다.');
    }

    // 폼 유효성 검증
    const validationErrors = validateJobPostingForm(formData);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join('\n'));
    }

    try {
      const dataToSave = {
        ...prepareFormDataForFirebase(formData),
        createdBy: currentUser.uid,
        applicants: []
      };

      const docRef = await addDoc(collection(db, 'jobPostings'), dataToSave);

      // ✅ Firebase Functions (broadcastNewJobPosting)가 자동으로 알림 생성
      // - 트리거: jobPostings onCreate
      // - 조건: status === 'open'
      // - 수신자: 모든 staff 사용자
      logger.info('공고 생성 완료 - Firebase Functions가 알림 전송 예정', {
        data: { eventId: docRef.id }
      });

      return docRef.id;
    } catch (error) {
      logger.error('공고 생성 오류:', error instanceof Error ? error : new Error(String(error)), { component: 'useJobPostingOperations' });
      throw error;
    }
  }, [currentUser]);

  // 공고 수정
  const handleUpdateJobPosting = useCallback(async (postId: string, formData: JobPostingFormData) => {
    if (!currentUser) {
      throw new Error('로그인이 필요합니다.');
    }

    // 폼 유효성 검증
    const validationErrors = validateJobPostingForm(formData);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join('\n'));
    }

    try {
      const dataToUpdate = {
        ...prepareFormDataForFirebase(formData),
        updatedBy: currentUser.uid,
        updatedAt: new Date()
      };

      const postRef = doc(db, 'jobPostings', postId);
      await updateDoc(postRef, dataToUpdate);
      
      setIsEditModalOpen(false);
      setCurrentPost(null);
      
      return true;
    } catch (error) {
      logger.error('공고 수정 오류:', error instanceof Error ? error : new Error(String(error)), { component: 'useJobPostingOperations' });
      throw error;
    }
  }, [currentUser]);

  // 공고 삭제 요청
  const handleDeleteJobPostingClick = useCallback((postId: string, title: string) => {
    setDeleteConfirmPost({ id: postId, title });
  }, []);

  // 공고 삭제 확인 (스냅샷 자동 생성 포함)
  const handleDeleteJobPostingConfirm = useCallback(async () => {
    if (!deleteConfirmPost) return false;

    try {
      const postId = deleteConfirmPost.id;

      // 1. 공고 데이터 조회 (스냅샷 생성용)
      const jobPostingDoc = await getDoc(doc(db, 'jobPostings', postId));
      if (!jobPostingDoc.exists()) {
        logger.warn('삭제할 공고를 찾을 수 없습니다', {
          component: 'useJobPostingOperations',
          data: { postId }
        });
        setDeleteConfirmPost(null);
        return false;
      }

      const jobPosting = { id: jobPostingDoc.id, ...jobPostingDoc.data() } as JobPosting;

      // 2. 관련 Schedule 문서 조회 (applications, workLogs에서 생성된 Schedule)
      // Note: Schedule은 런타임에 생성되는 가상 데이터이므로,
      // 실제로는 applications와 workLogs에 스냅샷을 추가해야 함

      const batch = writeBatch(db);
      let snapshotCount = 0;

      // 2-1. Applications에 스냅샷 추가
      const applicationsQuery = query(
        collection(db, 'applications'),
        where('eventId', '==', postId)
      );
      const applicationsSnap = await getDocs(applicationsQuery);

      applicationsSnap.forEach((appDoc) => {
        const appData = appDoc.data();
        // 스냅샷이 없거나 오래된 경우에만 생성
        if (!appData.snapshotData) {
          const snapshot = createSnapshotFromJobPosting(
            jobPosting,
            appData.role || undefined,
            'posting_deleted'
          );

          batch.update(doc(db, 'applications', appDoc.id), {
            snapshotData: snapshot
          });
          snapshotCount++;
        }
      });

      // 2-2. WorkLogs에 스냅샷 추가
      const workLogsQuery = query(
        collection(db, 'workLogs'),
        where('eventId', '==', postId)
      );
      const workLogsSnap = await getDocs(workLogsQuery);

      workLogsSnap.forEach((workLogDoc) => {
        const workLogData = workLogDoc.data();
        // 스냅샷이 없거나 오래된 경우에만 생성
        if (!workLogData.snapshotData) {
          const snapshot = createSnapshotFromJobPosting(
            jobPosting,
            workLogData.role || undefined,
            'posting_deleted'
          );

          batch.update(doc(db, 'workLogs', workLogDoc.id), {
            snapshotData: snapshot
          });
          snapshotCount++;
        }
      });

      // 3. 스냅샷 일괄 저장
      if (snapshotCount > 0) {
        await batch.commit();
        logger.info('공고 삭제 전 스냅샷 생성 완료', {
          component: 'useJobPostingOperations',
          data: {
            postId,
            snapshotCount,
            applications: applicationsSnap.size,
            workLogs: workLogsSnap.size
          }
        });
      }

      // 4. 공고 삭제
      await deleteDoc(doc(db, 'jobPostings', postId));

      logger.info('공고 삭제 완료', {
        component: 'useJobPostingOperations',
        data: { postId, snapshotCount }
      });

      setDeleteConfirmPost(null);
      return true;
    } catch (error) {
      logger.error('공고 삭제 오류:', error instanceof Error ? error : new Error(String(error)), { component: 'useJobPostingOperations' });
      throw error;
    }
  }, [deleteConfirmPost]);

  // 상세 페이지로 이동
  const handleNavigateToDetail = useCallback((postId: string) => {
    navigate(`/app/admin/job-posting/${postId}`);
  }, [navigate]);

  // 수정 모달 열기
  const openEditModal = useCallback((post: JobPosting) => {
    setCurrentPost(post);
    setIsEditModalOpen(true);
  }, []);

  // 수정 모달 닫기
  const closeEditModal = useCallback(() => {
    setIsEditModalOpen(false);
    setCurrentPost(null);
  }, []);

  // 매칭 상태 설정
  const setMatchingState = useCallback((postId: string | null) => {
    setIsMatching(postId);
  }, []);

  return {
    // 데이터
    jobPostings,
    loading,
    error,
    
    // 상태
    isEditModalOpen,
    currentPost,
    isMatching,
    deleteConfirmPost,

    // CRUD 작업
    handleCreateJobPosting,
    handleUpdateJobPosting,
    handleDeleteJobPostingClick,
    handleDeleteJobPostingConfirm,

    // 네비게이션
    handleNavigateToDetail,

    // 모달 제어
    openEditModal,
    closeEditModal,
    setDeleteConfirmPost,

    // 기타
    setMatchingState,
    setCurrentPost,
  };
};