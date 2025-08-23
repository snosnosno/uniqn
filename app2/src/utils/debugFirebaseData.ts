import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from './logger';

/**
 * Firebase에서 직접 WorkLog 데이터를 조회하여 구조 확인
 */
export async function debugFirebaseWorkLogs(eventId: string) {
  try {
    logger.info('🔍 Firebase WorkLog 직접 조회 시작', {
      component: 'debugFirebaseData',
      data: { eventId }
    });

    // WorkLogs 컬렉션에서 해당 이벤트의 모든 WorkLog 조회
    const workLogsRef = collection(db, 'workLogs');
    const q = query(workLogsRef, where('eventId', '==', eventId));
    const snapshot = await getDocs(q);

    const workLogs: any[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      workLogs.push({
        id: doc.id,
        ...data
      });

      // 각 WorkLog의 실제 필드 출력
      logger.info('📝 WorkLog 원본 데이터', {
        component: 'debugFirebaseData',
        data: {
          id: doc.id,
          fields: Object.keys(data),
          // 모든 필드를 직접 출력
          rawData: data,
          // 시간 관련 필드만 따로 출력
          timeFields: {
            timeSlot: data.timeSlot,
            scheduledStartTime: data.scheduledStartTime,
            scheduledEndTime: data.scheduledEndTime,
            actualStartTime: data.actualStartTime,
            actualEndTime: data.actualEndTime,
            assignedTime: data.assignedTime
          },
          // 스태프 정보
          staffInfo: {
            staffId: data.staffId,
            staffName: data.staffName,
            role: data.role
          }
        }
      });
    });

    logger.info('🔍 Firebase WorkLog 조회 완료', {
      component: 'debugFirebaseData',
      data: {
        totalCount: workLogs.length,
        eventId
      }
    });

    return workLogs;
  } catch (error) {
    logger.error('Firebase WorkLog 조회 실패', error as Error, {
      component: 'debugFirebaseData',
      data: { eventId }
    });
    throw error;
  }
}

// Window 객체에 노출하여 콘솔에서 직접 호출 가능
if (typeof window !== 'undefined') {
  (window as any).debugFirebaseWorkLogs = debugFirebaseWorkLogs;
}