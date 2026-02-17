/**
 * UNIQN Mobile - WorkLog Repository Subscriptions
 *
 * @description 근무기록 실시간 구독 (5개 메서드)
 */

import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import { parseWorkLogDocument } from '@/schemas';
import type { WorkLog } from '@/types';
import { COLLECTIONS, FIELDS } from '@/constants';
import { DEFAULT_PAGE_SIZE } from './constants';

// ============================================================================
// Realtime Subscriptions
// ============================================================================

export function subscribeByDate(
  staffId: string,
  date: string,
  onData: (workLogs: WorkLog[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  logger.info('날짜별 근무 기록 구독 시작', { staffId, date });

  const workLogsRef = collection(getFirebaseDb(), COLLECTIONS.WORK_LOGS);

  const q = query(
    workLogsRef,
    where(FIELDS.WORK_LOG.staffId, '==', staffId),
    where(FIELDS.WORK_LOG.date, '==', date),
    orderBy(FIELDS.WORK_LOG.checkInTime, 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: WorkLog[] = [];

      for (const docSnapshot of snapshot.docs) {
        const workLog = parseWorkLogDocument({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        });

        if (workLog) {
          items.push(workLog);
        }
      }

      logger.debug('날짜별 근무 기록 업데이트', {
        staffId,
        date,
        count: items.length,
      });

      onData(items);
    },
    (error) => {
      logger.error('날짜별 근무 기록 구독 에러', toError(error), {
        staffId,
        date,
      });
      onError(error);
    }
  );
}

export function subscribeByStaffId(
  staffId: string,
  onData: (workLogs: WorkLog[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  logger.info('스태프별 근무 기록 실시간 구독 시작', { staffId });

  const workLogsRef = collection(getFirebaseDb(), COLLECTIONS.WORK_LOGS);

  const q = query(
    workLogsRef,
    where(FIELDS.WORK_LOG.staffId, '==', staffId),
    orderBy(FIELDS.WORK_LOG.date, 'desc'),
    limit(DEFAULT_PAGE_SIZE)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: WorkLog[] = [];

      for (const docSnapshot of snapshot.docs) {
        const workLog = parseWorkLogDocument({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        });

        if (workLog) {
          items.push(workLog);
        }
      }

      logger.debug('스태프별 근무 기록 업데이트', {
        staffId,
        count: items.length,
      });

      onData(items);
    },
    (error) => {
      logger.error('스태프별 근무 기록 구독 에러', toError(error), { staffId });
      onError(error);
    }
  );
}

export function subscribeById(
  workLogId: string,
  onData: (workLog: WorkLog | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  logger.info('단일 근무 기록 구독 시작', { workLogId });

  const workLogRef = doc(getFirebaseDb(), COLLECTIONS.WORK_LOGS, workLogId);

  return onSnapshot(
    workLogRef,
    (docSnap) => {
      if (!docSnap.exists()) {
        onData(null);
        return;
      }

      const workLog = parseWorkLogDocument({ id: docSnap.id, ...docSnap.data() });
      onData(workLog);
    },
    (error) => {
      logger.error('단일 근무 기록 구독 에러', toError(error), { workLogId });
      onError(error);
    }
  );
}

export function subscribeByStaffIdWithFilters(
  staffId: string,
  options: { dateRange?: { start: string; end: string }; pageSize?: number },
  onData: (workLogs: WorkLog[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const { dateRange, pageSize = DEFAULT_PAGE_SIZE } = options;

  logger.info('필터를 포함한 스태프별 근무 기록 구독 시작', { staffId, dateRange });

  const workLogsRef = collection(getFirebaseDb(), COLLECTIONS.WORK_LOGS);

  const q = dateRange
    ? query(
        workLogsRef,
        where(FIELDS.WORK_LOG.staffId, '==', staffId),
        where(FIELDS.WORK_LOG.date, '>=', dateRange.start),
        where(FIELDS.WORK_LOG.date, '<=', dateRange.end),
        orderBy(FIELDS.WORK_LOG.date, 'desc'),
        limit(pageSize)
      )
    : query(
        workLogsRef,
        where(FIELDS.WORK_LOG.staffId, '==', staffId),
        orderBy(FIELDS.WORK_LOG.date, 'desc'),
        limit(pageSize)
      );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: WorkLog[] = [];

      for (const docSnapshot of snapshot.docs) {
        const workLog = parseWorkLogDocument({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        });

        if (workLog) {
          items.push(workLog);
        }
      }

      logger.debug('필터를 포함한 스태프별 근무 기록 업데이트', {
        staffId,
        count: items.length,
      });

      onData(items);
    },
    (error) => {
      logger.error('필터를 포함한 스태프별 근무 기록 구독 에러', toError(error), { staffId });
      onError(error);
    }
  );
}

export function subscribeTodayActive(
  staffId: string,
  date: string,
  statuses: string[],
  onData: (workLog: WorkLog | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  logger.info('오늘 활성 근무 기록 구독 시작', { staffId, date, statuses });

  const workLogsRef = collection(getFirebaseDb(), COLLECTIONS.WORK_LOGS);

  const q = query(
    workLogsRef,
    where(FIELDS.WORK_LOG.staffId, '==', staffId),
    where(FIELDS.WORK_LOG.date, '==', date),
    where(FIELDS.WORK_LOG.status, 'in', statuses),
    limit(1)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        onData(null);
        return;
      }

      const docSnap = snapshot.docs[0];
      const workLog = parseWorkLogDocument({ id: docSnap.id, ...docSnap.data() });
      onData(workLog);
    },
    (error) => {
      logger.error('오늘 활성 근무 기록 구독 에러', toError(error), { staffId, date });
      onError(error);
    }
  );
}
