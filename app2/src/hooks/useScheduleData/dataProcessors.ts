import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { logger } from '../../utils/logger';
import { ScheduleEvent, AttendanceStatus } from '../../types/schedule';
import { 
  safeDateToString, 
  parseTimeString, 
  extractDateFromFields 
} from '../../utils/scheduleUtils';
import { timestampToLocalDateString } from '../../utils/dateUtils';
import { parseAssignedTime, convertTimeToTimestamp } from '../../utils/workLogUtils';
import { getRoleForApplicationStatus } from './roleUtils';
import { ApplicationData, WorkLogData, JobPostingData } from './types';

/**
 * 지원서 데이터를 스케줄 이벤트로 처리
 */
export const processApplicationData = async (
  docId: string, 
  data: ApplicationData
): Promise<ScheduleEvent[]> => {
  const events: ScheduleEvent[] = [];
  
  try {
    // 공고 정보 가져오기
    let jobPostingData: JobPostingData | null = null;
    if (data.postId) {
      try {
        const jobPostingDoc = await getDoc(doc(db, 'jobPostings', data.postId));
        if (jobPostingDoc.exists()) {
          jobPostingData = { 
            id: jobPostingDoc.id, 
            ...jobPostingDoc.data() 
          } as JobPostingData;
        }
      } catch (error) {
        logger.error('공고 정보 조회 실패:', error instanceof Error ? error : new Error(String(error)), { 
          component: 'useScheduleData',
          data: { postId: data.postId }
        });
      }
    }
    
    // 기본 날짜 처리
    let baseDate = '';
    
    // assignedDate가 있으면 우선 사용
    if (data.assignedDate) {
      baseDate = safeDateToString(data.assignedDate);
    }
    
    // 공고 날짜 사용 (fallback)
    if (!baseDate && jobPostingData?.startDate) {
      baseDate = timestampToLocalDateString(jobPostingData.startDate);
    }
    
    // 날짜가 여전히 없으면 추가 처리
    if (!baseDate) {
      const fallbackDate = extractDateFromFields(data, ['createdAt', 'updatedAt', 'appliedAt']);
      if (fallbackDate) {
        baseDate = fallbackDate;
      } else if (jobPostingData) {
        const jobFallbackDate = extractDateFromFields(jobPostingData, ['createdAt', 'updatedAt']);
        if (jobFallbackDate) {
          baseDate = jobFallbackDate;
        }
      }
    }
    
    // assignedTime 파싱 (하위 호환성 유지)
    const { startTime, endTime } = parseAssignedTime(data.assignedTime || '');
    const startTimestamp = startTime ? convertTimeToTimestamp(startTime, baseDate) : null;
    const endTimestamp = endTime ? convertTimeToTimestamp(endTime, baseDate) : null;
    
    // 기본 스케줄 이벤트 생성
    const baseEvent: ScheduleEvent = {
      id: docId,
      type: 'applied' as const,
      date: baseDate,
      startTime: startTimestamp,
      endTime: endTimestamp,
      eventId: data.postId || '',
      eventName: data.postTitle || '제목 없음',
      location: jobPostingData?.location || '',
      ...(jobPostingData?.detailedAddress && { detailedAddress: jobPostingData.detailedAddress }),
      role: getRoleForApplicationStatus(data, baseDate),
      status: 'not_started' as AttendanceStatus, // 지원 상태에서는 출석 상태가 not_started
      applicationStatus: data.status as 'pending' | 'confirmed' | 'rejected',
      notes: '',
      sourceCollection: 'applications' as const,
      sourceId: docId,
      applicationId: docId
    };
    
    // assignedDates가 있는 경우 여러 날짜 이벤트 생성
    if (data.assignedDates && Array.isArray(data.assignedDates)) {
      const convertedDates: string[] = [];
      
      data.assignedDates.forEach((dateItem: any) => {
        let convertedDate = '';
        
        if (typeof dateItem === 'string') {
          // 문자열로 저장된 Timestamp 처리
          if (dateItem.includes('Timestamp(')) {
            const match = dateItem.match(/seconds=(\d+)/);
            if (match && match[1]) {
              const seconds = parseInt(match[1]);
              const isoString = new Date(seconds * 1000).toISOString();
              convertedDate = isoString.substring(0, 10);
            }
          } else {
            convertedDate = dateItem;
          }
        } else if (typeof dateItem === 'object') {
          if (dateItem.toDate && typeof dateItem.toDate === 'function') {
            const isoString = dateItem.toDate().toISOString();
            convertedDate = isoString.substring(0, 10);
          } else if (dateItem.seconds) {
            const isoString = new Date(dateItem.seconds * 1000).toISOString();
            convertedDate = isoString.substring(0, 10);
          }
        }
        
        if (convertedDate) {
          convertedDates.push(convertedDate);
        }
      });
      
      // 여러 날짜가 있으면 각 날짜마다 이벤트 생성
      if (convertedDates.length > 0) {
        convertedDates.forEach((date, index) => {
          const timeStr = data.assignedTimes?.[index] || data.assignedTime || '';
          const { startTime, endTime } = parseAssignedTime(timeStr);
          const startTimestamp = startTime ? convertTimeToTimestamp(startTime, date) : null;
          const endTimestamp = endTime ? convertTimeToTimestamp(endTime, date) : null;
          
          const event: ScheduleEvent = {
            ...baseEvent,
            id: `${docId}_${index}`,
            date: date,
            role: getRoleForApplicationStatus(data, date),
            startTime: startTimestamp,
            endTime: endTimestamp
          };
          events.push(event);
        });
      } else {
        events.push(baseEvent);
      }
    } else {
      events.push(baseEvent);
    }
    
  } catch (error) {
    logger.error('Application 데이터 처리 중 오류:', error instanceof Error ? error : new Error(String(error)), { 
      component: 'useScheduleData',
      data: { docId }
    });
  }
  
  return events;
};

