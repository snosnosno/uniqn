/**
 * UNIQN Mobile - Firebase Confirmed Staff Repository
 *
 * @description Firebase Firestore 湲곕컲 Confirmed Staff Repository 援ы쁽
 * @version 1.0.0
 *
 * 梨낆엫:
 * 1. Firebase 荑쇰━/?몃옖??뀡 ?ㅽ뻾
 * 2. 硫??而щ젆???몃옖??뀡 (WorkLog + Application + JobPosting)
 * 3. ?ㅼ떆媛?援щ룆 愿由? *
 * 媛쒖꽑?ы빆:
 * - 以묐났 荑쇰━ ?⑦꽩 ?듯빀
 * - ?몃옖??뀡 濡쒖쭅 罹≪뒓?? */

import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  increment,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { BusinessError, ERROR_CODES, toError, isAppError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { parseWorkLogDocument, parseWorkLogDocuments } from '@/schemas';
import type { WorkLog, RoleChangeHistory } from '@/types';
import {
  buildLegacyTimeModification,
  writeTimeModificationLog,
} from './workLog/timeModificationLogs';
import type {
  IConfirmedStaffRepository,
  DeleteConfirmedStaffContext,
} from '../interfaces/IConfirmedStaffRepository';
import type {
  UpdateRoleContext,
  UpdateConfirmedStaffWorkTimeContext,
  MarkNoShowContext,
  UpdateStaffStatusContext,
  ConfirmedStaffSubscriptionCallbacks,
} from '../interfaces';
import { COLLECTIONS, FIELDS, STATUS } from '@/constants';

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Firebase Confirmed Staff Repository
 */
export class FirebaseConfirmedStaffRepository implements IConfirmedStaffRepository {
  // ==========================================================================
  // Read Operations
  // ==========================================================================

  async getByJobPostingId(jobPostingId: string): Promise<WorkLog[]> {
    try {
      logger.info('怨듦퀬蹂??뺤젙 ?ㅽ깭??WorkLog 議고쉶', { jobPostingId });

      const workLogsRef = collection(getFirebaseDb(), COLLECTIONS.WORK_LOGS);
      const q = query(
        workLogsRef,
        where(FIELDS.WORK_LOG.jobPostingId, '==', jobPostingId),
        orderBy(FIELDS.WORK_LOG.date, 'asc')
      );
      const snapshot = await getDocs(q);

      const workLogs = parseWorkLogDocuments(
        snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Record<string, unknown>),
        }))
      );

      logger.info('怨듦퀬蹂??뺤젙 ?ㅽ깭??議고쉶 ?꾨즺', {
        jobPostingId,
        count: workLogs.length,
      });

      return workLogs;
    } catch (error) {
      throw handleServiceError(error, {
        operation: '怨듦퀬蹂??뺤젙 ?ㅽ깭??議고쉶',
        component: 'ConfirmedStaffRepository',
        context: { jobPostingId },
      });
    }
  }

  async getByJobPostingAndDate(jobPostingId: string, date: string): Promise<WorkLog[]> {
    try {
      logger.info('?좎쭨蹂??뺤젙 ?ㅽ깭??WorkLog 議고쉶', { jobPostingId, date });

      const workLogsRef = collection(getFirebaseDb(), COLLECTIONS.WORK_LOGS);
      const q = query(
        workLogsRef,
        where(FIELDS.WORK_LOG.jobPostingId, '==', jobPostingId),
        where(FIELDS.WORK_LOG.date, '==', date)
      );
      const snapshot = await getDocs(q);

      const workLogs = parseWorkLogDocuments(
        snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Record<string, unknown>),
        }))
      );

      return workLogs;
    } catch (error) {
      throw handleServiceError(error, {
        operation: '?좎쭨蹂??뺤젙 ?ㅽ깭??議고쉶',
        component: 'ConfirmedStaffRepository',
        context: { jobPostingId, date },
      });
    }
  }

  // ==========================================================================
  // Write Operations (Transactions)
  // ==========================================================================

  async updateRoleWithTransaction(context: UpdateRoleContext): Promise<void> {
    try {
      logger.info('?ㅽ깭????븷 蹂寃??몃옖??뀡 ?쒖옉', { workLogId: context.workLogId });

      const workLogRef = doc(getFirebaseDb(), COLLECTIONS.WORK_LOGS, context.workLogId);

      await runTransaction(getFirebaseDb(), async (transaction) => {
        const workLogDoc = await transaction.get(workLogRef);

        if (!workLogDoc.exists()) {
          throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
            userMessage: '洹쇰Т 湲곕줉??李얠쓣 ???놁뒿?덈떎',
          });
        }

        const workLog = parseWorkLogDocument({
          id: workLogDoc.id,
          ...(workLogDoc.data() as Record<string, unknown>),
        });
        if (!workLog) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '洹쇰Т 湲곕줉 ?곗씠?곌? ?щ컮瑜댁? ?딆뒿?덈떎',
          });
        }

        const previousRole = workLog.role;

        // ??븷 蹂寃??대젰 ???
        const roleChangeHistory: RoleChangeHistory[] = workLog.roleChangeHistory || [];
        roleChangeHistory.push({
          previousRole,
          newRole: context.newRole,
          reason: context.reason,
          changedBy: context.changedBy,
          changedAt: Timestamp.now(),
        });

        // ?쒖? ??븷 vs 而ㅼ뒪? ??븷 泥섎━
        const roleUpdate = context.isStandardRole
          ? { role: context.newRole, customRole: null }
          : { role: 'other', customRole: context.newRole };

        transaction.update(workLogRef, {
          ...roleUpdate,
          roleChangeHistory,
          updatedAt: serverTimestamp(),
        });
      });

      logger.info('?ㅽ깭????븷 蹂寃??꾨즺', { workLogId: context.workLogId });
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      throw handleServiceError(error, {
        operation: '?ㅽ깭????븷 蹂寃?',
        component: 'ConfirmedStaffRepository',
        context: { workLogId: context.workLogId },
      });
    }
  }

  async updateWorkTimeWithTransaction(context: UpdateConfirmedStaffWorkTimeContext): Promise<void> {
    try {
      logger.info('洹쇰Т ?쒓컙 ?섏젙 ?몃옖??뀡 ?쒖옉', {
        workLogId: context.workLogId,
        checkInTime: context.checkInTime?.toISOString() ?? '誘몄젙',
        checkOutTime: context.checkOutTime?.toISOString() ?? '誘몄젙',
      });

      const workLogRef = doc(getFirebaseDb(), COLLECTIONS.WORK_LOGS, context.workLogId);

      await runTransaction(getFirebaseDb(), async (transaction) => {
        const workLogDoc = await transaction.get(workLogRef);

        if (!workLogDoc.exists()) {
          throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
            userMessage: '洹쇰Т 湲곕줉??李얠쓣 ???놁뒿?덈떎',
          });
        }

        const workLog = parseWorkLogDocument({
          id: workLogDoc.id,
          ...(workLogDoc.data() as Record<string, unknown>),
        });
        if (!workLog) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '洹쇰Т 湲곕줉 ?곗씠?곌? ?щ컮瑜댁? ?딆뒿?덈떎',
          });
        }

        // ?쒓컙 ?섏젙 ?대젰 ???
        const modificationHistory = workLog.modificationHistory || [];
        const prevCheckIn = workLog.checkInTime ?? null;
        const prevCheckOut = workLog.checkOutTime ?? null;

        modificationHistory.push(
          buildLegacyTimeModification({
            previousStartTime: prevCheckIn,
            previousEndTime: prevCheckOut,
            newStartTime: context.checkInTime ? Timestamp.fromDate(context.checkInTime) : null,
            newEndTime: context.checkOutTime ? Timestamp.fromDate(context.checkOutTime) : null,
            reason: context.reason,
            modifiedBy: context.modifiedBy,
          })
        );

        // ?낅뜲?댄듃 ?곗씠??援ъ꽦 (scheduledStartTime/scheduledEndTime? checkInTime??以묐났?대?濡??쒓굅)
        const updateData: Record<string, unknown> = {
          checkInTime: context.checkInTime ? Timestamp.fromDate(context.checkInTime) : null,
          checkOutTime: context.checkOutTime ? Timestamp.fromDate(context.checkOutTime) : null,
          modificationHistory,
          updatedAt: serverTimestamp(),
        };

        // ?쒓컙???곕Ⅸ ?곹깭 蹂寃?
        if (context.checkOutTime) {
          updateData.status = STATUS.WORK_LOG.CHECKED_OUT;
        } else if (!context.checkInTime) {
          updateData.status = STATUS.WORK_LOG.SCHEDULED;
        }

        writeTimeModificationLog(transaction, context.workLogId, {
          previousStartTime: prevCheckIn,
          previousEndTime: prevCheckOut,
          newStartTime: context.checkInTime ? Timestamp.fromDate(context.checkInTime) : null,
          newEndTime: context.checkOutTime ? Timestamp.fromDate(context.checkOutTime) : null,
          reason: context.reason,
          modifiedBy: context.modifiedBy,
        });

        transaction.update(workLogRef, updateData);
      });

      logger.info('洹쇰Т ?쒓컙 ?섏젙 ?꾨즺', { workLogId: context.workLogId });
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      throw handleServiceError(error, {
        operation: '洹쇰Т ?쒓컙 ?섏젙',
        component: 'ConfirmedStaffRepository',
        context: { workLogId: context.workLogId },
      });
    }
  }

  async deleteWithTransaction(context: DeleteConfirmedStaffContext): Promise<void> {
    try {
      logger.info('?뺤젙 ?ㅽ깭????젣 ?몃옖??뀡 ?쒖옉', {
        workLogId: context.workLogId,
        jobPostingId: context.jobPostingId,
      });

      await runTransaction(getFirebaseDb(), async (transaction) => {
        const workLogRef = doc(getFirebaseDb(), COLLECTIONS.WORK_LOGS, context.workLogId);
        const jobPostingRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, context.jobPostingId);

        // WorkLog 議고쉶
        const workLogDoc = await transaction.get(workLogRef);
        if (!workLogDoc.exists()) {
          throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
            userMessage: '洹쇰Т 湲곕줉??李얠쓣 ???놁뒿?덈떎',
          });
        }

        const workLog = parseWorkLogDocument({
          id: workLogDoc.id,
          ...(workLogDoc.data() as Record<string, unknown>),
        });
        if (!workLog) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '洹쇰Т 湲곕줉 ?곗씠?곌? ?щ컮瑜댁? ?딆뒿?덈떎',
          });
        }

        // ?대? 異쒗눜洹쇳븳 寃쎌슦 ??젣 遺덇?
        if (
          workLog.status === STATUS.WORK_LOG.CHECKED_IN ||
          workLog.status === STATUS.WORK_LOG.CHECKED_OUT
        ) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '?대? 異쒗눜洹쇳븳 ?ㅽ깭?꾨뒗 ??젣?????놁뒿?덈떎',
          });
        }

        // JobPosting 議고쉶
        const jobPostingDoc = await transaction.get(jobPostingRef);
        if (!jobPostingDoc.exists()) {
          throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
            userMessage: '怨듦퀬瑜?李얠쓣 ???놁뒿?덈떎',
          });
        }

        // Application 議고쉶 (紐⑤뱺 ?쎄린瑜??곌린 ?꾩뿉 ?섑뻾)
        const applicationId = `${context.jobPostingId}_${context.staffId}`;
        const applicationRef = doc(getFirebaseDb(), COLLECTIONS.APPLICATIONS, applicationId);
        const applicationDoc = await transaction.get(applicationRef);

        // 1. WorkLog ?곹깭瑜?cancelled濡?蹂寃?
        transaction.update(workLogRef, {
          status: STATUS.WORK_LOG.CANCELLED,
          cancelledReason: context.reason,
          cancelledAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // 2. Application???덉쑝硫??곹깭 蹂듭썝
        if (applicationDoc.exists()) {
          transaction.update(applicationRef, {
            status: STATUS.APPLICATION.APPLIED,
            updatedAt: serverTimestamp(),
          });
        }

        // 3. JobPosting??filledPositions 媛먯냼
        transaction.update(jobPostingRef, {
          filledPositions: increment(-1),
          updatedAt: serverTimestamp(),
        });
      });

      logger.info('?뺤젙 ?ㅽ깭????젣 ?꾨즺', {
        workLogId: context.workLogId,
        jobPostingId: context.jobPostingId,
      });
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      throw handleServiceError(error, {
        operation: '?뺤젙 ?ㅽ깭????젣',
        component: 'ConfirmedStaffRepository',
        context: { workLogId: context.workLogId, jobPostingId: context.jobPostingId },
      });
    }
  }

  async markAsNoShow(context: MarkNoShowContext): Promise<void> {
    try {
      logger.info('?몄눥 泥섎━', { workLogId: context.workLogId });

      await runTransaction(getFirebaseDb(), async (transaction) => {
        // 1. WorkLog ?쎄린
        const workLogRef = doc(getFirebaseDb(), COLLECTIONS.WORK_LOGS, context.workLogId);
        const workLogDoc = await transaction.get(workLogRef);
        if (!workLogDoc.exists()) {
          throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
            userMessage: '洹쇰Т 湲곕줉??李얠쓣 ???놁뒿?덈떎',
          });
        }

        // 2. JobPosting ?쎄린 ???뚯쑀???뺤씤
        const workLogData = workLogDoc.data();
        const jobPostingId = workLogData?.jobPostingId;
        if (typeof jobPostingId !== 'string' || !jobPostingId) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '洹쇰Т 湲곕줉??怨듦퀬 ?뺣낫媛 ?놁뒿?덈떎',
          });
        }
        const jobPostingRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobPostingId);
        const jobPostingDoc = await transaction.get(jobPostingRef);
        if (!jobPostingDoc.exists()) {
          throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
            userMessage: '怨듦퀬瑜?李얠쓣 ???놁뒿?덈떎',
          });
        }
        if (jobPostingDoc.data()?.ownerId !== context.ownerId) {
          throw new BusinessError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
            userMessage: '怨듦퀬 ?뚯쑀?먮쭔 ?몄눥 泥섎━?????덉뒿?덈떎',
          });
        }

        // 3. WorkLog ?낅뜲?댄듃
        transaction.update(workLogRef, {
          status: STATUS.WORK_LOG.CANCELLED,
          noShowReason: context.reason,
          noShowAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      logger.info('?몄눥 泥섎━ ?꾨즺', { workLogId: context.workLogId });
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      throw handleServiceError(error, {
        operation: '?몄눥 泥섎━',
        component: 'ConfirmedStaffRepository',
        context: { workLogId: context.workLogId },
      });
    }
  }

  async updateStatus(context: UpdateStaffStatusContext): Promise<void> {
    try {
      logger.info('?ㅽ깭???곹깭 蹂寃?', { workLogId: context.workLogId, status: context.status });

      await runTransaction(getFirebaseDb(), async (transaction) => {
        // 1. WorkLog ?쎄린
        const workLogRef = doc(getFirebaseDb(), COLLECTIONS.WORK_LOGS, context.workLogId);
        const workLogDoc = await transaction.get(workLogRef);
        if (!workLogDoc.exists()) {
          throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
            userMessage: '洹쇰Т 湲곕줉??李얠쓣 ???놁뒿?덈떎',
          });
        }

        // 2. JobPosting ?쎄린 ???뚯쑀???뺤씤
        const workLogData = workLogDoc.data();
        const jobPostingId = workLogData?.jobPostingId;
        if (typeof jobPostingId !== 'string' || !jobPostingId) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '洹쇰Т 湲곕줉??怨듦퀬 ?뺣낫媛 ?놁뒿?덈떎',
          });
        }
        const jobPostingRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobPostingId);
        const jobPostingDoc = await transaction.get(jobPostingRef);
        if (!jobPostingDoc.exists()) {
          throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
            userMessage: '怨듦퀬瑜?李얠쓣 ???놁뒿?덈떎',
          });
        }
        if (jobPostingDoc.data()?.ownerId !== context.ownerId) {
          throw new BusinessError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
            userMessage: '怨듦퀬 ?뚯쑀?먮쭔 ?곹깭瑜?蹂寃쏀븷 ???덉뒿?덈떎',
          });
        }

        // 3. WorkLog ?낅뜲?댄듃
        transaction.update(workLogRef, {
          status: context.status,
          updatedAt: serverTimestamp(),
        });
      });

      logger.info('?ㅽ깭???곹깭 蹂寃??꾨즺', {
        workLogId: context.workLogId,
        status: context.status,
      });
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      throw handleServiceError(error, {
        operation: '?ㅽ깭???곹깭 蹂寃?',
        component: 'ConfirmedStaffRepository',
        context: { workLogId: context.workLogId, status: context.status },
      });
    }
  }

  // ==========================================================================
  // Real-time Subscription
  // ==========================================================================

  subscribeByJobPostingId(
    jobPostingId: string,
    callbacks: ConfirmedStaffSubscriptionCallbacks
  ): Unsubscribe {
    logger.info('?뺤젙 ?ㅽ깭???ㅼ떆媛?援щ룆 ?쒖옉', { jobPostingId });

    const workLogsRef = collection(getFirebaseDb(), COLLECTIONS.WORK_LOGS);
    const q = query(
      workLogsRef,
      where(FIELDS.WORK_LOG.jobPostingId, '==', jobPostingId),
      orderBy(FIELDS.WORK_LOG.date, 'asc'),
      limit(500)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const workLogs = parseWorkLogDocuments(
            snapshot.docs.map((docSnap) => ({
              id: docSnap.id,
              ...(docSnap.data() as Record<string, unknown>),
            }))
          );

          callbacks.onUpdate(workLogs);
        } catch (error) {
          logger.error('?뺤젙 ?ㅽ깭??援щ룆 泥섎━ ?먮윭', toError(error), { jobPostingId });
          callbacks.onError?.(toError(error));
        }
      },
      (error) => {
        const appError = handleServiceError(error, {
          operation: '?뺤젙 ?ㅽ깭??援щ룆',
          component: 'ConfirmedStaffRepository',
          context: { jobPostingId },
        });
        callbacks.onError?.(appError as Error);
      }
    );

    return unsubscribe;
  }
}
