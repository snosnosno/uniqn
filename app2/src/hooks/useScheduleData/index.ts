import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { logger } from '../../utils/logger';
import { ScheduleEvent, ScheduleStats } from '../../types/schedule';
import { getTodayString } from '../../utils/jobPosting/dateUtils';

// Local imports
import { UseScheduleDataReturn, ApplicationData, WorkLogData } from './types';
import { processApplicationData, processWorkLogData } from './dataProcessors';
import { filterSchedules, createDefaultFilters } from './filterUtils';

/**
 * 스케줄 데이터를 관리하는 커스텀 훅
 */
const useScheduleData = (): UseScheduleDataReturn => {
  const { currentUser } = useAuth();
  const [schedules, setSchedules] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState(createDefaultFilters());
  const [_lastRefresh, _setLastRefresh] = useState(Date.now());

  // 데이터 로드 함수
  const loadScheduleData = useCallback(async (): Promise<(() => void) | void> => {
    if (!currentUser) {
      setSchedules([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const unsubscribes: (() => void)[] = [];
      
      // applications와 workLogs를 저장할 맵 (병합을 위해)
      const applicationsMap = new Map<string, ScheduleEvent[]>();
      const workLogsMap = new Map<string, ScheduleEvent>();
      
      // 디버깅을 위한 로그
      const logMergeState = () => {
        logger.info('현재 맵 상태:', {
          data: {
            applicationsCount: applicationsMap.size,
            workLogsCount: workLogsMap.size,
            applications: Array.from(applicationsMap.entries()).map(([id, events]) => ({
              id,
              events: events.map(e => ({ date: e.date, eventId: e.eventId, type: e.type }))
            })),
            workLogs: Array.from(workLogsMap.entries()).map(([id, event]) => ({
              id,
              event: { date: event.date, eventId: event.eventId, type: event.type }
            }))
          }
        });
      };

      // 1. Applications 데이터 구독
      const applicationsQuery = query(
        collection(db, 'applications'),
        where('applicantId', '==', currentUser.uid)
      );

      const unsubApplications = onSnapshot(
        applicationsQuery,
        async (snapshot) => {
          const changePromises = snapshot.docChanges().map(async (change) => {
            const data = change.doc.data() as ApplicationData;
            
            if (change.type === 'removed') {
              // 제거된 application 처리
              applicationsMap.delete(change.doc.id);
            } else {
              // added나 modified 처리
              const events = await processApplicationData(change.doc.id, data);
              applicationsMap.set(change.doc.id, events);
            }
          });
          
          await Promise.all(changePromises);
          
          // 병합된 데이터로 상태 업데이트
          updateMergedSchedules();
        },
        (err) => {
          logger.error('Applications 구독 오류:', err instanceof Error ? err : new Error(String(err)), { component: 'useScheduleData' });
          setError('일정 데이터를 불러오는 중 오류가 발생했습니다.');
          setLoading(false);
        }
      );

      unsubscribes.push(unsubApplications);

      // 2. WorkLogs 데이터 구독
      const workLogsQuery = query(
        collection(db, 'workLogs'),
        where('staffId', '==', currentUser.uid)
      );

      const unsubWorkLogs = onSnapshot(
        workLogsQuery,
        async (snapshot) => {
          const changePromises = snapshot.docChanges().map(async (change) => {
            const data = change.doc.data() as WorkLogData;
            
            if (change.type === 'removed') {
              workLogsMap.delete(change.doc.id);
            } else {
              const event = await processWorkLogData(change.doc.id, data);
              workLogsMap.set(change.doc.id, event);
            }
          });
          
          await Promise.all(changePromises);
          
          // 병합된 데이터로 상태 업데이트
          updateMergedSchedules();
        },
        (err) => {
          logger.error('WorkLogs 구독 오류:', err instanceof Error ? err : new Error(String(err)), { component: 'useScheduleData' });
          setError('근무 기록을 불러오는 중 오류가 발생했습니다.');
          setLoading(false);
        }
      );

      unsubscribes.push(unsubWorkLogs);

      // 데이터 병합 및 중복 제거 함수 (개선된 로직)
      const updateMergedSchedules = () => {
        const mergedEvents: ScheduleEvent[] = [];
        const processedKeys = new Set<string>();
        
        // 디버깅 로그
        logMergeState();
        
        // workLogs 먼저 처리 (우선순위가 높음)
        workLogsMap.forEach((workLog) => {
          mergedEvents.push(workLog);
          // 더 정밀한 키 생성 (eventId + date + 시간대 포함)
          if (workLog.eventId && workLog.date) {
            const timeKey = workLog.startTime ? new Date(workLog.startTime.seconds * 1000).toTimeString().slice(0, 5) : 'notime';
            const key = `${workLog.eventId}_${workLog.date}_${timeKey}`;
            processedKeys.add(key);
            
            // 기본 키도 추가 (시간 정보 없는 applications 대응)
            const basicKey = `${workLog.eventId}_${workLog.date}`;
            processedKeys.add(basicKey);
            
            logger.info('WorkLog 키 추가:', { 
              data: { key, basicKey, eventId: workLog.eventId, date: workLog.date, time: timeKey }
            });
          }
        });
        
        // applications 처리 (workLog와 중복되지 않는 것만)
        applicationsMap.forEach((events) => {
          events.forEach(event => {
            if (event.eventId && event.date) {
              // 시간 정보가 있으면 정밀한 키, 없으면 기본 키 사용
              const timeKey = event.startTime ? new Date(event.startTime.seconds * 1000).toTimeString().slice(0, 5) : 'notime';
              const preciseKey = `${event.eventId}_${event.date}_${timeKey}`;
              const basicKey = `${event.eventId}_${event.date}`;
              
              // 정밀한 키나 기본 키 중 하나라도 있으면 중복으로 판단
              if (processedKeys.has(preciseKey) || processedKeys.has(basicKey)) {
                logger.info('Application 중복 스킵:', { 
                  data: { 
                    preciseKey, basicKey, 
                    eventId: event.eventId, 
                    date: event.date,
                    time: timeKey,
                    hasPrecise: processedKeys.has(preciseKey),
                    hasBasic: processedKeys.has(basicKey)
                  }
                });
              } else {
                mergedEvents.push(event);
                processedKeys.add(preciseKey);
                processedKeys.add(basicKey);
                logger.info('Application 추가:', { 
                  data: { preciseKey, basicKey, eventId: event.eventId, date: event.date }
                });
              }
            } else {
              // eventId나 date가 없는 경우는 그냥 추가
              mergedEvents.push(event);
              logger.info('Application 추가 (키 없음):', { 
                data: { id: event.id, eventId: event.eventId, date: event.date }
              });
            }
          });
        });
        
        logger.info('병합 결과:', {
          data: {
            totalEvents: mergedEvents.length,
            processedKeys: Array.from(processedKeys)
          }
        });
        
        setSchedules(mergedEvents);
        setLoading(false);
      };

      // 클린업 함수 반환
      return () => {
        unsubscribes.forEach(unsubscribe => unsubscribe());
      };
    } catch (err) {
      logger.error('스케줄 데이터 로드 오류:', err instanceof Error ? err : new Error(String(err)), { 
        component: 'useScheduleData' 
      });
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
      setLoading(false);
    }
  }, [currentUser]);

  // 데이터 로드 Effect
  useEffect(() => {
    let cleanupFn: (() => void) | undefined;
    
    loadScheduleData().then(cleanup => {
      if (cleanup) {
        cleanupFn = cleanup;
      }
    });
    
    return () => {
      if (cleanupFn) {
        cleanupFn();
      }
    };
  }, [loadScheduleData]);

  // 필터링된 스케줄
  const filteredSchedules = useMemo(() => {
    return filterSchedules(schedules, filters);
  }, [schedules, filters]);

  // 통계 계산
  const stats = useMemo((): ScheduleStats => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    
    const completedEvents = filteredSchedules.filter(e => 
      e.type === 'completed' || 
      (e.status === 'checked_out' && e.actualEndTime)
    );
    
    const upcomingEvents = filteredSchedules.filter(e => 
      new Date(e.date) > now
    );
    
    const thisMonthEvents = filteredSchedules.filter(e => {
      const eventDate = new Date(e.date);
      return eventDate.getMonth() === thisMonth && eventDate.getFullYear() === thisYear;
    });
    
    // 근무 시간 계산 (예정 시간 기준)
    let totalHoursWorked = 0;
    let totalEarnings = 0;
    let thisMonthEarnings = 0;
    
    filteredSchedules.forEach(event => {
      // 예정 시간 기준으로 근무 시간 계산
      if (event.startTime && event.endTime) {
        const startDate = event.startTime && 'toDate' in event.startTime ? 
          event.startTime.toDate() : null;
        const endDate = event.endTime && 'toDate' in event.endTime ? 
          event.endTime.toDate() : null;
          
        if (startDate && endDate) {
          const hoursWorked = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
          totalHoursWorked += hoursWorked;
        }
      }
      
      // 급여 계산
      if (event.payrollAmount) {
        totalEarnings += event.payrollAmount;
        
        const eventDate = new Date(event.date);
        if (eventDate.getMonth() === thisMonth && eventDate.getFullYear() === thisYear) {
          thisMonthEarnings += event.payrollAmount;
        }
      }
    });
    
    return {
      totalSchedules: filteredSchedules.length,
      completedSchedules: completedEvents.length,
      upcomingSchedules: upcomingEvents.length,
      totalEarnings: totalEarnings,
      thisMonthEarnings: thisMonthEarnings,
      hoursWorked: Math.round(totalHoursWorked)
    };
  }, [filteredSchedules]);

  // 새로고침 함수
  const refreshData = useCallback(() => {
    _setLastRefresh(Date.now());
  }, []);

  // ID로 스케줄 찾기
  const getScheduleById = useCallback((id: string) => {
    return schedules.find(schedule => schedule.id === id);
  }, [schedules]);

  return {
    schedules: filteredSchedules,
    loading,
    error,
    stats,
    filters,
    setFilters,
    refreshData,
    getScheduleById
  };
};

export default useScheduleData;