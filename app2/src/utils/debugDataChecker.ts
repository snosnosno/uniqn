import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from './logger';

/**
 * Firebase 데이터 구조를 직접 확인하는 디버그 유틸리티
 */
export async function checkFirebaseData(eventId: string): Promise<void> {
  try {
    logger.info('🔍 Firebase 데이터 구조 확인 시작', {
      component: 'debugDataChecker',
      data: { eventId }
    });

    // 1. JobPosting 문서 확인
    const jobPostingQuery = query(
      collection(db, 'jobPostings'),
      where('__name__', '==', eventId),
      limit(1)
    );
    
    const jobPostingSnapshot = await getDocs(jobPostingQuery);
    
    if (!jobPostingSnapshot.empty) {
      const jobPostingDoc = jobPostingSnapshot.docs[0];
      const jobPostingData = jobPostingDoc.data();
      
      logger.info('📄 JobPosting 문서 구조', {
        component: 'debugDataChecker',
        data: {
          id: jobPostingDoc.id,
          confirmedStaffCount: jobPostingData.confirmedStaff?.length || 0,
          confirmedStaff: jobPostingData.confirmedStaff?.map((staff: any) => ({
            userId: staff.userId,
            applicantId: staff.applicantId,
            name: staff.name,
            role: staff.role,
            roles: staff.roles,
            date: staff.date,
            timeSlot: staff.timeSlot
          }))
        }
      });
    }

    // 2. WorkLogs 확인
    const workLogsQuery = query(
      collection(db, 'workLogs'),
      where('eventId', '==', eventId)
    );
    
    const workLogsSnapshot = await getDocs(workLogsQuery);
    
    logger.info('📊 WorkLogs 문서 구조', {
      component: 'debugDataChecker',
      data: {
        totalCount: workLogsSnapshot.size,
        workLogs: workLogsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            staffId: data.staffId,
            staffName: data.staffName,
            role: data.role,
            date: data.date,
            scheduledStartTime: data.scheduledStartTime,
            scheduledEndTime: data.scheduledEndTime,
            actualStartTime: data.actualStartTime,
            actualEndTime: data.actualEndTime,
            hoursWorked: data.hoursWorked,
            status: data.status
          };
        })
      }
    });

    // 3. Staff 컬렉션 확인
    const staffQuery = query(
      collection(db, 'staff'),
      limit(10)
    );
    
    const staffSnapshot = await getDocs(staffQuery);
    
    logger.info('👥 Staff 문서 구조', {
      component: 'debugDataChecker',
      data: {
        totalCount: staffSnapshot.size,
        staff: staffSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          role: doc.data().role,
          eventIds: doc.data().eventIds
        }))
      }
    });

    // 4. ID 매칭 분석
    if (!jobPostingSnapshot.empty && workLogsSnapshot.size > 0) {
      const jobPostingData = jobPostingSnapshot.docs[0].data();
      const confirmedStaff = jobPostingData.confirmedStaff || [];
      const workLogs = workLogsSnapshot.docs.map(doc => doc.data());
      
      logger.info('🔗 ID 매칭 분석', {
        component: 'debugDataChecker',
        data: {
          confirmedStaffIds: confirmedStaff.map((s: any) => ({
            userId: s.userId,
            applicantId: s.applicantId,
            name: s.name
          })),
          workLogStaffIds: workLogs.map(w => ({
            staffId: w.staffId,
            staffName: w.staffName
          })),
          matchingAnalysis: confirmedStaff.map((staff: any) => {
            const matchingWorkLogs = workLogs.filter(w => 
              w.staffId === staff.userId || 
              w.staffId === staff.applicantId ||
              w.staffName === staff.name
            );
            return {
              staffName: staff.name,
              userId: staff.userId,
              applicantId: staff.applicantId,
              matchingWorkLogsCount: matchingWorkLogs.length,
              matchingWorkLogs: matchingWorkLogs.map(w => ({
                staffId: w.staffId,
                staffName: w.staffName,
                role: w.role
              }))
            };
          })
        }
      });
    }

    logger.info('✅ Firebase 데이터 구조 확인 완료', {
      component: 'debugDataChecker'
    });

  } catch (error) {
    logger.error('Firebase 데이터 확인 실패', error as Error, {
      component: 'debugDataChecker'
    });
  }
}

// 전역 스코프에 함수 노출 (콘솔에서 직접 호출 가능)
if (typeof window !== 'undefined') {
  (window as any).checkFirebaseData = checkFirebaseData;
}