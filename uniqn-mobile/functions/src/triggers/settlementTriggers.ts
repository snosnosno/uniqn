/**
 * UNIQN Functions - 정산 관련 트리거
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { sendNotification } from '../utils/notifications';
import { WorkLogDoc, JobPostingDoc } from '../types';

const db = admin.firestore();

/**
 * 정산 완료 시 → 스태프에게 알림
 */
export const onSettlementCompleted = functions
  .region('asia-northeast3')
  .firestore
  .document('workLogs/{workLogId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data() as WorkLogDoc;
    const after = change.after.data() as WorkLogDoc;

    // 정산 상태가 'settled'로 변경되지 않았으면 무시
    if (before.settlementStatus === 'settled' || after.settlementStatus !== 'settled') {
      return;
    }

    try {
      // 공고 정보 조회
      const jobDoc = await db.collection('jobPostings').doc(after.jobPostingId).get();
      if (!jobDoc.exists) {
        console.error(`Job posting not found: ${after.jobPostingId}`);
        return;
      }

      const job = jobDoc.data() as JobPostingDoc;

      // 스태프에게 알림 전송
      await sendNotification(after.staffId, 'settlement_completed', {
        workLogId: context.params.workLogId,
        jobPostingId: after.jobPostingId,
        jobTitle: job.title,
        amount: String(after.settlementAmount || 0),
      });

      console.log(`Settlement notification sent to: ${after.staffId}`);
    } catch (error) {
      console.error('Error in onSettlementCompleted:', error);
    }
  });
