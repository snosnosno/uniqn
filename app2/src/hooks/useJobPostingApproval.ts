import { useState, useCallback, useMemo } from 'react';
import { collection, query, where, orderBy, type Query, type DocumentData } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { JobPosting } from '../types/jobPosting/jobPosting';
import { logger } from '../utils/logger';
import { toast } from '../utils/toast';
import { useFirestoreQuery } from './firestore';

/**
 * 대회 공고 승인 시스템 Hook
 * admin 전용 - 승인 대기 중인 대회 공고 조회 및 승인/거부 처리
 */
export const useJobPostingApproval = () => {
  const [processing, setProcessing] = useState(false);

  // 승인 대기 중인 대회 공고 쿼리 생성
  const pendingQuery = useMemo((): Query<DocumentData> => {
    return query(
      collection(db, 'jobPostings'),
      where('postingType', '==', 'tournament'),
      where('tournamentConfig.approvalStatus', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
  }, []);

  // useFirestoreQuery로 구독
  type JobPostingData = Omit<JobPosting, 'id'>;

  const {
    data: pendingPostingsData,
    loading,
    error,
  } = useFirestoreQuery<JobPostingData>(pendingQuery, {
    onSuccess: () => {
      logger.info('승인 대기 공고 조회 완료', {
        component: 'useJobPostingApproval',
        data: { count: pendingPostingsData.length }
      });
    },
    onError: (err) => {
      logger.error('승인 대기 공고 조회 실패', err, {
        component: 'useJobPostingApproval'
      });
    },
  });

  // JobPosting 타입으로 변환
  const pendingPostings = useMemo(() => {
    return pendingPostingsData.map((doc) => doc as unknown as JobPosting);
  }, [pendingPostingsData]);

  /**
   * 대회 공고 승인
   */
  const approve = useCallback(async (postingId: string) => {
    if (!postingId) {
      toast.error('공고 ID가 필요합니다');
      return;
    }

    setProcessing(true);

    try {
      const approveFunction = httpsCallable(functions, 'approveJobPosting');
      await approveFunction({ postingId });

      toast.success('공고가 승인되었습니다');
      logger.info('공고 승인 완료');
    } catch (err: any) {
      logger.error('공고 승인 실패', err instanceof Error ? err : new Error(String(err)));

      // Firebase Functions 에러 처리
      if (err.code === 'permission-denied') {
        toast.error('Admin 권한이 필요합니다');
      } else if (err.code === 'not-found') {
        toast.error('공고를 찾을 수 없습니다');
      } else if (err.code === 'failed-precondition') {
        toast.error('이미 승인/거부된 공고입니다');
      } else if (err.code === 'invalid-argument') {
        toast.error('대회 공고만 승인 가능합니다');
      } else {
        toast.error('공고 승인 중 오류가 발생했습니다');
      }

      throw err;
    } finally {
      setProcessing(false);
    }
  }, []);

  /**
   * 대회 공고 거부
   */
  const reject = useCallback(async (postingId: string, reason: string) => {
    if (!postingId) {
      toast.error('공고 ID가 필요합니다');
      return;
    }

    if (!reason || reason.trim().length < 10) {
      toast.error('거부 사유는 최소 10자 이상이어야 합니다');
      return;
    }

    setProcessing(true);

    try {
      const rejectFunction = httpsCallable(functions, 'rejectJobPosting');
      await rejectFunction({ postingId, reason: reason.trim() });

      toast.success('공고가 거부되었습니다');
      logger.info('공고 거부 완료');
    } catch (err: any) {
      logger.error('공고 거부 실패', err instanceof Error ? err : new Error(String(err)));

      // Firebase Functions 에러 처리
      if (err.code === 'permission-denied') {
        toast.error('Admin 권한이 필요합니다');
      } else if (err.code === 'not-found') {
        toast.error('공고를 찾을 수 없습니다');
      } else if (err.code === 'invalid-argument') {
        if (err.message.includes('거부 사유')) {
          toast.error('거부 사유는 최소 10자 이상이어야 합니다');
        } else {
          toast.error('대회 공고만 거부 가능합니다');
        }
      } else {
        toast.error('공고 거부 중 오류가 발생했습니다');
      }

      throw err;
    } finally {
      setProcessing(false);
    }
  }, []);

  return {
    pendingPostings,
    loading,
    error,
    processing,
    approve,
    reject
  };
};
