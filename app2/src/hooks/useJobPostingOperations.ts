import { useState, useCallback, useMemo } from 'react';
import { collection, addDoc, query, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { useCollection } from 'react-firebase-hooks/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { prepareFormDataForFirebase, prepareFirebaseDataForForm } from '../utils/jobPosting/jobPostingHelpers';
import { validateJobPostingForm } from '../utils/jobPosting/formValidation';

export const useJobPostingOperations = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentPost, setCurrentPost] = useState<any>(null);
  const [isMatching, setIsMatching] = useState<string | null>(null);

  // Memoized query for better performance
  const jobPostingsQuery = useMemo(() => query(collection(db, 'jobPostings')), []);
  const [jobPostingsSnap, loading, error] = useCollection(jobPostingsQuery);

  // Memoized filtered job postings for better performance
  const jobPostings = useMemo(() => 
    jobPostingsSnap?.docs.map(d => ({ id: d.id, ...d.data() })) || [],
    [jobPostingsSnap]
  );

  // 공고 생성
  const handleCreateJobPosting = useCallback(async (formData: any) => {
    if (!currentUser) {
      throw new Error('로그인이 필요합니다.');
    }

    // 폼 유효성 검증
    const validationErrors = validateJobPostingForm(formData);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join('\n'));
    }

    try {
      const dataToSave = prepareFormDataForFirebase({
        ...formData,
        createdBy: currentUser.uid,
        applicants: []
      });

      const docRef = await addDoc(collection(db, 'jobPostings'), dataToSave);
      return docRef.id;
    } catch (error) {
      console.error('공고 생성 오류:', error);
      throw error;
    }
  }, [currentUser]);

  // 공고 수정
  const handleUpdateJobPosting = useCallback(async (postId: string, formData: any) => {
    if (!currentUser) {
      throw new Error('로그인이 필요합니다.');
    }

    // 폼 유효성 검증
    const validationErrors = validateJobPostingForm(formData);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join('\n'));
    }

    try {
      const dataToUpdate = prepareFormDataForFirebase({
        ...formData,
        updatedBy: currentUser.uid,
        updatedAt: new Date()
      });

      const postRef = doc(db, 'jobPostings', postId);
      await updateDoc(postRef, dataToUpdate);
      
      setIsEditModalOpen(false);
      setCurrentPost(null);
      
      return true;
    } catch (error) {
      console.error('공고 수정 오류:', error);
      throw error;
    }
  }, [currentUser]);

  // 공고 삭제
  const handleDeleteJobPosting = useCallback(async (postId: string, title: string) => {
    if (!window.confirm(`"${title}" 공고를 삭제하시겠습니까?`)) {
      return false;
    }

    try {
      await deleteDoc(doc(db, 'jobPostings', postId));
      return true;
    } catch (error) {
      console.error('공고 삭제 오류:', error);
      throw error;
    }
  }, []);

  // 상세 페이지로 이동
  const handleNavigateToDetail = useCallback((postId: string) => {
    navigate(`/admin/job-posting/${postId}`);
  }, [navigate]);

  // 수정 모달 열기
  const openEditModal = useCallback((post: any) => {
    const formData = prepareFirebaseDataForForm(post);
    setCurrentPost({ ...post, ...formData });
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

    // CRUD 작업
    handleCreateJobPosting,
    handleUpdateJobPosting,
    handleDeleteJobPosting,
    
    // 네비게이션
    handleNavigateToDetail,
    
    // 모달 제어
    openEditModal,
    closeEditModal,
    
    // 기타
    setMatchingState,
    setCurrentPost,
  };
};