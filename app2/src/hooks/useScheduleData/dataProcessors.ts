import { doc, getDoc, Timestamp } from 'firebase/firestore';
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
    const jobId = (data as any).eventId || data.postId;  // eventId 우선 사용
    if (jobId) {
      try {
        const jobPostingDoc = await getDoc(doc(db, 'jobPostings', jobId));
        if (jobPostingDoc.exists()) {
          jobPostingData = { 
            id: jobPostingDoc.id, 
            ...jobPostingDoc.data() 
          } as JobPostingData;
        }
      } catch (error) {
        logger.error('공고 정보 조회 실패:', error instanceof Error ? error : new Error(String(error)), { 
          component: 'useScheduleData',
          data: { jobId }
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
    
    // 상태별 type 매핑 (통일된 상태 사용)
    const typeMap: Record<string, ScheduleEvent['type']> = {
      'pending': 'applied',
      'applied': 'applied',
      'confirmed': 'confirmed',
      'rejected': 'cancelled',
      'cancelled': 'cancelled',
      'completed': 'completed'
    };
    
    // 기본 스케줄 이벤트 생성
    const baseEvent: ScheduleEvent & { assignedTime?: string } = {
      id: docId,
      type: typeMap[data.status] || 'applied',
      date: baseDate,
      startTime: startTimestamp,
      endTime: endTimestamp,
      eventId: (data as any).eventId || data.postId || '',  // eventId 우선 사용, 없으면 postId 사용 (하위 호환성)
      eventName: data.postTitle || '제목 없음',
      location: jobPostingData?.location || '',
      ...(jobPostingData?.detailedAddress && { detailedAddress: jobPostingData.detailedAddress }),
      role: getRoleForApplicationStatus(data, baseDate),
      status: 'not_started' as AttendanceStatus, // 지원 상태에서는 출석 상태가 not_started
      applicationStatus: data.status as 'pending' | 'confirmed' | 'rejected' | 'completed',
      notes: '',
      sourceCollection: 'applications' as const,
      sourceId: docId,
      applicationId: docId,
      // assignedTime 추가 (formatEventTime에서 사용)
      ...(data.assignedTime && { assignedTime: data.assignedTime })
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
          
          // 더 고유한 ID 생성: docId_날짜 형식으로 변경
          const uniqueId = `${docId}_${date.replace(/-/g, '')}`;
          
          const event: ScheduleEvent & { assignedTime?: string } = {
            ...baseEvent,
            id: uniqueId,
            date: date,
            role: getRoleForApplicationStatus(data, date),
            startTime: startTimestamp,
            endTime: endTimestamp,
            // assignedTime 추가 (formatEventTime에서 사용)
            ...(timeStr && { assignedTime: timeStr })
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
export const processWorkLogData = async (
  docId: string,
  data: WorkLogData
): Promise<ScheduleEvent> => {
  // jobPosting 정보 가져오기
  let jobPostingData: JobPostingData | null = null;
  let eventName = '근무'; // 기본값
  let location = '';
  
  if (data.eventId) {
    try {
      const jobPostingDoc = await getDoc(doc(db, 'jobPostings', data.eventId));
      if (jobPostingDoc.exists()) {
        jobPostingData = { 
          id: jobPostingDoc.id, 
          ...jobPostingDoc.data() 
        } as JobPostingData;
        eventName = jobPostingData.title || '근무';
        location = jobPostingData.location || '';
      }
    } catch (error) {
      logger.error('공고 정보 조회 실패:', error instanceof Error ? error : new Error(String(error)), { 
        component: 'processWorkLogData',
        data: { eventId: data.eventId }
      });
    }
  }
  
  // workLogMapper를 통해 정규화된 데이터 사용
  const { normalizeWorkLog } = await import('../../utils/workLogMapper');
  const normalizedLog = normalizeWorkLog(data);
  
  // 예정 시간과 실제 시간 처리 (Timestamp 타입으로 확정)
  const scheduledStart = normalizedLog.scheduledStartTime as Timestamp | null;
  const scheduledEnd = normalizedLog.scheduledEndTime as Timestamp | null;
  const actualStart = normalizedLog.actualStartTime as Timestamp | null;
  const actualEnd = normalizedLog.actualEndTime as Timestamp | null;
  
  // 이미 Timestamp 형태로 정규화되어 있으므로 직접 사용
  const scheduledTimeData = {
    startTime: scheduledStart,
    endTime: scheduledEnd
  };
  
  const actualTimeData = {
    startTime: actualStart,
    endTime: actualEnd
  };
  
  // workLog status 기반 type 설정 (상태 통일)
  const typeMap: Record<string, ScheduleEvent['type']> = {
    'scheduled': 'confirmed',
    'in_progress': 'confirmed',
    'checked_in': 'confirmed', 
    'checked_out': 'completed', // checked_out과 completed 통일
    'completed': 'completed',
    'absent': 'cancelled',
    'cancelled': 'cancelled'
  };
  
  // 출퇴근 완료 여부 확인
  const isCompleted = normalizedLog.status === 'completed' || 
                     normalizedLog.status === ('checked_out' as any) ||
                     (normalizedLog.actualStartTime && normalizedLog.actualEndTime);
  
  // 근무 시간 계산 (분 단위) - 예정 시간 기준으로 변경
  let totalWorkMinutes = 0;
  
  // 예정 시간 기준으로 계산 (스태프탭에서 수정한 시간)
  if (scheduledTimeData.startTime && scheduledTimeData.endTime) {
    // Timestamp 타입 확인 후 toDate() 호출
    if (scheduledTimeData.startTime && 'toDate' in scheduledTimeData.startTime && 
        scheduledTimeData.endTime && 'toDate' in scheduledTimeData.endTime) {
      const start = scheduledTimeData.startTime.toDate();
      const end = scheduledTimeData.endTime.toDate();
      totalWorkMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
    }
  } 
  // QR 기능 활성화 시 실제 시간 사용 - 현재는 주석 처리
  // else if (actualTimeData.startTime && actualTimeData.endTime) {
  //   if (actualTimeData.startTime && 'toDate' in actualTimeData.startTime && 
  //       actualTimeData.endTime && 'toDate' in actualTimeData.endTime) {
  //     const start = actualTimeData.startTime.toDate();
  //     const end = actualTimeData.endTime.toDate();
  //     totalWorkMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
  //   }
  // }
  else if (normalizedLog.totalWorkMinutes) {
    totalWorkMinutes = normalizedLog.totalWorkMinutes;
  } else if (normalizedLog.hoursWorked) {
    totalWorkMinutes = normalizedLog.hoursWorked * 60;
  }
  
  // 급여 계산 (통합 유틸리티 사용)
  let payrollAmount = 0;
  
  // 통합 급여 계산 유틸리티 사용
  if (totalWorkMinutes > 0 && normalizedLog.role) {
    const { calculateSingleWorkLogPayroll } = await import('../../utils/payrollCalculations');
    payrollAmount = calculateSingleWorkLogPayroll(normalizedLog, normalizedLog.role, jobPostingData as any);
  }
  
  return {
    id: docId,
    type: isCompleted ? 'completed' : (typeMap[normalizedLog.status || ''] || 'confirmed'),
    date: normalizedLog.date,
    startTime: scheduledTimeData.startTime,
    endTime: scheduledTimeData.endTime,
    actualStartTime: actualTimeData.startTime,
    actualEndTime: actualTimeData.endTime,
    eventId: normalizedLog.eventId || '',
    eventName: eventName,
    location: location,
    ...(jobPostingData?.detailedAddress && { detailedAddress: jobPostingData.detailedAddress }),
    role: normalizedLog.role || '',
    status: normalizedLog.status as AttendanceStatus || 'not_started',
    notes: normalizedLog.notes || '',
    sourceCollection: 'workLogs' as const,
    sourceId: docId,
    workLogId: docId,
    // 급여 계산 정보 추가 (정산 상태 없이)
    ...(totalWorkMinutes > 0 && {
      payrollAmount: payrollAmount
    })
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