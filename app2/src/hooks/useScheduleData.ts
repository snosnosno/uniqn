import { useState, useEffect, useMemo, useCallback } from 'react';
import { logger } from '../utils/logger';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  Timestamp,
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
// useToast import removed - not used
import { 
  ScheduleEvent, 
  ScheduleFilters,
  ScheduleStats
} from '../types/schedule';
// date-fns imports removed - not used
import { timestampToLocalDateString } from '../utils/dateUtils';
import { getTodayString } from '../utils/jobPosting/dateUtils';
import { 
  safeDateToString, 
  parseTimeString, 
  extractDateFromFields 
} from '../utils/scheduleUtils';

interface UseScheduleDataReturn {
  schedules: ScheduleEvent[];
  loading: boolean;
  error: string | null;
  stats: ScheduleStats;
  filters: ScheduleFilters;
  setFilters: React.Dispatch<React.SetStateAction<ScheduleFilters>>;
  refreshData: () => void;
  getScheduleById: (id: string) => ScheduleEvent | undefined;
}

/**
 * 지원서 상태에 따른 역할 결정 함수 (날짜별 역할 매칭)
 * @param data applications 컬렉션 데이터
 * @param targetDate 대상 날짜 (YYYY-MM-DD 형식)
 * @returns 해당 날짜에 지원한 역할 문자열
 */
const getRoleForApplicationStatus = (data: any, targetDate?: string): string => {
  console.log('🎯 getRoleForApplicationStatus 호출:', {
    status: data.status,
    targetDate,
    assignedRole: data.assignedRole,
    assignedRoles: data.assignedRoles,
    assignedDates: data.assignedDates,
    assignedTimes: data.assignedTimes
  });
  
  // 확정된 경우: 날짜별 확정 역할 찾기
  if (data.status === 'confirmed') {
    // 날짜별 역할 매칭 시도
    if (targetDate && data.assignedDates && data.assignedRoles && 
        Array.isArray(data.assignedDates) && Array.isArray(data.assignedRoles)) {
      
      // 대상 날짜와 일치하는 인덱스 찾기
      const dateIndex = data.assignedDates.findIndex((date: any) => {
        const dateStr = typeof date === 'string' ? date : 
                       date?.toDate ? date.toDate().toISOString().substring(0, 10) :
                       date?.seconds ? new Date(date.seconds * 1000).toISOString().substring(0, 10) :
                       String(date);
        return dateStr === targetDate;
      });
      
      if (dateIndex >= 0 && data.assignedRoles[dateIndex]) {
        const confirmedRole = data.assignedRoles[dateIndex];
        logger.debug('  ✅ 확정 상태 - 날짜별 역할 (${targetDate}):', { component: 'useScheduleData', data: confirmedRole });
        return confirmedRole;
      }
    }
    
    // 날짜별 매칭 실패 시 기본 확정 역할 사용
    const confirmedRole = data.assignedRole || data.confirmedRole || data.role || '';
    logger.debug('  ✅ 확정 상태 - 기본 역할:', { component: 'useScheduleData', data: confirmedRole });
    return confirmedRole;
  }
  
  // 지원중인 경우: 해당 날짜에 지원한 역할만 표시
  if (data.status === 'pending' || data.status === 'applied' || !data.status) {
    
    // 날짜별 역할 매칭 시도
    if (targetDate && data.assignedDates && data.assignedRoles && 
        Array.isArray(data.assignedDates) && Array.isArray(data.assignedRoles)) {
      
      console.log('  📅 날짜별 역할 매칭 시도:', {
        targetDate,
        assignedDates: data.assignedDates,
        assignedRoles: data.assignedRoles
      });
      
      // 해당 날짜의 모든 역할 수집
      const dateRoles: string[] = [];
      data.assignedDates.forEach((date: any, index: number) => {
        const dateStr = typeof date === 'string' ? date : 
                       date?.toDate ? date.toDate().toISOString().substring(0, 10) :
                       date?.seconds ? new Date(date.seconds * 1000).toISOString().substring(0, 10) :
                       String(date);
        
        if (dateStr === targetDate && data.assignedRoles[index]) {
          dateRoles.push(data.assignedRoles[index]);
        }
      });
      
      if (dateRoles.length > 0) {
        const uniqueRoles = Array.from(new Set(dateRoles)); // 중복 제거
        const roleString = uniqueRoles.join(', ');
        logger.debug('  🎭 지원 중 - 날짜별 역할 (${targetDate}):', { component: 'useScheduleData', data: roleString });
        return roleString;
      }
    }
    
    // 날짜별 매칭 실패 시 전체 역할 사용 (fallback)
    const appliedRoles = [];
    
    if (data.assignedRoles && Array.isArray(data.assignedRoles)) {
      appliedRoles.push(...data.assignedRoles);
      logger.debug('  📋 전체 assignedRoles 배열 사용 (fallback):', { component: 'useScheduleData', data: data.assignedRoles });
    } else if (data.assignedRole) {
      appliedRoles.push(data.assignedRole);
      logger.debug('  📝 단일 assignedRole 사용 (fallback):', { component: 'useScheduleData', data: data.assignedRole });
    } else if (data.role) {
      appliedRoles.push(data.role);
      logger.debug('  📝 단일 role 사용 (fallback):', { component: 'useScheduleData', data: data.role });
    }
    
    if (appliedRoles.length > 0) {
      const uniqueRoles = Array.from(new Set(appliedRoles)); // 중복 제거
      const roleString = uniqueRoles.join(', ');
      logger.debug('  🎭 지원 중 - 전체 역할 (fallback):', { component: 'useScheduleData', data: roleString });
      return roleString;
    }
  }
  
  // 기본값
  const defaultRole = data.role || '';
  logger.debug('  ⚠️ 기본값 사용:', { component: 'useScheduleData', data: defaultRole });
  return defaultRole;
};

/**
 * 통합 스케줄 데이터 훅
 * workLogs, applications, staff 컬렉션을 실시간으로 구독하여 통합 스케줄 데이터 제공
 */
