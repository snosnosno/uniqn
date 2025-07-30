import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  Timestamp,
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { 
  ScheduleEvent, 
  ScheduleType, 
  AttendanceStatus,
  ScheduleFilters,
  ScheduleStats
} from '../types/schedule';
import { subDays, addDays, format } from 'date-fns';
import { timestampToLocalDateString } from '../utils/dateUtils';
import { getTodayString } from '../utils/jobPosting/dateUtils';

// 안전한 ISO 날짜 문자열 추출 함수
const safeExtractDateFromISO = (isoString: string): string => {
  const parts = isoString.split('T');
  return parts[0] || '';
};

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
 * 통합 스케줄 데이터 훅
 * workLogs, applications, staff 컬렉션을 실시간으로 구독하여 통합 스케줄 데이터 제공
 */
export const useScheduleData = (): UseScheduleDataReturn => {
  const { currentUser } = useAuth();
  const { showError } = useToast();
  
  const [schedules, setSchedules] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 기본 날짜 범위: 2025년 전체를 포함하도록 설정
  const getDefaultDateRange = () => {
    // 개발 중이므로 2025년 전체 데이터를 볼 수 있도록 설정
    const defaultRange = {
      start: '2025-01-01',
      end: '2025-12-31'
    };
    console.log('📆 기본 날짜 범위:', defaultRange);
    return defaultRange;
  };

  // 필터 상태
  const [filters, setFilters] = useState<ScheduleFilters>({
    type: 'all',
    status: 'all',
    dateRange: getDefaultDateRange()
  });

  // 데이터 통합 및 변환 함수
  const convertToScheduleEvent = useCallback(async (
    data: any,
    source: 'workLogs' | 'applications' | 'staff',
    docId: string
  ): Promise<ScheduleEvent | ScheduleEvent[] | null> => {
    try {
      console.log(`\n🔍 [${source}] 데이터 변환 시작:`, {
        docId,
        rawData: data
      });
      
      let scheduleEvent: ScheduleEvent;
      
      if (source === 'workLogs') {
        // workLogs 데이터 변환
        // date 필드가 Timestamp인 경우 문자열로 변환
        let dateStr: any = data.date;
        
        // 날짜 변환
        if (dateStr) {
          if (typeof dateStr === 'object') {
            if (dateStr.toDate && typeof dateStr.toDate === 'function') {
              // Firestore Timestamp
              const isoString = dateStr.toDate().toISOString();
              dateStr = safeExtractDateFromISO(isoString);
            } else if (dateStr.seconds) {
              // Timestamp 객체 (seconds/nanoseconds)
              const isoString = new Date(dateStr.seconds * 1000).toISOString();
              dateStr = safeExtractDateFromISO(isoString);
            } else if (dateStr instanceof Date) {
              // JavaScript Date
              const isoString = dateStr.toISOString();
              dateStr = safeExtractDateFromISO(isoString);
            } else {
              console.log('⚠️ WorkLog - 알 수 없는 날짜 객체 타입:', dateStr);
              dateStr = '';
            }
          }
        }
        
        console.log(`WorkLog 날짜 변환: ${dateStr} (${data.eventName || '이벤트'})`);
        
        if (!dateStr) {
          console.log('⚠️ WorkLog 날짜 없음:', data);
        }
        
        scheduleEvent = {
          id: `worklog-${docId}`,
          type: data.actualEndTime ? 'completed' : 'confirmed',
          date: dateStr || '',
          startTime: data.scheduledStartTime,
          endTime: data.scheduledEndTime,
          actualStartTime: data.actualStartTime,
          actualEndTime: data.actualEndTime,
          eventId: data.eventId,
          eventName: data.eventName || '이벤트',
          location: data.location || '',
          role: data.role || '딜러',
          status: data.status || 'not_started',
          sourceCollection: 'workLogs',
          sourceId: docId,
          workLogId: docId
        };
        
        // 날짜가 여전히 Timestamp 객체인 경우 처리
        if (scheduleEvent.date && typeof scheduleEvent.date === 'object' && (scheduleEvent.date as any).seconds) {
          const isoString = new Date((scheduleEvent.date as any).seconds * 1000).toISOString();
          const datePart = isoString.split('T')[0];
          scheduleEvent.date = datePart || '';
          console.log(`WorkLog 날짜 변환: ${scheduleEvent.date}`);
        }
      } else if (source === 'applications') {
        // applications 데이터 변환
        console.log('📋 Application 데이터 처리:', {
          status: data.status,
          postTitle: data.postTitle,
          applicantId: data.applicantId
        });
        
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
            console.error('공고 정보 조회 오류:', err);
          }
        }
        
        // date 필드 변환 - 다양한 필드 이름 확인
        let dateStr: any = '';
        
        // 다양한 날짜 필드 확인
        const dateFields = ['workDate', 'eventDate', 'assignedDate', 'applicationDate', 'date'];
        
        console.log('📅 Application 날짜 필드 검색:');
        for (const field of dateFields) {
          if (data[field]) {
            console.log(`  - ${field}: ${data[field]} (타입: ${typeof data[field]})`);
            
            // 문자열로 저장된 Timestamp 처리
            if (typeof data[field] === 'string' && data[field].includes('Timestamp(')) {
              // "Timestamp(seconds=1753747200, nanoseconds=0)" 형태 파싱
              const match = data[field].match(/seconds=(\d+)/);
              if (match && match[1]) {
                const seconds = parseInt(match[1]);
                const isoString = new Date(seconds * 1000).toISOString();
                dateStr = safeExtractDateFromISO(isoString);
                console.log(`    → 문자열 Timestamp 변환: ${dateStr}`);
                break;
              }
            } else {
              dateStr = data[field];
              break;
            }
          }
        }
        
        // 공고에서 날짜 정보 가져오기 시도
        if (!dateStr && jobPostingData) {
          // 공고 시작일 사용
          dateStr = jobPostingData.startDate || jobPostingData.date || '';
          console.log(`  - 공고 날짜 사용: ${dateStr} (${data.postTitle})`);
        }
        
        // 날짜 변환
        if (dateStr) {
          if (typeof dateStr === 'object') {
            if (dateStr.toDate && typeof dateStr.toDate === 'function') {
              const isoString = dateStr.toDate().toISOString();
              dateStr = safeExtractDateFromISO(isoString);
            } else if (dateStr.seconds) {
              // Timestamp 객체 (seconds/nanoseconds)
              const isoString = new Date(dateStr.seconds * 1000).toISOString();
              dateStr = safeExtractDateFromISO(isoString);
            } else if (dateStr instanceof Date) {
              const isoString = dateStr.toISOString();
              dateStr = safeExtractDateFromISO(isoString);
            } else {
              console.log('⚠️ 알 수 없는 날짜 객체 타입:', dateStr);
              dateStr = '';
            }
          } else if (typeof dateStr === 'string' && dateStr.includes('Timestamp')) {
            // 문자열로 변환된 Timestamp 처리
            console.log('⚠️ 문자열로 변환된 Timestamp:', dateStr);
            dateStr = '';
          }
        }
        
        console.log(`Application 날짜 변환: ${dateStr} (${data.postTitle || '제목없음'})`);
        
        if (!dateStr) {
          console.log('⚠️ Application 날짜 없음:', data);
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
          role: data.assignedRole || data.role || '',
          status: 'not_started',
          applicationStatus: data.status,
          sourceCollection: 'applications',
          sourceId: docId,
          applicationId: docId
        };
        
        console.log(`Application 생성:`, {
          id: scheduleEvent.id,
          type: scheduleEvent.type,
          status: data.status,
          eventName: scheduleEvent.eventName,
          date: scheduleEvent.date
        });
        
        // assignedTime에서 시간 정보 파싱 (예: "09:00-18:00")
        if (data.assignedTime) {
          console.log(`⏰ assignedTime 발견: ${data.assignedTime}`);
          
          if (data.assignedTime.includes('-')) {
            const [startStr, endStr] = data.assignedTime.split('-');
            
            // 날짜가 있어야만 시간 설정 가능
            if (scheduleEvent.date && scheduleEvent.date !== '') {
              const dateObj = new Date(scheduleEvent.date);
              
              // 시작 시간
              const [startHour, startMin] = startStr.trim().split(':').map(Number);
              const startDate = new Date(dateObj);
              startDate.setHours(startHour, startMin, 0, 0);
              scheduleEvent.startTime = Timestamp.fromDate(startDate);
              
              // 종료 시간
              const [endHour, endMin] = endStr.trim().split(':').map(Number);
              let endDate = new Date(dateObj);
              endDate.setHours(endHour, endMin, 0, 0);
              
              // 종료 시간이 시작 시간보다 작으면 다음날로 처리 (자정 넘는 근무)
              if (endHour < startHour) {
                endDate.setDate(endDate.getDate() + 1);
              }
              
              scheduleEvent.endTime = Timestamp.fromDate(endDate);
              console.log(`  ✅ 시간 설정 완료: ${startStr} - ${endStr}`);
            }
          } else if (data.assignedTime === '미정') {
            console.log(`  ℹ️ 시간 미정`);
            // 시간이 미정인 경우 null로 유지
          }
        }
        
        // 날짜가 여전히 Timestamp 객체인 경우 처리
        if (scheduleEvent.date && typeof scheduleEvent.date === 'object' && (scheduleEvent.date as any).seconds) {
          const isoString = new Date((scheduleEvent.date as any).seconds * 1000).toISOString();
          const datePart = isoString.split('T')[0];
          scheduleEvent.date = datePart || '';
          console.log(`Application 날짜 변환 (Timestamp): ${scheduleEvent.date}`);
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
          console.log('📊 모든 필드 검사:');
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
              console.log(`    💡 날짜 관련 필드 발견: ${key}`);
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
                    const datePart = isoString.split('T')[0];
                    convertedDate = datePart || '';
                  }
                } else {
                  convertedDate = dateItem;
                }
              } else if (typeof dateItem === 'object') {
                if (dateItem.toDate && typeof dateItem.toDate === 'function') {
                  const isoString = dateItem.toDate().toISOString();
                  const datePart = isoString.split('T')[0];
                  convertedDate = datePart || '';
                } else if (dateItem.seconds) {
                  const isoString = new Date(dateItem.seconds * 1000).toISOString();
                  const datePart = isoString.split('T')[0];
                  convertedDate = datePart || '';
                }
              }
              
              if (convertedDate) {
                convertedDates.push(convertedDate);
                console.log(`  [${index}] 날짜 변환 성공: ${convertedDate}`);
              }
            });
            
            // 여러 날짜가 있으면 각 날짜마다 이벤트 생성
            if (convertedDates.length > 0) {
              if (convertedDates.length > 1) {
                console.log(`📆 여러 날짜 이벤트 생성: ${convertedDates.length}개`);
                
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
                    console.log(`    assignedTimes[${index}]: ${timeInfo}`);
                  } else if (data.assignedTime) {
                    timeInfo = data.assignedTime;
                    console.log(`    assignedTime 사용: ${timeInfo}`);
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
                    console.log(`    시간 설정: ${timeInfo}`);
                  } else {
                    console.log(`    시간: ${timeInfo || '미정'}`);
                  }
                  
                  // 날짜를 한국어 형식으로 표시
                  const dateObj = new Date(date + 'T00:00:00');
                  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
                  const dayOfWeek = dayNames[dateObj.getDay()];
                  const month = dateObj.getMonth() + 1;
                  const day = dateObj.getDate();
                  
                  // 이벤트명에 날짜 정보 추가
                  // eventCopy.eventName = `${eventCopy.eventName} (${month}/${day} ${dayOfWeek})`;
                  
                  console.log(`  [Day ${index + 1}] ${date} (${dayOfWeek}): ${eventCopy.eventName}`);
                  multipleEvents.push(eventCopy);
                });
                
                console.log(`✅ ${multipleEvents.length}개의 이벤트 생성 완료`);
                return multipleEvents;
              } else {
                // 단일 날짜
                const firstDate = convertedDates[0];
                if (firstDate) {
                  scheduleEvent.date = firstDate;
                  console.log(`✅ assignedDates에서 날짜 설정 완료: ${scheduleEvent.date}`);
                }
              }
            }
          }
          
          // assignedDate 단일 필드 확인
          if (!scheduleEvent.date && data.assignedDate) {
            let assignedDate = data.assignedDate;
            
            // Timestamp 객체 변환
            if (typeof assignedDate === 'object') {
              if (assignedDate.toDate && typeof assignedDate.toDate === 'function') {
                const isoString = assignedDate.toDate().toISOString();
                assignedDate = safeExtractDateFromISO(isoString);
              } else if (assignedDate.seconds) {
                const isoString = new Date(assignedDate.seconds * 1000).toISOString();
                assignedDate = safeExtractDateFromISO(isoString);
              }
            }
            
            scheduleEvent.date = assignedDate;
            console.log(`✅ assignedDate에서 날짜 설정: ${assignedDate}`);
          }
          
          // assignedSchedules 배열 확인 (다른 형태일 수도 있음)
          if (!scheduleEvent.date && data.assignedSchedules) {
            console.log('📅 assignedSchedules 발견:', data.assignedSchedules);
            
            // 배열인 경우 각 요소 확인
            if (Array.isArray(data.assignedSchedules)) {
              data.assignedSchedules.forEach((schedule: any, index: number) => {
                console.log(`  스케줄 ${index}:`, schedule);
                
                // 날짜 찾기
                if (schedule.date) {
                  let assignedDate = schedule.date;
                  if (typeof assignedDate === 'object') {
                    if (assignedDate.toDate && typeof assignedDate.toDate === 'function') {
                      const isoString = assignedDate.toDate().toISOString();
                      assignedDate = safeExtractDateFromISO(isoString);
                    } else if (assignedDate.seconds) {
                      const isoString = new Date(assignedDate.seconds * 1000).toISOString();
                      assignedDate = safeExtractDateFromISO(isoString);
                    }
                  }
                  
                  // 첫 번째 날짜만 사용 (나중에 여러 날짜 지원 가능)
                  if (index === 0) {
                    scheduleEvent.date = assignedDate;
                    console.log(`✅ assignedSchedules에서 날짜 설정: ${assignedDate}`);
                  }
                }
              });
            }
          }
          
          // confirmedSchedules 필드 확인 (다른 이름일 수도 있음)
          if (data.confirmedSchedules) {
            console.log('📅 confirmedSchedules 발견:', data.confirmedSchedules);
          }
          
          // 날짜가 여전히 없으면 공고 정보에서 가져오기
          if (!scheduleEvent.date && jobPostingData) {
            console.log('🔍 공고 정보에서 날짜 찾기:', jobPostingData);
            
            // 공고의 다양한 날짜 필드 확인
            const possibleDateFields = ['date', 'startDate', 'eventDate', 'dates', 'eventDates'];
            
            for (const field of possibleDateFields) {
              if (jobPostingData[field]) {
                console.log(`  - ${field}:`, jobPostingData[field]);
                
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
                  console.log(`✅ 공고의 ${field}에서 날짜 설정: ${scheduleEvent.date}`);
                  break;
                }
              }
            }
            
            // 그래도 날짜가 없으면 오늘 날짜 사용 (임시)
            if (!scheduleEvent.date) {
              const today = getTodayString();
              scheduleEvent.date = today;
              console.log(`⚠️ 날짜를 찾을 수 없어 오늘 날짜 사용: ${today}`);
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
              const datePart = isoString.split('T')[0];
              dateStr = datePart || '';
              console.log(`Staff Timestamp 문자열 변환: ${dateStr}`);
            }
          } else if (typeof dateStr === 'object') {
            if (dateStr.toDate && typeof dateStr.toDate === 'function') {
              const isoString = dateStr.toDate().toISOString();
              dateStr = safeExtractDateFromISO(isoString);
            } else if (dateStr.seconds) {
              // Timestamp 객체 (seconds/nanoseconds)
              const isoString = new Date(dateStr.seconds * 1000).toISOString();
              dateStr = safeExtractDateFromISO(isoString);
            } else if (dateStr instanceof Date) {
              const isoString = dateStr.toISOString();
              dateStr = safeExtractDateFromISO(isoString);
            } else {
              console.log('⚠️ Staff - 알 수 없는 날짜 객체 타입:', dateStr);
              dateStr = '';
            }
          }
        }
        
        console.log(`Staff 날짜 변환: ${dateStr} (${data.postingTitle || '제목없음'})`);
        
        if (!dateStr) {
          console.log('⚠️ Staff 날짜 없음:', data);
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
          const datePart = isoString.split('T')[0];
          scheduleEvent.date = datePart || '';
          console.log(`Staff 날짜 변환: ${scheduleEvent.date}`);
        }
        
        // assignedTime에서 시간 정보 파싱
        if (data.assignedTime && data.assignedTime.includes('-')) {
          const [startStr, endStr] = data.assignedTime.split('-');
          const dateObj = new Date(scheduleEvent.date);
          
          const [startHour, startMin] = startStr.split(':').map(Number);
          const startDate = new Date(dateObj);
          startDate.setHours(startHour, startMin, 0, 0);
          scheduleEvent.startTime = Timestamp.fromDate(startDate);
          
          const [endHour, endMin] = endStr.split(':').map(Number);
          let endDate = new Date(dateObj);
          endDate.setHours(endHour, endMin, 0, 0);
          
          if (endHour < startHour) {
            endDate.setDate(endDate.getDate() + 1);
          }
          
          scheduleEvent.endTime = Timestamp.fromDate(endDate);
        }
      }
      
      // 최종 날짜 확인 및 변환
      if (scheduleEvent.date && typeof scheduleEvent.date === 'object') {
        const dateObj = scheduleEvent.date as any;
        if (dateObj.seconds) {
          const isoString = new Date(dateObj.seconds * 1000).toISOString();
          scheduleEvent.date = safeExtractDateFromISO(isoString);
          console.log(`최종 날짜 변환 (${source}): ${scheduleEvent.date} - ${scheduleEvent.eventName}`);
        } else if (dateObj.toDate) {
          const isoString = dateObj.toDate().toISOString();
          scheduleEvent.date = safeExtractDateFromISO(isoString);
          console.log(`최종 날짜 변환 toDate (${source}): ${scheduleEvent.date} - ${scheduleEvent.eventName}`);
        }
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
      console.error(`${source} 데이터 변환 오류:`, error);
      return null;
    }
  }, []);

  // 실시간 데이터 구독
  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    console.log('🔍 스케줄 데이터 실시간 구독 시작');
    const unsubscribes: (() => void)[] = [];

    // 스케줄 데이터 업데이트 함수
    const schedulesBySource: Record<string, ScheduleEvent[]> = {
      workLogs: [],
      applications: [],
      staff: []
    };

    const updateAllSchedules = (source: string, newSchedules: ScheduleEvent[]) => {
      schedulesBySource[source] = newSchedules;
      console.log(`📊 ${source} 스케줄 업데이트:`, newSchedules.length);
      
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
      
      // 중복 제거 (같은 날짜, 시간, 이벤트는 workLogs 우선)
      const uniqueSchedules = merged.reduce((acc, schedule) => {
        const key = `${schedule.date}-${schedule.eventId}-${schedule.role}`;
        
        if (!acc.has(key)) {
          acc.set(key, schedule);
        } else {
          // workLogs 데이터를 우선
          const existing = acc.get(key)!;
          if (schedule.sourceCollection === 'workLogs') {
            console.log(`중복 제거: workLogs 우선 - ${schedule.eventName}`);
            acc.set(key, schedule);
          } else {
            console.log(`중복 유지: ${existing.sourceCollection} 우선 - ${schedule.eventName}`);
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
      console.log('✅ 전체 스케줄 업데이트 완료:', sortedSchedules.length);
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
        console.log('📊 workLogs 업데이트, 문서 수:', snapshot.size);
        
        const workLogSchedules: ScheduleEvent[] = [];
        for (const doc of snapshot.docs) {
          console.log('WorkLog 문서:', doc.id, doc.data());
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
        console.error('❌ workLogs 구독 오류:', error);
        console.error('오류 코드:', error.code);
        console.error('오류 메시지:', error.message);
        console.error('전체 오류 객체:', error);
        
        // Firestore 인덱스 오류인 경우 안내
        if (error.message?.includes('index') || error.code === 'failed-precondition') {
          console.error('🔥 Firestore 인덱스가 필요합니다. 콘솔에서 제공하는 링크를 클릭하여 인덱스를 생성하세요.');
        }
        
        // INTERNAL ASSERTION FAILED 오류 처리
        if (error.message?.includes('INTERNAL ASSERTION FAILED')) {
          console.error('⚠️ Firestore 내부 오류 발생. 쿼리를 단순화합니다.');
          // 단순한 쿼리로 재시도
          const simpleQuery = query(
            collection(db, 'workLogs'),
            where('dealerId', '==', currentUser.uid)
          );
          
          // 간단한 쿼리로 재구독
          const retryUnsub = onSnapshot(
            simpleQuery,
            async (snapshot) => {
              console.log('📊 workLogs 재시도 성공, 문서 수:', snapshot.size);
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
              console.error('❌ workLogs 재시도도 실패:', retryError);
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
        console.log('📊 applications 업데이트, 문서 수:', snapshot.size);
        
        const applicationSchedules: ScheduleEvent[] = [];
        for (const doc of snapshot.docs) {
          console.log('Application 문서:', doc.id, doc.data());
          const result = await convertToScheduleEvent(doc.data(), 'applications', doc.id);
          if (result) {
            if (Array.isArray(result)) {
              console.log(`📅 ${result.length}개의 날짜별 이벤트 추가`);
              applicationSchedules.push(...result);
            } else {
              applicationSchedules.push(result);
            }
          } else {
            console.log('❌ Application 스케줄 변환 실패:', doc.id);
          }
        }
        
        updateAllSchedules('applications', applicationSchedules);
      },
      (error) => {
        console.error('❌ applications 구독 오류:', error);
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
        console.log('📊 staff 업데이트, 문서 수:', snapshot.size);
        
        const staffSchedules: ScheduleEvent[] = [];
        for (const doc of snapshot.docs) {
          console.log('Staff 문서:', doc.id, doc.data());
          const result = await convertToScheduleEvent(doc.data(), 'staff', doc.id);
          if (result) {
            if (Array.isArray(result)) {
              staffSchedules.push(...result);
            } else {
              staffSchedules.push(result);
            }
          } else {
            console.log('❌ Staff 스케줄 변환 실패:', doc.id);
          }
        }
        
        updateAllSchedules('staff', staffSchedules);
      },
      (error) => {
        console.error('❌ staff 구독 오류:', error);
      }
    );
    unsubscribes.push(unsubStaff);

    // 클린업
    return () => {
      console.log('🧹 스케줄 데이터 구독 해제');
      unsubscribes.forEach(unsub => unsub());
    };
  }, [currentUser, convertToScheduleEvent]);

  // 필터링된 스케줄
  const filteredSchedules = useMemo(() => {
    console.log('\n🔍 ========== 필터링 시작 ==========');
    console.log('전체 스케줄 수:', schedules.length);
    console.log('필터 설정:', {
      type: filters.type,
      status: filters.status,
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

    // 타입 필터
    if (filters.type !== 'all') {
      filtered = filtered.filter(s => s.type === filters.type);
    }

    // 상태 필터
    if (filters.status !== 'all') {
      filtered = filtered.filter(s => s.status === filters.status);
    }

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
        console.log(`❌ 날짜 없음 제외: ${s.eventName} (${s.id})`);
        return false;
      }
      
      // Timestamp 객체인 경우 문자열로 변환
      if (typeof dateStr === 'object') {
        const timestampObj = dateStr as any;
        console.log(`⚠️ 날짜가 여전히 객체임:`, {
          eventName: s.eventName,
          dateObject: timestampObj,
          hasSeconds: timestampObj && timestampObj.seconds !== undefined,
          hasToDate: timestampObj && typeof timestampObj.toDate === 'function'
        });
        
        if (timestampObj && timestampObj.seconds) {
          const isoString = new Date(timestampObj.seconds * 1000).toISOString();
          dateStr = safeExtractDateFromISO(isoString);
          console.log(`  → Timestamp 변환 완료: ${dateStr}`);
        } else if (timestampObj && timestampObj.toDate) {
          const isoString = timestampObj.toDate().toISOString();
          dateStr = safeExtractDateFromISO(isoString);
          console.log(`  → toDate 변환 완료: ${dateStr}`);
        } else {
          console.log(`  → 변환 실패, 제외`);
          return false;
        }
      }
      
      const isInRange = dateStr >= filters.dateRange.start && dateStr <= filters.dateRange.end;
      
      if (isInRange) {
        console.log(`✅ 날짜 범위 내: ${dateStr} - ${s.eventName}`);
      } else {
        console.log(`❌ 날짜 범위 밖: ${dateStr} - ${s.eventName}`);
      }
      
      return isInRange;
    });
    
    console.log(`\n날짜 필터 결과: ${beforeDateFilter}개 → ${filtered.length}개`);

    // 검색어 필터
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(s => 
        s.eventName.toLowerCase().includes(searchLower) ||
        s.location.toLowerCase().includes(searchLower) ||
        s.role.toLowerCase().includes(searchLower)
      );
    }

    console.log('\n✅ ========== 필터링 완료 ==========');
    console.log('최종 필터링 결과:', filtered.length);
    console.log('필터링된 스케줄 상세:');
    filtered.forEach((schedule, index) => {
      console.log(`  [${index}]`, {
        date: schedule.date,
        eventName: schedule.eventName,
        type: schedule.type
      });
    });
    console.log('========================================\n');
    
    return filtered;
  }, [schedules, filters]);

  // 통계 계산
  const stats = useMemo((): ScheduleStats => {
    const now = new Date();
    const thisMonth = now.toISOString().slice(0, 7); // YYYY-MM

    const completed = schedules.filter(s => s.type === 'completed');
    const todayDateStr = safeExtractDateFromISO(now.toISOString());
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
    console.log('🔄 스케줄 데이터 새로고침 (실시간 구독 중이므로 자동 업데이트)');
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