/**
 * 근무 기록 데이터를 스케줄 이벤트로 처리
 */
export const processWorkLogData = (
  docId: string,
  data: WorkLogData
): ScheduleEvent => {
  // actualStartTime/actualEndTime 사용
  const actualStart = data.actualStartTime || '';
  const actualEnd = data.actualEndTime || '';
  
  const timeData = parseTimeString(
    `${data.scheduledStartTime || actualStart || ''}-${data.scheduledEndTime || actualEnd || ''}`,
    data.date
  );
  
  return {
    id: docId,
    type: 'confirmed' as const,
    date: data.date,
    startTime: timeData.startTime,
    endTime: timeData.endTime,
    actualStartTime: actualStart ? timeData.startTime : null,
    actualEndTime: actualEnd ? timeData.endTime : null,
    eventId: '',  // workLogs에는 eventId가 없음
    eventName: '근무',  // 기본값
    location: '',  // workLogs에는 location이 없음
    role: data.role || '',
    status: 'not_started' as AttendanceStatus,  // workLogs에는 status가 없으므로 기본값 사용
    notes: data.notes || '',
    sourceCollection: 'workLogs' as const,
    sourceId: docId,
    workLogId: docId
  };
};

/**
 * 스케줄 통계 계산
 */
export const calculateStats = (events: ScheduleEvent[]): {
  totalEvents: number;
  pendingCount: number;
  confirmedCount: number;
  rejectedCount: number;
  byRole: { [key: string]: number };
  byLocation: { [key: string]: number };
  byDate: { [key: string]: number };
} => {
  const stats = {
    totalEvents: events.length,
    pendingCount: 0,
    confirmedCount: 0,
    rejectedCount: 0,
    byRole: {} as { [key: string]: number },
    byLocation: {} as { [key: string]: number },
    byDate: {} as { [key: string]: number }
  };
  
  events.forEach(event => {
    // 상태별 카운트 - applicationStatus 사용
    if (event.applicationStatus === 'pending') {
      stats.pendingCount++;
    } else if (event.applicationStatus === 'confirmed') {
      stats.confirmedCount++;
    } else if (event.applicationStatus === 'rejected') {
      stats.rejectedCount++;
    } else if (event.type === 'confirmed') {
      // workLogs 등의 확정된 일정
      stats.confirmedCount++;
    }
    
    // 역할별 카운트
    if (event.role) {
      stats.byRole[event.role] = (stats.byRole[event.role] || 0) + 1;
    }
    
    // 위치별 카운트
    if (event.location) {
      stats.byLocation[event.location] = (stats.byLocation[event.location] || 0) + 1;
    }
    
    // 날짜별 카운트
    if (event.date) {
      stats.byDate[event.date] = (stats.byDate[event.date] || 0) + 1;
    }
  });
  
  return stats;
};