/**
 * @file expireByLastWorkDate.ts
 * @description 마지막 근무일 기반 공고 자동 마감 Scheduled Function
 *
 * 실행 주기: 매일 00:15 KST
 * 처리 대상: regular, urgent, tournament 타입 (fixed 제외 — 별도 expiresAt 메커니즘)
 *
 * 마감 규칙:
 * - 마지막 근무일 +1일이 지나면 자동 마감
 * - 예: 2/9(월) → 2/11 00:00 KST 마감
 * - 예: 2/9~2/10 → 2/12 00:00 KST 마감
 * - 공식: lastWorkDate <= KST_today - 2일
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import type { ClosedReason, PostingType } from '../types/jobPosting';
import { STATUS } from '../constants/status';

const CLOSED_REASON: ClosedReason = 'expired_by_work_date';

/**
 * KST 기준 오늘 날짜를 YYYY-MM-DD 문자열로 반환
 */
function getKSTToday(): string {
  const now = new Date();
  // UTC → KST (+9시간)
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0];
}

/**
 * 날짜 문자열에서 N일 전 날짜를 YYYY-MM-DD로 반환
 */
function subtractDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().split('T')[0];
}

/**
 * UTC Date를 KST 기준 YYYY-MM-DD 문자열로 변환
 * Timestamp가 KST 자정을 나타내는 경우 UTC로는 전날 15:00이므로 KST 보정 필수
 */
function toKSTDateString(date: Date): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0];
}

/**
 * dateSpecificRequirements 배열에서 마지막 근무일(최대 날짜) 추출
 */
function getLastWorkDateFromRequirements(
  dateSpecificRequirements?: Array<{ date?: string | { seconds: number } | admin.firestore.Timestamp }>
): string | null {
  if (!dateSpecificRequirements || dateSpecificRequirements.length === 0) {
    return null;
  }

  const dates: string[] = [];

  for (const req of dateSpecificRequirements) {
    if (!req.date) continue;

    if (typeof req.date === 'string') {
      dates.push(req.date);
    } else if (req.date instanceof admin.firestore.Timestamp) {
      dates.push(toKSTDateString(req.date.toDate()));
    } else if ('seconds' in req.date) {
      dates.push(toKSTDateString(new Date(req.date.seconds * 1000)));
    }
  }

  if (dates.length === 0) return null;

  return dates.sort().pop() ?? null;
}

/**
 * 특정 postingType의 만료 공고를 배치 처리 (pagination 지원)
 *
 * @returns 처리된 공고 수
 */
async function processPostingType(
  db: admin.firestore.Firestore,
  postingType: Extract<PostingType, 'regular' | 'urgent'>,
  cutoffDate: string,
  now: admin.firestore.Timestamp
): Promise<number> {
  let processed = 0;
  let lastDoc: admin.firestore.DocumentSnapshot | null = null;
  let hasMore = true;

  while (hasMore) {
    let query = db
      .collection('jobPostings')
      .where('postingType', '==', postingType)
      .where('status', '==', STATUS.JOB_POSTING.ACTIVE)
      .where('workDate', '<=', cutoffDate)
      .orderBy('workDate', 'asc')
      .limit(100);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();

    if (snapshot.empty) break;

    const batch = db.batch();

    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        status: STATUS.JOB_POSTING.CLOSED,
        closedAt: now,
        closedReason: CLOSED_REASON,
        updatedAt: now,
      });
    });

    await batch.commit();

    processed += snapshot.size;
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    hasMore = snapshot.size === 100;

    logger.info(`${postingType} 공고 ${snapshot.size}개 마감 처리`, {
      postingType,
      batchSize: snapshot.size,
      totalProcessed: processed,
    });
  }

  return processed;
}

/**
 * tournament 타입 공고의 만료 처리
 * dateSpecificRequirements 배열에서 마지막 날짜를 추출하여 비교
 *
 * @returns 처리된 공고 수
 */
async function processTournamentPostings(
  db: admin.firestore.Firestore,
  cutoffDate: string,
  now: admin.firestore.Timestamp
): Promise<number> {
  const snapshot = await db
    .collection('jobPostings')
    .where('postingType', '==', 'tournament')
    .where('status', '==', STATUS.JOB_POSTING.ACTIVE)
    .get();

  if (snapshot.empty) return 0;

  const expiredDocs: admin.firestore.DocumentSnapshot[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // dateSpecificRequirements에서 마지막 날짜 추출
    const lastDate = getLastWorkDateFromRequirements(data.dateSpecificRequirements);

    // workDate 폴백 (dateSpecificRequirements가 없는 경우)
    const effectiveLastDate = lastDate || data.workDate;

    if (effectiveLastDate && effectiveLastDate <= cutoffDate) {
      expiredDocs.push(doc);
    }
  }

  if (expiredDocs.length === 0) return 0;

  // 100개씩 배치 처리
  for (let i = 0; i < expiredDocs.length; i += 100) {
    const batchDocs = expiredDocs.slice(i, i + 100);
    const batch = db.batch();

    batchDocs.forEach((doc) => {
      batch.update(doc.ref, {
        status: STATUS.JOB_POSTING.CLOSED,
        closedAt: now,
        closedReason: CLOSED_REASON,
        updatedAt: now,
      });
    });

    await batch.commit();
  }

  logger.info(`tournament 공고 ${expiredDocs.length}개 마감 처리`, {
    totalActive: snapshot.size,
    expired: expiredDocs.length,
  });

  return expiredDocs.length;
}

/**
 * 마지막 근무일 기반 공고 자동 마감 Scheduled Function
 *
 * 스케줄: 매일 00:15 KST
 * 타임존: Asia/Seoul
 */
export const expireByLastWorkDate = onSchedule(
  { schedule: '15 0 * * *', timeZone: 'Asia/Seoul', region: 'asia-northeast3' },
  async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const kstToday = getKSTToday();
    const cutoffDate = subtractDays(kstToday, 2);

    logger.info('=== 근무일 기반 공고 자동 마감 시작 ===', {
      kstToday,
      cutoffDate,
      timestamp: new Date().toISOString(),
    });

    try {
      // regular, urgent: workDate 기반 인덱스 쿼리 (효율적)
      const [regularCount, urgentCount, tournamentCount] = await Promise.all([
        processPostingType(db, 'regular', cutoffDate, now),
        processPostingType(db, 'urgent', cutoffDate, now),
        processTournamentPostings(db, cutoffDate, now),
      ]);

      const totalCount = regularCount + urgentCount + tournamentCount;

      logger.info('=== 근무일 기반 공고 자동 마감 완료 ===', {
        regular: regularCount,
        urgent: urgentCount,
        tournament: tournamentCount,
        total: totalCount,
        kstToday,
        cutoffDate,
      });

      return;
    } catch (error) {
      logger.error('근무일 기반 공고 자동 마감 실패', {
        error: error instanceof Error ? error.stack : String(error),
        kstToday,
        cutoffDate,
      });

      throw error; // Cloud Functions 자동 재시도
    }
  });
