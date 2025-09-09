import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useUnifiedDataContext } from '../../contexts/UnifiedDataContext';
import { logger } from '../../utils/logger';
import { handleError } from '../../utils/errorHandler';
import { ScheduleEvent, ScheduleStats } from '../../types/schedule';
import type { Application, WorkLog } from '../../types/unifiedData';

// Local imports
import { UseScheduleDataReturn } from './types';
import { processApplicationData, processWorkLogData } from './dataProcessors';
import { filterSchedules, createDefaultFilters } from './filterUtils';

/**
 * 스케줄 데이터를 관리하는 커스텀 훅
 * UnifiedDataContext를 활용하여 중복 구독 제거
 */
const useScheduleData = (): UseScheduleDataReturn => {
  const { currentUser } = useAuth();
  const context = useUnifiedDataContext();
  const { staff, workLogs, applications, loading: contextLoading, error: contextError } = context.state;
  const [filters, setFilters] = useState(createDefaultFilters());
  const [_lastRefresh, _setLastRefresh] = useState(Date.now());

  // 스케줄 데이터 상태
  const [schedules, setSchedules] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UnifiedDataContext 데이터를 스케줄 이벤트로 변환
  useEffect(() => {
    const loadSchedules = async () => {
      if (!currentUser) {
        setSchedules([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const mergedEvents: ScheduleEvent[] = [];
        const processedKeys = new Set<string>();

        // 1. WorkLogs 처리 (우선순위 높음) - 병렬 처리
        const userWorkLogs = Array.from(workLogs.values())
          .filter((log): log is WorkLog => {
            const workLog = log as WorkLog;
            // staffId가 정확히 일치하거나 userId_숫자 패턴으로 시작하는 경우
            return workLog.staffId === currentUser.uid || 
                   workLog.staffId?.startsWith(currentUser.uid + '_');
          });
        
        logger.info(`필터링된 WorkLogs: ${userWorkLogs.length}개 [${userWorkLogs.map(log => log.staffId).join(',')}]`, {
          component: 'useScheduleData',
          userId: currentUser.uid,
          operation: 'filterWorkLogs'
        });

        // WorkLog 비동기 처리를 병렬로 실행
        const workLogPromises = userWorkLogs.map(workLog => 
          processWorkLogData(workLog.id || '', workLog)
        );
        const workLogEvents = await Promise.all(workLogPromises);
        
        // WorkLog 이벤트 추가
        workLogEvents.forEach(event => {
          mergedEvents.push(event);
          
          // 중복 방지 키 생성
          if (event.eventId && event.date) {
            const timeKey = event.startTime && 'seconds' in event.startTime ? 
              new Date(event.startTime.seconds * 1000).toTimeString().slice(0, 5) : 'notime';
            const key = `${event.eventId}_${event.date}_${timeKey}`;
            const basicKey = `${event.eventId}_${event.date}`;
            processedKeys.add(key);
            processedKeys.add(basicKey);
          }
        });

        // 2. Applications 처리 (중복 제외) - 병렬 처리
        const userApplications = Array.from(applications.values())
          .filter((app): app is Application => {
            const application = app as Application;
            // applicantId가 정확히 일치하거나 userId_숫자 패턴으로 시작하는 경우  
            return application.applicantId === currentUser.uid ||
                   application.applicantId?.startsWith(currentUser.uid + '_');
          });
          
        logger.info(`필터링된 Applications: ${userApplications.length}개 [${userApplications.map(app => app.applicantId).join(',')}]`, {
          component: 'useScheduleData',
          userId: currentUser.uid,
          operation: 'filterApplications'
        });
        
        // Application 비동기 처리를 병렬로 실행
        const applicationPromises = userApplications.map(application =>
          processApplicationData(application.id || '', application)
        );
        const applicationEventArrays = await Promise.all(applicationPromises);
        
        // Application 이벤트 추가 (중복 체크)
        applicationEventArrays.flat().forEach(event => {
          if (event.eventId && event.date) {
            const timeKey = event.startTime && 'seconds' in event.startTime ?
              new Date(event.startTime.seconds * 1000).toTimeString().slice(0, 5) : 'notime';
            const preciseKey = `${event.eventId}_${event.date}_${timeKey}`;
            const basicKey = `${event.eventId}_${event.date}`;
            
            // 중복 체크
            if (!processedKeys.has(preciseKey) && !processedKeys.has(basicKey)) {
              mergedEvents.push(event);
              processedKeys.add(preciseKey);
              processedKeys.add(basicKey);
            }
          } else {
            // eventId나 date가 없는 경우 그냥 추가
            mergedEvents.push(event);
          }
        });

        logger.info(`스케줄 데이터 병합 완료: 총 ${mergedEvents.length}개 이벤트 (WorkLog: ${workLogEvents.length}, 지원서: ${applicationEventArrays.flat().length})`, {
          component: 'useScheduleData',
          userId: currentUser.uid,
          operation: 'loadSchedules'
        });

        setSchedules(mergedEvents);
        setLoading(false);
        setError(null);
      } catch (err) {
        const errorMessage = handleError(err, {
          component: 'useScheduleData',
          action: 'loadSchedules',
          userId: currentUser?.uid,
          fallbackMessage: '스케줄 데이터를 불러오는 중 오류가 발생했습니다.'
        });
        setError(errorMessage);
        setLoading(false);
      }
    };

    // 데이터가 존재하면 처리 (contextLoading.initial 의존성 제거)
    if (currentUser && (workLogs.size > 0 || applications.size > 0)) {
      loadSchedules();
    } else if (currentUser) {
      // 사용자는 로그인했지만 데이터가 없는 경우
      logger.info('사용자 데이터 대기 중...', {
        component: 'useScheduleData',
        userId: currentUser.uid,
        data: { workLogsCount: workLogs.size, applicationsCount: applications.size }
      });
      
      // 일정 시간 후에도 데이터가 없으면 빈 상태로 설정
      const timeoutId = setTimeout(() => {
        if (workLogs.size === 0 && applications.size === 0) {
          setSchedules([]);
          setLoading(false);
          logger.info('데이터 없음으로 빈 스케줄 설정', {
            component: 'useScheduleData',
            userId: currentUser.uid
          });
        }
      }, 3000);

      return () => clearTimeout(timeoutId);
    }
    
    // 기본 반환 (TypeScript 오류 방지)
    return undefined;
  }, [currentUser, applications, workLogs]);

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

  // 새로고침 함수 (UnifiedDataContext는 자동 실시간 동기화)
  const refreshData = useCallback(() => {
    _setLastRefresh(Date.now());
    // UnifiedDataContext가 자동으로 실시간 동기화하므로 별도 작업 불필요
    logger.info('스케줄 데이터 새로고침 요청', { component: 'useScheduleData' });
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