export const useScheduleData = (): UseScheduleDataReturn => {
  const { currentUser } = useAuth();
  // showError removed - not used
  
  const [schedules, setSchedules] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 기본 날짜 범위: 지난 1개월부터 앞으로 3개월까지
  const getDefaultDateRange = () => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setMonth(today.getMonth() - 1); // 지난 1개월
    const endDate = new Date(today);
    endDate.setMonth(today.getMonth() + 3); // 앞으로 3개월
    
    const defaultRange = {
      start: startDate.toISOString().substring(0, 10),
      end: endDate.toISOString().substring(0, 10)
    };
    return defaultRange;
  };

  // 필터 상태
  const [filters, setFilters] = useState<ScheduleFilters>({
    dateRange: getDefaultDateRange(),
    searchTerm: ''
  });

  // 데이터 통합 및 변환 함수
  const convertToScheduleEvent = useCallback(async (
    data: any,
    source: 'workLogs' | 'applications' | 'staff',
    docId: string
  ): Promise<ScheduleEvent | ScheduleEvent[] | null> => {
    try {
      
      let scheduleEvent: ScheduleEvent;
      
      if (source === 'workLogs') {
        // workLogs 데이터 변환 - 날짜 처리 단순화
        const dateStr = safeDateToString(data.date);
        
        if (!dateStr) {
          console.warn('WorkLog 날짜 누락:', docId);
        }
        
        scheduleEvent = {
          id: `worklog-${docId}`,
          type: data.actualEndTime ? 'completed' : 'confirmed',
          date: dateStr || '',
          startTime: data.scheduledStartTime,
          endTime: data.scheduledEndTime,
          actualStartTime: data.actualStartTime,
          actualEndTime: data.actualEndTime,
          eventId: data.eventId || data.postId, // postId도 eventId로 사용
          eventName: data.eventName || data.postTitle || '이벤트',
          location: data.location || '',
          role: data.role || '딜러',
          status: data.status || 'not_started',
          sourceCollection: 'workLogs',
          sourceId: docId,
          workLogId: docId,
          // applications 연결 정보 추가
          applicationId: data.applicationId // workLog 생성 시 applicationId 포함하면 연결 가능
        };
        
        // 🔧 날짜 표준화 - 모든 날짜를 YYYY-MM-DD 형식으로 통일
        if (scheduleEvent.date && typeof scheduleEvent.date !== 'string') {
          scheduleEvent.date = safeDateToString(scheduleEvent.date);
        }
        
        // 날짜가 여전히 유효하지 않은 경우 추가 처리
        if (!scheduleEvent.date || scheduleEvent.date === '') {
          logger.warn('⚠️ WorkLog 날짜 변환 실패: ${docId}', { component: 'useScheduleData' });
          // 다른 날짜 필드들 확인
          const fallbackDate = extractDateFromFields(data, ['createdAt', 'updatedAt', 'scheduledDate']);
          if (fallbackDate) {
            scheduleEvent.date = fallbackDate;
            logger.debug('✅ 대체 날짜 사용: ${fallbackDate}', { component: 'useScheduleData' });
          }
        }
      } else if (source === 'applications') {
        // applications 데이터 변환 - 다중 날짜/역할 지원
        
        // 공고 정보 가져오기
        let jobPostingData: any = null;
        if (data.postId) {
          try {
            const postDoc = await getDoc(doc(db, 'jobPostings', data.postId));
            if (postDoc.exists()) {
              jobPostingData = postDoc.data();
              console.log('📝 공고 정보 로드됨:', {
                title: jobPostingData.title,
                dates: jobPostingData.dates,
                startDate: jobPostingData.startDate
              });
            }
          } catch (err) {
            logger.error('공고 정보 조회 오류:', err instanceof Error ? err : new Error(String(err)), { component: 'useScheduleData' });
          }
        }
        
        // 다중 날짜/역할/시간 데이터 확인
        const hasMultipleData = data.assignedDates && data.assignedRoles && data.assignedTimes &&
                               Array.isArray(data.assignedDates) && Array.isArray(data.assignedRoles) && Array.isArray(data.assignedTimes);
        
        console.log('🎯 Application 다중 데이터 확인:', {
          hasMultipleData,
          assignedDates: data.assignedDates,
          assignedRoles: data.assignedRoles,
          assignedTimes: data.assignedTimes
        });
        
        if (hasMultipleData) {
          // 🚀 다중 날짜별 스케줄 이벤트 생성
          const multipleEvents: ScheduleEvent[] = [];
          
          const maxLength = Math.max(data.assignedDates.length, data.assignedRoles.length, data.assignedTimes.length);
          
          for (let i = 0; i < maxLength; i++) {
            const dateData = data.assignedDates[i];
            const timeData = data.assignedTimes[i];
            
            // 날짜 변환
            let dateStr = '';
            if (dateData) {
              dateStr = typeof dateData === 'string' ? dateData : 
                       dateData?.toDate ? dateData.toDate().toISOString().substring(0, 10) :
                       dateData?.seconds ? new Date(dateData.seconds * 1000).toISOString().substring(0, 10) :
                       String(dateData);
            }
            
            if (!dateStr) {
              logger.warn('⚠️ Application 인덱스 ${i}의 날짜 없음, 건너뜀', { component: 'useScheduleData' });
              continue;
            }
            
            const singleEvent: ScheduleEvent = {
              id: `app-${docId}-${i}`, // 인덱스를 포함한 고유 ID
              type: data.status === 'confirmed' ? 'confirmed' : 'applied',
              date: dateStr,
              startTime: null,
              endTime: null,
              eventId: data.postId,
              eventName: data.postTitle || jobPostingData?.title || '미확인 공고',
              location: jobPostingData?.location || '',
              detailedAddress: jobPostingData?.detailedAddress,
              role: getRoleForApplicationStatus(data, dateStr), // 날짜별 역할 매칭 함수 사용
              status: 'not_started',
              applicationStatus: data.status,
              sourceCollection: 'applications',
              sourceId: docId,
              applicationId: docId
            };
            
            // 시간 정보 파싱
            if (timeData && dateStr) {
              logger.debug('⏰ 인덱스 ${i} 시간 파싱: ${timeData}', { component: 'useScheduleData' });
              const { startTime, endTime } = parseTimeString(timeData, dateStr);
              if (startTime && endTime) {
                singleEvent.startTime = startTime;
                singleEvent.endTime = endTime;
                logger.debug('  ✅ 시간 설정 완료: ${timeData}', { component: 'useScheduleData' });
              }
            }
            
            console.log(`📅 Application 다중 이벤트 생성 [${i}]:`, {
              id: singleEvent.id,
              date: singleEvent.date,
              role: singleEvent.role,
              time: timeData
            });
            
            multipleEvents.push(singleEvent);
          }
          
          // 다중 이벤트 반환
          return multipleEvents;
          
        } else {
          // 🔄 단일 날짜/역할 처리 (기존 로직)
          
          // date 필드 변환 - 유틸리티 함수 사용
          const dateFields = ['workDate', 'eventDate', 'assignedDate', 'applicationDate', 'date'];
          let dateStr = extractDateFromFields(data, dateFields);
          
          logger.debug('📅 Application 단일 날짜 필드 검색 완료:', { component: 'useScheduleData', data: dateStr });
          
          // 공고에서 날짜 정보 가져오기 시도
          if (!dateStr && jobPostingData) {
            // 공고 시작일 사용
            const jobDateStr = extractDateFromFields(jobPostingData, ['startDate', 'date']);
            dateStr = jobDateStr;
            logger.debug('  - 공고 날짜 사용: ${dateStr} (${data.postTitle})', { component: 'useScheduleData' });
          }
          
          console.log(`Application 단일 날짜 변환: ${dateStr} (${data.postTitle || '제목없음'})`);
          
          if (!dateStr) {
            logger.debug('⚠️ Application 날짜 없음:', { component: 'useScheduleData', data: data });
          }
          
          scheduleEvent = {
            id: `app-${docId}`,
            type: data.status === 'confirmed' ? 'confirmed' : 'applied',
            date: dateStr,
            startTime: null, // 시간 정보는 assignedTime에서 파싱 필요
            endTime: null,
            eventId: data.postId,
            eventName: data.postTitle || jobPostingData?.title || '미확인 공고',
            location: jobPostingData?.location || '',
            detailedAddress: jobPostingData?.detailedAddress,
            role: getRoleForApplicationStatus(data, dateStr), // 날짜 정보 전달
            status: 'not_started',
            applicationStatus: data.status,
            sourceCollection: 'applications',
            sourceId: docId,
            applicationId: docId
          };
          
          console.log(`Application 단일 생성:`, {
            id: scheduleEvent.id,
            type: scheduleEvent.type,
            status: data.status,
            eventName: scheduleEvent.eventName,
            date: scheduleEvent.date
          });
          
          // assignedTime에서 시간 정보 파싱 - 유틸리티 함수 사용
          if (data.assignedTime && scheduleEvent.date) {
            logger.debug('⏰ 단일 assignedTime 발견: ${data.assignedTime}', { component: 'useScheduleData' });
            
            const { startTime, endTime } = parseTimeString(data.assignedTime, scheduleEvent.date);
            if (startTime && endTime) {
              scheduleEvent.startTime = startTime;
              scheduleEvent.endTime = endTime;
              logger.debug('  ✅ 단일 시간 설정 완료: ${data.assignedTime}', { component: 'useScheduleData' });
            } else {
              logger.debug('  ℹ️ 단일 시간 파싱 실패 또는 미정: ${data.assignedTime}', { component: 'useScheduleData' });
            }
          }
        }
        
        // 🔧 날짜 표준화 - 모든 날짜를 YYYY-MM-DD 형식으로 통일
        if (scheduleEvent && scheduleEvent.date && typeof scheduleEvent.date !== 'string') {
          scheduleEvent.date = safeDateToString(scheduleEvent.date);
          logger.debug('Application 날짜 변환 (Timestamp): ${scheduleEvent.date}', { component: 'useScheduleData' });
        }
        
        // 날짜가 여전히 유효하지 않은 경우 추가 처리
        if (scheduleEvent && (!scheduleEvent.date || scheduleEvent.date === '')) {
          logger.warn('⚠️ Application 날짜 변환 실패: ${docId}', { component: 'useScheduleData' });
          // 지원서의 다른 날짜 필드들 확인
          const fallbackDate = extractDateFromFields(data, ['createdAt', 'updatedAt', 'appliedAt']);
          if (fallbackDate) {
            scheduleEvent.date = fallbackDate;
            logger.debug('✅ 대체 날짜 사용: ${fallbackDate}', { component: 'useScheduleData' });
          } else if (jobPostingData) {
            // 공고 날짜 사용
            const jobFallbackDate = extractDateFromFields(jobPostingData, ['createdAt', 'updatedAt']);
            if (jobFallbackDate) {
              scheduleEvent.date = jobFallbackDate;
              logger.debug('✅ 공고 날짜 사용: ${jobFallbackDate}', { component: 'useScheduleData' });
            }
          }
        }
        
        // assignedDates가 있는 경우 날짜 정보 찾기 (지원/확정 상태 무관)
        if (data.assignedDates) {
          console.log('✅ 일정 상세 분석:', {
            applicationId: docId,
            postTitle: data.postTitle,
            status: data.status,
            hasAssignedDates: !!data.assignedDates
          });
          
          // 모든 필드 순회하며 날짜 관련 필드 찾기
          logger.debug('📊 모든 필드 검사:', { component: 'useScheduleData' });
          Object.keys(data).forEach(key => {
            const value = data[key];
            console.log(`  - ${key}:`, {
              type: typeof value,
              value: value,
              isTimestamp: value && typeof value === 'object' && value.seconds !== undefined
            });
            
            // 날짜와 관련된 모든 필드 체크
            if (key.toLowerCase().includes('date') || 
                key.toLowerCase().includes('time') || 
                key.toLowerCase().includes('schedule') ||
                key.toLowerCase().includes('day') ||
                key.toLowerCase().includes('work')) {
              logger.debug('    💡 날짜 관련 필드 발견: ${key}', { component: 'useScheduleData' });
            }
          });
          
          // assignedDates 배열 확인 (확정된 일정의 날짜들)
          if (data.assignedDates && Array.isArray(data.assignedDates)) {
            console.log('📅 assignedDates 배열 발견:', {
              length: data.assignedDates.length,
              dates: data.assignedDates
            });
            
            // 모든 날짜 변환 시도
            const convertedDates: string[] = [];
            data.assignedDates.forEach((dateItem: any, index: number) => {
              let convertedDate = '';
              
              if (typeof dateItem === 'string') {
                // 문자열로 저장된 Timestamp 처리
                if (dateItem.includes('Timestamp(')) {
                  const match = dateItem.match(/seconds=(\d+)/);
                  if (match && match[1]) {
                    const seconds = parseInt(match[1]);
                    const isoString = new Date(seconds * 1000).toISOString();
                    const datePart = isoString.substring(0, 10);
                    convertedDate = datePart || '';
                  }
                } else {
                  convertedDate = dateItem;
                }
              } else if (typeof dateItem === 'object') {
                if (dateItem.toDate && typeof dateItem.toDate === 'function') {
                  const isoString = dateItem.toDate().toISOString();
                  const datePart = isoString.substring(0, 10);
                  convertedDate = datePart || '';
                } else if (dateItem.seconds) {
                  const isoString = new Date(dateItem.seconds * 1000).toISOString();
                  const datePart = isoString.substring(0, 10);
                  convertedDate = datePart || '';
                }
              }
              
              if (convertedDate) {
                convertedDates.push(convertedDate);
                logger.debug('  [${index}] 날짜 변환 성공: ${convertedDate}', { component: 'useScheduleData' });
              }
            });
            
            // 여러 날짜가 있으면 각 날짜마다 이벤트 생성
            if (convertedDates.length > 0) {
              if (convertedDates.length > 1) {
                logger.debug('📆 여러 날짜 이벤트 생성: ${convertedDates.length}개', { component: 'useScheduleData' });
                
                // 각 날짜마다 별도의 스케줄 이벤트 생성
                const multipleEvents: ScheduleEvent[] = [];
                
                convertedDates.forEach((date, index) => {
                  const eventCopy = { ...scheduleEvent };
                  eventCopy.id = `${scheduleEvent.id}-day${index + 1}`;
                  eventCopy.date = date;
                  
                  // 시간 정보 처리 - assignedTimes 배열이 있으면 해당 인덱스 사용
                  let timeInfo = null;
                  
                  if (data.assignedTimes && Array.isArray(data.assignedTimes) && data.assignedTimes[index]) {
                    timeInfo = data.assignedTimes[index];
                    logger.debug('    assignedTimes[${index}]: ${timeInfo}', { component: 'useScheduleData' });
                  } else if (data.assignedTime) {
                    timeInfo = data.assignedTime;
                    logger.debug('    assignedTime 사용: ${timeInfo}', { component: 'useScheduleData' });
                  }
                  
                  if (timeInfo && timeInfo !== '미정' && timeInfo.includes('-')) {
                    const [startStr, endStr] = timeInfo.split('-');
                    const dateObj = new Date(date);
                    
                    // 시작 시간
                    const [startHour, startMin] = startStr.trim().split(':').map(Number);
                    const startDate = new Date(dateObj);
                    startDate.setHours(startHour, startMin, 0, 0);
                    eventCopy.startTime = Timestamp.fromDate(startDate);
                    
                    // 종료 시간
                    const [endHour, endMin] = endStr.trim().split(':').map(Number);
                    let endDate = new Date(dateObj);
                    endDate.setHours(endHour, endMin, 0, 0);
                    
                    if (endHour < startHour) {
                      endDate.setDate(endDate.getDate() + 1);
                    }
                    
                    eventCopy.endTime = Timestamp.fromDate(endDate);
                    logger.debug('    시간 설정: ${timeInfo}', { component: 'useScheduleData' });
                  } else {
                    console.log(`    시간: ${timeInfo || '미정'}`);
                  }
                  
                  // 날짜를 한국어 형식으로 표시
                  const dateObj = new Date(date + 'T00:00:00');
                  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
                  const dayOfWeek = dayNames[dateObj.getDay()] || '';
                  
                  logger.debug('  [Day ${index + 1}] ${date} (${dayOfWeek}): ${eventCopy.eventName}', { component: 'useScheduleData' });
                  multipleEvents.push(eventCopy);
                });
                
                logger.debug('✅ ${multipleEvents.length}개의 이벤트 생성 완료', { component: 'useScheduleData' });
                return multipleEvents;
              } else {
                // 단일 날짜
                const firstDate = convertedDates[0];
                if (firstDate) {
                  scheduleEvent.date = firstDate;
                  logger.debug('✅ assignedDates에서 날짜 설정 완료: ${scheduleEvent.date}', { component: 'useScheduleData' });
                }
              }
            }
          }
          
          // assignedDate 단일 필드 확인
          if (!scheduleEvent.date && data.assignedDate) {
            let assignedDate = data.assignedDate;
            
            // Timestamp 객체 변환 - 유틸리티 함수 사용
            assignedDate = safeDateToString(assignedDate);
            
            scheduleEvent.date = assignedDate;
            logger.debug('✅ assignedDate에서 날짜 설정: ${assignedDate}', { component: 'useScheduleData' });
          }
          
          // assignedSchedules 배열 확인 (다른 형태일 수도 있음)
          if (!scheduleEvent.date && data.assignedSchedules) {
            logger.debug('📅 assignedSchedules 발견:', { component: 'useScheduleData', data: data.assignedSchedules });
            
            // 배열인 경우 각 요소 확인
            if (Array.isArray(data.assignedSchedules)) {
              data.assignedSchedules.forEach((schedule: any, index: number) => {
                logger.debug('  스케줄 ${index}:', { component: 'useScheduleData', data: schedule });
                
                // 날짜 찾기
                if (schedule.date) {
                  let assignedDate = schedule.date;
                  // 유틸리티 함수로 날짜 변환
                  assignedDate = safeDateToString(assignedDate);
                  
                  // 첫 번째 날짜만 사용 (나중에 여러 날짜 지원 가능)
                  if (index === 0) {
                    scheduleEvent.date = assignedDate;
                    logger.debug('✅ assignedSchedules에서 날짜 설정: ${assignedDate}', { component: 'useScheduleData' });
                  }
                }
              });
            }
          }
          
          // confirmedSchedules 필드 확인 (다른 이름일 수도 있음)
          if (data.confirmedSchedules) {
            logger.debug('📅 confirmedSchedules 발견:', { component: 'useScheduleData', data: data.confirmedSchedules });
          }
          
          // 날짜가 여전히 없으면 공고 정보에서 가져오기
          if (!scheduleEvent.date && jobPostingData) {
            logger.debug('🔍 공고 정보에서 날짜 찾기:', { component: 'useScheduleData', data: jobPostingData });
            
            // 공고의 다양한 날짜 필드 확인
            const possibleDateFields = ['date', 'startDate', 'eventDate', 'dates', 'eventDates'];
            
            for (const field of possibleDateFields) {
              if (jobPostingData[field]) {
                logger.debug('  - ${field}:', { component: 'useScheduleData', data: jobPostingData[field] });
                
                let dateValue = jobPostingData[field];
                
                // 배열인 경우 첫 번째 값 사용
                if (Array.isArray(dateValue) && dateValue.length > 0) {
                  dateValue = dateValue[0];
                }
                
                // Timestamp 변환
                if (typeof dateValue === 'object') {
                  if (dateValue.toDate && typeof dateValue.toDate === 'function') {
                    scheduleEvent.date = timestampToLocalDateString(dateValue);
                  } else if (dateValue.seconds) {
                    scheduleEvent.date = timestampToLocalDateString(dateValue);
                  }
                } else if (typeof dateValue === 'string') {
                  scheduleEvent.date = dateValue;
                }
                
                if (scheduleEvent.date) {
                  logger.debug('✅ 공고의 ${field}에서 날짜 설정: ${scheduleEvent.date}', { component: 'useScheduleData' });
                  break;
                }
              }
            }
            
            // 그래도 날짜가 없으면 오늘 날짜 사용 (임시)
            if (!scheduleEvent.date) {
              const today = getTodayString();
              scheduleEvent.date = today;
              logger.debug('⚠️ 날짜를 찾을 수 없어 오늘 날짜 사용: ${today}', { component: 'useScheduleData' });
            }
          }
        }
      } else {
        // staff 데이터 변환
        // date 필드 변환
        let dateStr: any = data.assignedDate || '';
        
        // 날짜 변환
        if (dateStr) {
          if (typeof dateStr === 'string' && dateStr.includes('Timestamp(')) {
            // 문자열로 저장된 Timestamp 처리
            const match = dateStr.match(/seconds=(\d+)/);
            if (match && match[1]) {
              const seconds = parseInt(match[1]);
              const isoString = new Date(seconds * 1000).toISOString();
              const datePart = isoString.substring(0, 10);
              dateStr = datePart || '';
              logger.debug('Staff Timestamp 문자열 변환: ${dateStr}', { component: 'useScheduleData' });
            }
          } else if (typeof dateStr === 'object') {
            // 유틸리티 함수로 날짜 변환
            dateStr = safeDateToString(dateStr);
          }
        }
        
        console.log(`Staff 날짜 변환: ${dateStr} (${data.postingTitle || '제목없음'})`);
        
        if (!dateStr) {
          logger.debug('⚠️ Staff 날짜 없음:', { component: 'useScheduleData', data: data });
        }
        
        // 문자열로 확실히 변환
        if (typeof dateStr !== 'string') {
          dateStr = '';
        }
        
        scheduleEvent = {
          id: `staff-${docId}`,
          type: 'confirmed',
          date: dateStr,
          startTime: null,
          endTime: null,
          eventId: data.postingId,
          eventName: data.postingTitle || '이벤트',
          location: '',
          role: data.assignedRole || data.role || '',
          status: 'not_started',
          sourceCollection: 'staff',
          sourceId: docId
        };
        
        // 날짜가 여전히 Timestamp 객체인 경우 처리
        if (scheduleEvent.date && typeof scheduleEvent.date === 'object' && (scheduleEvent.date as any).seconds) {
          const isoString = new Date((scheduleEvent.date as any).seconds * 1000).toISOString();
          const datePart = isoString.substring(0, 10);
          scheduleEvent.date = datePart || '';
          logger.debug('Staff 날짜 변환: ${scheduleEvent.date}', { component: 'useScheduleData' });
        }
        
        // assignedTime에서 시간 정보 파싱 - 유틸리티 함수 사용
        if (data.assignedTime && scheduleEvent.date) {
          const { startTime, endTime } = parseTimeString(data.assignedTime, scheduleEvent.date);
          if (startTime && endTime) {
            scheduleEvent.startTime = startTime;
            scheduleEvent.endTime = endTime;
          }
        }
      }
      
      // 최종 날짜 확인 및 변환 - 유틸리티 함수 사용
      if (scheduleEvent.date && typeof scheduleEvent.date === 'object') {
        scheduleEvent.date = safeDateToString(scheduleEvent.date);
        logger.debug('최종 날짜 변환 (${source}): ${scheduleEvent.date} - ${scheduleEvent.eventName}', { component: 'useScheduleData' });
      }
      
      // 날짜가 없으면 null 반환
      if (!scheduleEvent.date || scheduleEvent.date === '') {
        console.error(`❌ 날짜 없는 스케줄 제외:`, {
          source,
          id: docId,
          eventName: scheduleEvent.eventName,
          type: scheduleEvent.type,
          rawData: data
        });
        return null;
      }
      
      // 최종 생성된 이벤트 로그
      console.log(`✅ [${source}] 스케줄 이벤트 생성 완료:`, {
        id: scheduleEvent.id,
        type: scheduleEvent.type,
        date: scheduleEvent.date,
        eventName: scheduleEvent.eventName,
        status: scheduleEvent.status
      });
      
      return scheduleEvent;
    } catch (error) {
      logger.error('${source} 데이터 변환 오류:', error instanceof Error ? error : new Error(String(error)), { component: 'useScheduleData' });
      return null;
    }
  }, []);

  // 실시간 데이터 구독
  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    logger.debug('🔍 스케줄 데이터 실시간 구독 시작', { component: 'useScheduleData' });
    const unsubscribes: (() => void)[] = [];

    // 스케줄 데이터 업데이트 함수
    const schedulesBySource: Record<string, ScheduleEvent[]> = {
      workLogs: [],
      applications: [],
      staff: []
    };

    const updateAllSchedules = (source: string, newSchedules: ScheduleEvent[]) => {
      schedulesBySource[source] = newSchedules;
      logger.debug('📊 ${source} 스케줄 업데이트:', { component: 'useScheduleData', data: newSchedules.length });
      
      // 모든 소스의 스케줄 통합
      const merged = [
        ...(schedulesBySource.workLogs || []),
        ...(schedulesBySource.applications || []),
        ...(schedulesBySource.staff || [])
      ];
      
      console.log('📊 통합 전 스케줄 수:', {
        workLogs: schedulesBySource.workLogs?.length || 0,
        applications: schedulesBySource.applications?.length || 0,
        staff: schedulesBySource.staff?.length || 0,
        total: merged.length
      });
      
      // 🔥 개선된 중복 제거 로직 - 더 정확한 키 생성 및 우선순위 적용
      const uniqueSchedules = merged.reduce((acc, schedule) => {
        // 더 정확한 중복 감지 키 생성 (날짜, 이벤트ID, 역할, 시간)
        const startTimeStr = schedule.startTime ? 
          schedule.startTime.toDate().toTimeString().substring(0, 5) : 'no-time';
        const endTimeStr = schedule.endTime ? 
          schedule.endTime.toDate().toTimeString().substring(0, 5) : 'no-time';
        
        // 🔧 중복 감지 키에서 role 제외 - 같은 이벤트/날짜/시간이면 역할 무관하게 통합
        const key = `${schedule.date}-${schedule.eventId || 'no-event'}-${startTimeStr}-${endTimeStr}`;
        
        if (!acc.has(key)) {
          acc.set(key, schedule);
          logger.debug('✅ 새 일정 추가: ${schedule.eventName} (${schedule.sourceCollection})', { component: 'useScheduleData' });
        } else {
          const existing = acc.get(key)!;
          
          // 우선순위: workLogs > applications > staff
          const priorityOrder = { workLogs: 3, applications: 2, staff: 1 };
          const currentPriority = priorityOrder[schedule.sourceCollection];
          const existingPriority = priorityOrder[existing.sourceCollection];
          
          if (currentPriority > existingPriority) {
            // 높은 우선순위로 대체
            const updatedSchedule = { ...schedule };
            
            // 🎯 상태별 역할 통합 로직
            if (schedule.type === 'confirmed' || existing.type === 'confirmed') {
              // 확정된 일정이 있으면 확정 역할만 표시 (workLogs에서 오는 경우가 많음)
              updatedSchedule.role = schedule.role || existing.role;
              logger.debug('✅ 확정 역할 사용: ${updatedSchedule.role}', { component: 'useScheduleData' });
            } else if (schedule.type === 'applied' && existing.type === 'applied') {
              // 둘 다 지원중이면 모든 지원 역할 통합
              const existingRoles = existing.role.split(', ').filter(r => r.trim());
              const scheduleRoles = schedule.role.split(', ').filter(r => r.trim());
              const allRoles = existingRoles.concat(scheduleRoles);
              const uniqueRoles = Array.from(new Set(allRoles));
              updatedSchedule.role = uniqueRoles.join(', ');
              logger.debug('👥 지원 역할 통합: ${updatedSchedule.role}', { component: 'useScheduleData' });
            }
            
            acc.set(key, updatedSchedule);
            logger.debug('🔄 중복 대체: ${existing.sourceCollection} → ${schedule.sourceCollection} (${schedule.eventName})', { component: 'useScheduleData' });
          } else if (currentPriority === existingPriority) {
            // 같은 우선순위면 역할 정보만 통합
            const existingSchedule = acc.get(key)!;
            
            if (existingSchedule.type === 'applied' && schedule.type === 'applied') {
              // 둘 다 지원중이면 역할 추가
              const existingRoles = existingSchedule.role.split(', ').filter(r => r.trim());
              const newRoles = schedule.role.split(', ').filter(r => r.trim());
              const allRoles = existingRoles.concat(newRoles);
              const uniqueRoles = Array.from(new Set(allRoles));
              existingSchedule.role = uniqueRoles.join(', ');
              logger.debug('👥 동급 지원 역할 통합: ${existingSchedule.role}', { component: 'useScheduleData' });
            }
          } else {
            logger.debug('🔒 중복 유지: ${existing.sourceCollection} 우선 유지 (${schedule.eventName})', { component: 'useScheduleData' });
          }
        }
        
        return acc;
      }, new Map<string, ScheduleEvent>());
      
      const sortedSchedules = Array.from(uniqueSchedules.values()).sort((a, b) => {
        // 날짜 내림차순 정렬 (date는 이미 문자열로 변환됨)
        return (b.date || '').localeCompare(a.date || '');
      });
      
      setSchedules(sortedSchedules);
      setLoading(false);
      logger.debug('✅ 전체 스케줄 업데이트 완료:', { component: 'useScheduleData', data: sortedSchedules.length });
    };

    // 1. workLogs 구독
    const workLogsQuery = query(
      collection(db, 'workLogs'),
      where('dealerId', '==', currentUser.uid)
      // orderBy는 인덱스 문제로 클라이언트 측에서 정렬
    );

    const unsubWorkLogs = onSnapshot(
      workLogsQuery,
      async (snapshot) => {
        logger.debug('📊 workLogs 업데이트, 문서 수:', { component: 'useScheduleData', data: snapshot.size });
        
        const workLogSchedules: ScheduleEvent[] = [];
        for (const doc of snapshot.docs) {
          logger.debug('WorkLog 문서:', { component: 'useScheduleData', data: { id: doc.id, data: doc.data() } });
          const result = await convertToScheduleEvent(doc.data(), 'workLogs', doc.id);
          if (result) {
            if (Array.isArray(result)) {
              workLogSchedules.push(...result);
            } else {
              workLogSchedules.push(result);
            }
          }
        }
        
        // 전체 스케줄 업데이트
        updateAllSchedules('workLogs', workLogSchedules);
      },
      (error: any) => {
        logger.error('❌ workLogs 구독 오류:', error instanceof Error ? error : new Error(String(error)), { component: 'useScheduleData' });
        logger.error('오류 코드:', error.code instanceof Error ? error.code : new Error(String(error.code)), { component: 'useScheduleData' });
        logger.error('오류 메시지:', error.message instanceof Error ? error.message : new Error(String(error.message)), { component: 'useScheduleData' });
        logger.error('전체 오류 객체:', error instanceof Error ? error : new Error(String(error)), { component: 'useScheduleData' });
        
        // Firestore 인덱스 오류인 경우 안내
        if (error.message?.includes('index') || error.code === 'failed-precondition') {
          logger.error('🔥 Firestore 인덱스가 필요합니다. 콘솔에서 제공하는 링크를 클릭하여 인덱스를 생성하세요.', new Error('🔥 Firestore 인덱스가 필요합니다. 콘솔에서 제공하는 링크를 클릭하여 인덱스를 생성하세요.'), { component: 'useScheduleData' });
        }
        
        // INTERNAL ASSERTION FAILED 오류 처리
        if (error.message?.includes('INTERNAL ASSERTION FAILED')) {
          logger.error('⚠️ Firestore 내부 오류 발생. 쿼리를 단순화합니다.', new Error('⚠️ Firestore 내부 오류 발생. 쿼리를 단순화합니다.'), { component: 'useScheduleData' });
          // 단순한 쿼리로 재시도
          const simpleQuery = query(
            collection(db, 'workLogs'),
            where('dealerId', '==', currentUser.uid)
          );
          
          // 간단한 쿼리로 재구독
          const retryUnsub = onSnapshot(
            simpleQuery,
            async (snapshot) => {
              logger.debug('📊 workLogs 재시도 성공, 문서 수:', { component: 'useScheduleData', data: snapshot.size });
              const workLogSchedules: ScheduleEvent[] = [];
              for (const doc of snapshot.docs) {
                const result = await convertToScheduleEvent(doc.data(), 'workLogs', doc.id);
                if (result) {
                  if (Array.isArray(result)) {
                    workLogSchedules.push(...result);
                  } else {
                    workLogSchedules.push(result);
                  }
                }
              }
              updateAllSchedules('workLogs', workLogSchedules);
            },
            (retryError) => {
              logger.error('❌ workLogs 재시도도 실패:', retryError instanceof Error ? retryError : new Error(String(error)), { component: 'useScheduleData' });
              setError('근무 기록을 불러오는 중 오류가 발생했습니다.');
            }
          );
          
          // 재시도 구독도 정리 대상에 추가
          unsubscribes.push(retryUnsub);
          return;
        }
        
        setError('근무 기록을 불러오는 중 오류가 발생했습니다.');
      }
    );
    unsubscribes.push(unsubWorkLogs);

    // 2. applications 구독
    const applicationsQuery = query(
      collection(db, 'applications'),
      where('applicantId', '==', currentUser.uid)
    );

    const unsubApplications = onSnapshot(
      applicationsQuery,
      async (snapshot) => {
        logger.debug('📊 applications 업데이트, 문서 수:', { component: 'useScheduleData', data: snapshot.size });
        
        const applicationSchedules: ScheduleEvent[] = [];
        for (const doc of snapshot.docs) {
          logger.debug('Application 문서:', { component: 'useScheduleData', data: { id: doc.id, data: doc.data() } });
          const result = await convertToScheduleEvent(doc.data(), 'applications', doc.id);
          if (result) {
            if (Array.isArray(result)) {
              logger.debug(`📅 ${result.length}개의 날짜별 이벤트 추가`, { component: 'useScheduleData' });
              applicationSchedules.push(...result);
            } else {
              applicationSchedules.push(result);
            }
          } else {
            logger.debug('❌ Application 스케줄 변환 실패:', { component: 'useScheduleData', data: doc.id });
          }
        }
        
        updateAllSchedules('applications', applicationSchedules);
      },
      (error) => {
        logger.error('❌ applications 구독 오류:', error instanceof Error ? error : new Error(String(error)), { component: 'useScheduleData' });
      }
    );
    unsubscribes.push(unsubApplications);

    // 3. staff 구독
    const staffQuery = query(
      collection(db, 'staff'),
      where('userId', '==', currentUser.uid)
    );

    const unsubStaff = onSnapshot(
      staffQuery,
      async (snapshot) => {
        logger.debug('📊 staff 업데이트, 문서 수:', { component: 'useScheduleData', data: snapshot.size });
        
        const staffSchedules: ScheduleEvent[] = [];
        for (const doc of snapshot.docs) {
          logger.debug('Staff 문서:', { component: 'useScheduleData', data: { id: doc.id, data: doc.data() } });
          const result = await convertToScheduleEvent(doc.data(), 'staff', doc.id);
          if (result) {
            if (Array.isArray(result)) {
              staffSchedules.push(...result);
            } else {
              staffSchedules.push(result);
            }
          } else {
            logger.debug('❌ Staff 스케줄 변환 실패:', { component: 'useScheduleData', data: doc.id });
          }
        }
        
        updateAllSchedules('staff', staffSchedules);
      },
      (error) => {
        logger.error('❌ staff 구독 오류:', error instanceof Error ? error : new Error(String(error)), { component: 'useScheduleData' });
      }
    );
    unsubscribes.push(unsubStaff);

    // 클린업
    return () => {
      logger.debug('🧹 스케줄 데이터 구독 해제', { component: 'useScheduleData' });
      unsubscribes.forEach(unsub => unsub());
    };
  }, [currentUser, convertToScheduleEvent]);

  // 필터링된 스케줄
  const filteredSchedules = useMemo(() => {
    logger.debug('\n🔍 ========== 필터링 시작 ==========', { component: 'useScheduleData' });
    logger.debug('전체 스케줄 수:', { component: 'useScheduleData', data: schedules.length });
    console.log('필터 설정:', {
      dateRange: filters.dateRange,
      searchTerm: filters.searchTerm
    });
    
    // 전체 스케줄 상세 로그
    schedules.forEach((schedule, index) => {
      console.log(`[${index}] 스케줄:`, {
        id: schedule.id,
        type: schedule.type,
        date: schedule.date,
        dateType: typeof schedule.date,
        eventName: schedule.eventName,
        status: schedule.status
      });
    });
    
    let filtered = [...schedules];

    // 타입 및 상태 필터 제거됨

    // 날짜 범위 필터
    const beforeDateFilter = filtered.length;
    console.log('\n📅 날짜 범위 필터링:', {
      start: filters.dateRange.start,
      end: filters.dateRange.end
    });
    
    filtered = filtered.filter(s => {
      // 날짜가 문자열이 아닌 경우 처리
      let dateStr: string = s.date;
      
      if (!dateStr) {
        logger.debug('❌ 날짜 없음 제외: ${s.eventName} (${s.id})', { component: 'useScheduleData' });
        return false;
      }
      
      // Timestamp 객체인 경우 문자열로 변환 - 유틸리티 함수 사용
      if (typeof dateStr === 'object') {
        logger.debug('⚠️ 날짜가 여전히 객체임: ${s.eventName}', { component: 'useScheduleData' });
        
        const convertedDate = safeDateToString(dateStr);
        if (convertedDate) {
          dateStr = convertedDate;
          logger.debug('  → 날짜 변환 완료: ${dateStr}', { component: 'useScheduleData' });
        } else {
          logger.debug('  → 변환 실패, 제외', { component: 'useScheduleData' });
          return false;
        }
      }
      
      const isInRange = dateStr >= filters.dateRange.start && dateStr <= filters.dateRange.end;
      
      if (isInRange) {
        logger.debug('✅ 날짜 범위 내: ${dateStr} - ${s.eventName}', { component: 'useScheduleData' });
      } else {
        logger.debug('❌ 날짜 범위 밖: ${dateStr} - ${s.eventName}', { component: 'useScheduleData' });
      }
      
      return isInRange;
    });
    
    logger.debug('\n날짜 필터 결과: ${beforeDateFilter}개 → ${filtered.length}개', { component: 'useScheduleData' });

    // 검색어 필터
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(s => 
        s.eventName.toLowerCase().includes(searchLower) ||
        s.location.toLowerCase().includes(searchLower) ||
        s.role.toLowerCase().includes(searchLower)
      );
    }

    logger.debug('\n✅ ========== 필터링 완료 ==========', { component: 'useScheduleData' });
    logger.debug('최종 필터링 결과:', { component: 'useScheduleData', data: filtered.length });
    logger.debug('필터링된 스케줄 상세:', { component: 'useScheduleData' });
    filtered.forEach((schedule, index) => {
      console.log(`  [${index}]`, {
        date: schedule.date,
        eventName: schedule.eventName,
        type: schedule.type
      });
    });
    logger.debug('========================================\n', { component: 'useScheduleData' });
    
    return filtered;
  }, [schedules, filters]);

  // 통계 계산
  const stats = useMemo((): ScheduleStats => {
    const now = new Date();
    const thisMonth = now.toISOString().slice(0, 7); // YYYY-MM

    const completed = schedules.filter(s => s.type === 'completed');
    const todayDateStr = safeDateToString(now);
    const upcoming = schedules.filter(s => 
      s.type === 'confirmed' && s.date >= todayDateStr
    );

    const thisMonthSchedules = completed.filter(s => s.date.startsWith(thisMonth));

    // 총 근무 시간 계산
    const totalHours = completed.reduce((sum, s) => {
      if (s.actualStartTime && s.actualEndTime) {
        const start = s.actualStartTime.toDate();
        const end = s.actualEndTime.toDate();
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        return sum + hours;
      }
      return sum;
    }, 0);

    return {
      totalSchedules: schedules.length,
      completedSchedules: completed.length,
      upcomingSchedules: upcoming.length,
      totalEarnings: completed.reduce((sum, s) => sum + (s.payrollAmount || 0), 0),
      thisMonthEarnings: thisMonthSchedules.reduce((sum, s) => sum + (s.payrollAmount || 0), 0),
      hoursWorked: Math.round(totalHours * 10) / 10
    };
  }, [schedules]);

  // 특정 스케줄 조회
  const getScheduleById = useCallback((id: string) => {
    return schedules.find(s => s.id === id);
  }, [schedules]);

  // 데이터 새로고침 (필요시)
  const refreshData = useCallback(() => {
    logger.debug('🔄 스케줄 데이터 새로고침 (실시간 구독 중이므로 자동 업데이트)', { component: 'useScheduleData' });
  }, []);

  return {
    schedules: filteredSchedules, // 필터링된 전체 데이터
    loading,
    error,
    stats,
    filters,
    setFilters,
    refreshData,
    getScheduleById
  };
};