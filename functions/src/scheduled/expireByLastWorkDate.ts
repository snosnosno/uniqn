import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import type { ClosedReason, PostingType } from '../types/jobPosting';
import { STATUS } from '../constants/status';

const CLOSED_REASON: ClosedReason = 'expired_by_work_date';

function getKSTToday(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0];
}

function subtractDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().split('T')[0];
}

function toKSTDateString(date: Date): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0];
}

function getLastWorkDateFromSchedule(
  schedule?: {
    kind?: string;
    requirements?: Array<{ date?: string | { seconds: number } | admin.firestore.Timestamp }>;
  }
): string | null {
  if (schedule?.kind !== 'dated' || !schedule.requirements || schedule.requirements.length === 0) {
    return null;
  }

  const dates: string[] = [];

  for (const requirement of schedule.requirements) {
    if (!requirement.date) continue;

    if (typeof requirement.date === 'string') {
      dates.push(requirement.date);
      continue;
    }

    if (requirement.date instanceof admin.firestore.Timestamp) {
      dates.push(toKSTDateString(requirement.date.toDate()));
      continue;
    }

    if ('seconds' in requirement.date) {
      dates.push(toKSTDateString(new Date(requirement.date.seconds * 1000)));
    }
  }

  if (dates.length === 0) {
    return null;
  }

  return dates.sort().pop() ?? null;
}

async function processScheduleBasedPostingType(
  db: admin.firestore.Firestore,
  postingType: Extract<PostingType, 'regular' | 'urgent' | 'tournament'>,
  cutoffDate: string,
  now: admin.firestore.Timestamp
): Promise<number> {
  let processed = 0;
  let lastDoc: admin.firestore.DocumentSnapshot | null = null;
  let hasMore = true;

  while (hasMore) {
    let postingQuery = db
      .collection('jobPostings')
      .where('postingType', '==', postingType)
      .where('status', '==', STATUS.JOB_POSTING.ACTIVE)
      .orderBy(admin.firestore.FieldPath.documentId(), 'asc')
      .limit(100);

    if (lastDoc) {
      postingQuery = postingQuery.startAfter(lastDoc);
    }

    const snapshot = await postingQuery.get();
    if (snapshot.empty) {
      break;
    }

    const expiredDocs = snapshot.docs.filter((doc) => {
      const data = doc.data();
      const lastScheduledDate = getLastWorkDateFromSchedule(data.schedule);
      const effectiveLastDate = lastScheduledDate || data.workDate;

      return Boolean(effectiveLastDate && effectiveLastDate <= cutoffDate);
    });

    if (expiredDocs.length > 0) {
      const batch = db.batch();

      expiredDocs.forEach((doc) => {
        batch.update(doc.ref, {
          status: STATUS.JOB_POSTING.CLOSED,
          closedAt: now,
          closedReason: CLOSED_REASON,
          updatedAt: now,
        });
      });

      await batch.commit();
      processed += expiredDocs.length;
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    hasMore = snapshot.size === 100;

    logger.info(`${postingType} postings processed for auto-close`, {
      postingType,
      batchSize: snapshot.size,
      totalProcessed: processed,
    });
  }

  return processed;
}

async function processTournamentPostings(
  db: admin.firestore.Firestore,
  cutoffDate: string,
  now: admin.firestore.Timestamp
): Promise<number> {
  return processScheduleBasedPostingType(db, 'tournament', cutoffDate, now);
}

export const expireByLastWorkDate = onSchedule(
  { schedule: '15 0 * * *', timeZone: 'Asia/Seoul', region: 'asia-northeast3' },
  async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const kstToday = getKSTToday();
    const cutoffDate = subtractDays(kstToday, 2);

    logger.info('expireByLastWorkDate started', {
      kstToday,
      cutoffDate,
      timestamp: new Date().toISOString(),
    });

    try {
      const [regularCount, urgentCount, tournamentCount] = await Promise.all([
        processScheduleBasedPostingType(db, 'regular', cutoffDate, now),
        processScheduleBasedPostingType(db, 'urgent', cutoffDate, now),
        processTournamentPostings(db, cutoffDate, now),
      ]);

      logger.info('expireByLastWorkDate completed', {
        regular: regularCount,
        urgent: urgentCount,
        tournament: tournamentCount,
        total: regularCount + urgentCount + tournamentCount,
        kstToday,
        cutoffDate,
      });
    } catch (error) {
      logger.error('expireByLastWorkDate failed', {
        error: error instanceof Error ? error.stack : String(error),
        kstToday,
        cutoffDate,
      });

      throw error;
    }
  }
);
