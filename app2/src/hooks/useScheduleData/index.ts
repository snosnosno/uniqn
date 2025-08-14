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
      const _allEvents: ScheduleEvent[] = [];
      const unsubscribes: (() => void)[] = [];

      // 1. Applications 데이터 구독
      const applicationsQuery = query(
        collection(db, 'applications'),
        where('applicantId', '==', currentUser.uid)
      );

      const unsubApplications = onSnapshot(
        applicationsQuery,
        async (snapshot) => {
          const applicationEvents: ScheduleEvent[] = [];
          
          // 모든 문서 처리를 Promise 배열로 변환
          const promises = snapshot.docs.map(doc => 
            processApplicationData(doc.id, doc.data() as ApplicationData)
          );
          
          // 모든 Promise가 완료될 때까지 대기
          const results = await Promise.all(promises);
          
          // 결과를 플래튼
          results.forEach(events => {
            applicationEvents.push(...events);
          });
          
          // 상태 업데이트
          setSchedules(prev => {
            const filtered = prev.filter(e => e.type !== 'applied');
            return [...filtered, ...applicationEvents];
          });
          
          setLoading(false);
        },
        (err) => {
          logger.error('Applications 구독 오류:', err instanceof Error ? err : new Error(String(err)), { component: 'useScheduleData' });
          setError('일정 데이터를 불러오는 중 오류가 발생했습니다.');
          setLoading(false);
        }
      );

      unsubscribes.push(unsubApplications);

      // 2. WorkLogs 데이터 구독
      const today = getTodayString();
      const workLogsQuery = query(
        collection(db, 'workLogs'),
        where('date', '>=', today)
      );

      const unsubWorkLogs = onSnapshot(
        workLogsQuery,
        (snapshot) => {
          const workLogEvents: ScheduleEvent[] = [];
          
          snapshot.docs.forEach(doc => {
            const data = doc.data();
            
            // 관리자이거나 본인의 기록인 경우만 표시
            // currentUser에 role이 없으므로 모든 본인 기록만 표시
            if (data.staffId === currentUser.uid) {
              const event = processWorkLogData(doc.id, data as WorkLogData);
              workLogEvents.push(event);
            }
          });
          
          // 상태 업데이트
          setSchedules(prev => {
            const filtered = prev.filter(e => 
              e.sourceCollection !== 'workLogs'
            );
            return [...filtered, ...workLogEvents];
          });
          
          setLoading(false);
        },
        (err) => {
          logger.error('WorkLogs 구독 오류:', err instanceof Error ? err : new Error(String(err)), { component: 'useScheduleData' });
          setError('근무 기록을 불러오는 중 오류가 발생했습니다.');
          setLoading(false);
        }
      );

      unsubscribes.push(unsubWorkLogs);

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
    
    const _thisMonthEvents = filteredSchedules.filter(e => {
      const eventDate = new Date(e.date);
      return eventDate.getMonth() === thisMonth && eventDate.getFullYear() === thisYear;
    });
    
    return {
      totalSchedules: filteredSchedules.length,
      completedSchedules: completedEvents.length,
      upcomingSchedules: upcomingEvents.length,
      totalEarnings: 0,
      thisMonthEarnings: 0,
      hoursWorked: 0
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