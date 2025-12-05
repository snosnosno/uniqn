import { useState, useCallback, useMemo } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  type Query,
  type DocumentData,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { JobPosting } from '../types/jobPosting/jobPosting';
import { logger } from '../utils/logger';
import { toast } from '../utils/toast';
import { useFirestoreQuery } from './firestore';
import { useAuth } from '../contexts/AuthContext';
import i18n from '../i18n/config';

/**
 * 대회 공고 승인 시스템 Hook
 * admin 전용 - 승인 대기 중인 대회 공고 조회 및 승인/거부 처리
 * 업주용 - 거부된 공고 재제출
 */
export const useJobPostingApproval = () => {
  const [processing, setProcessing] = useState(false);
  const { currentUser } = useAuth();

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
        data: { count: pendingPostingsData.length },
      });
    },
    onError: (err) => {
      logger.error('승인 대기 공고 조회 실패', err, {
        component: 'useJobPostingApproval',
      });
    },
  });

  // useFirestoreQuery가 id를 추가하므로 JobPosting 타입으로 직접 변환 가능
  const pendingPostings = useMemo(
    (): JobPosting[] => pendingPostingsData as JobPosting[],
    [pendingPostingsData]
  );

  /**
   * 대회 공고 승인
   */
  const approve = useCallback(async (postingId: string) => {
    if (!postingId) {
      toast.error(i18n.t('toast.jobPosting.idRequired'));
      return;
    }

    setProcessing(true);

    try {
      const approveFunction = httpsCallable(functions, 'approveJobPosting');
      await approveFunction({ postingId });

      toast.success(i18n.t('toast.jobPosting.approveSuccess'));
      logger.info('공고 승인 완료');
    } catch (err: unknown) {
      logger.error('공고 승인 실패', err instanceof Error ? err : new Error(String(err)));

      // Firebase Functions 에러 처리
      const errorCode = (err as { code?: string }).code;
      if (errorCode === 'permission-denied') {
        toast.error(i18n.t('toast.jobPosting.adminRequired'));
      } else if (errorCode === 'not-found') {
        toast.error(i18n.t('toast.jobPosting.notFound'));
      } else if (errorCode === 'failed-precondition') {
        toast.error(i18n.t('toast.jobPosting.alreadyProcessed'));
      } else if (errorCode === 'invalid-argument') {
        toast.error(i18n.t('toast.jobPosting.onlyTournamentCanApprove'));
      } else {
        toast.error(i18n.t('toast.jobPosting.approveError'));
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
      toast.error(i18n.t('toast.jobPosting.idRequired'));
      return;
    }

    if (!reason || reason.trim().length < 10) {
      toast.error(i18n.t('toast.jobPosting.rejectReasonMinLength'));
      return;
    }

    setProcessing(true);

    try {
      const rejectFunction = httpsCallable(functions, 'rejectJobPosting');
      await rejectFunction({ postingId, reason: reason.trim() });

      toast.success(i18n.t('toast.jobPosting.rejectSuccess'));
      logger.info('공고 거부 완료');
    } catch (err: unknown) {
      logger.error('공고 거부 실패', err instanceof Error ? err : new Error(String(err)));

      // Firebase Functions 에러 처리
      const errorCode = (err as { code?: string }).code;
      const errorMessage = (err as { message?: string }).message;
      if (errorCode === 'permission-denied') {
        toast.error(i18n.t('toast.jobPosting.adminRequired'));
      } else if (errorCode === 'not-found') {
        toast.error(i18n.t('toast.jobPosting.notFound'));
      } else if (errorCode === 'invalid-argument') {
        if (errorMessage?.includes('거부 사유')) {
          toast.error(i18n.t('toast.jobPosting.rejectReasonMinLength'));
        } else {
          toast.error(i18n.t('toast.jobPosting.onlyTournamentCanReject'));
        }
      } else {
        toast.error(i18n.t('toast.jobPosting.rejectError'));
      }

      throw err;
    } finally {
      setProcessing(false);
    }
  }, []);

  /**
   * 거부된 대회 공고 재제출
   * 업주(공고 작성자)만 자신의 거부된 공고를 재제출할 수 있음
   * Firebase Function을 통해 Security Rules를 우회하여 처리
   */
  const resubmit = useCallback(
    async (postingId: string) => {
      if (!postingId) {
        toast.error(i18n.t('toast.jobPosting.idRequired'));
        return;
      }

      if (!currentUser) {
        toast.error(i18n.t('toast.auth.loginRequired'));
        return;
      }

      setProcessing(true);

      try {
        const resubmitFunction = httpsCallable(functions, 'resubmitJobPosting');
        await resubmitFunction({ postingId });

        toast.success(i18n.t('toast.jobPosting.resubmitSuccess'));
        logger.info('공고 재제출 완료', {
          component: 'useJobPostingApproval',
          data: { postingId },
        });
      } catch (err: unknown) {
        logger.error('공고 재제출 실패', err instanceof Error ? err : new Error(String(err)), {
          component: 'useJobPostingApproval',
          data: { postingId },
        });

        // Firebase Functions 에러 처리
        const errorCode = (err as { code?: string }).code;
        if (errorCode === 'permission-denied') {
          toast.error(i18n.t('toast.jobPosting.notOwner'));
        } else if (errorCode === 'not-found') {
          toast.error(i18n.t('toast.jobPosting.notFound'));
        } else if (errorCode === 'failed-precondition') {
          toast.error(i18n.t('toast.jobPosting.onlyRejectedCanResubmit'));
        } else if (errorCode === 'invalid-argument') {
          toast.error(i18n.t('toast.jobPosting.onlyTournamentCanResubmit'));
        } else {
          toast.error(i18n.t('toast.jobPosting.resubmitError'));
        }

        throw err;
      } finally {
        setProcessing(false);
      }
    },
    [currentUser]
  );

  return {
    pendingPostings,
    loading,
    error,
    processing,
    approve,
    reject,
    resubmit,
  };
};
