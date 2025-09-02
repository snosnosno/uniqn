/**
 * useUnifiedData - 통합 데이터 관리 커스텀 훅
 * UnifiedDataContext의 편리한 사용을 위한 커스텀 훅 모음
 * 
 * @version 1.0
 * @since 2025-02-01
 * @author T-HOLDEM Development Team
 */

import { useMemo, useCallback } from 'react';
import { useUnifiedDataContext } from '../contexts/UnifiedDataContext';
import { logger } from '../utils/logger';
import {
  Staff,
  WorkLog,
  AttendanceRecord,
  Application,
  UnifiedFilters,
} from '../types/unifiedData';
import { ScheduleEvent, ScheduleStats } from '../types/schedule';

/**
 * 기본 통합 데이터 훅
 * 모든 데이터에 대한 접근과 기본 함수들을 제공
 */
export const useUnifiedData = () => {
  const context = useUnifiedDataContext();

  return {
    // 전체 상태
    state: context.state,
    loading: context.state.loading,
    error: context.state.error,
    
    // 기본 getter 함수들
    getStaffById: context.getStaffById,
    getWorkLogsByStaffId: context.getWorkLogsByStaffId,
    getWorkLogsByEventId: context.getWorkLogsByEventId,
    getAttendanceByStaffId: context.getAttendanceByStaffId,
    getApplicationsByPostId: context.getApplicationsByPostId,
    
    // 필터링된 데이터
    getFilteredScheduleEvents: context.getFilteredScheduleEvents,
    getFilteredStaff: context.getFilteredStaff,
    getFilteredWorkLogs: context.getFilteredWorkLogs,
    
    // 필터 관리
    filters: context.state.filters,
    setFilters: (filters: Partial<UnifiedFilters>) => {
      context.dispatch({ type: 'SET_FILTERS', filters });
    },
    
    // 기타 유틸리티
    stats: context.getStats(),
    refresh: context.refresh,
    performanceMetrics: context.getPerformanceMetrics(),
  };
};

/**
 * 스케줄 전용 훅
 * 스케줄 페이지에서 사용하는 모든 데이터와 함수들
 */
export const useScheduleData = () => {
  const context = useUnifiedDataContext();

  // 스케줄 이벤트들 (필터링 적용)
  const schedules = useMemo(() => {
    return context.getFilteredScheduleEvents();
  }, [context.getFilteredScheduleEvents]);

  // 스케줄 통계 계산
  const stats = useMemo((): ScheduleStats => {
    const allEvents = schedules;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return {
      totalSchedules: allEvents.length,
      completedSchedules: allEvents.filter(event => event.type === 'completed').length,
      upcomingSchedules: allEvents.filter(event => 
        event.type === 'confirmed' && new Date(event.date) >= now
      ).length,
      totalEarnings: 0, // TODO: PayrollStatus 연결 후 계산
      thisMonthEarnings: 0, // TODO: 이번달 수입 계산
      hoursWorked: allEvents
        .filter(event => event.actualStartTime && event.actualEndTime)
        .reduce((total, event) => {
          if (event.actualStartTime && event.actualEndTime) {
            const start = event.actualStartTime.toDate();
            const end = event.actualEndTime.toDate();
            const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            return total + hours;
          }
          return total;
        }, 0),
    };
  }, [schedules]);

  // 특정 스케줄 이벤트 조회
  const getScheduleById = useCallback((id: string): ScheduleEvent | undefined => {
    return schedules.find(schedule => schedule.id === id);
  }, [schedules]);

  // 날짜별 스케줄 그룹화
  const getSchedulesByDate = useCallback(() => {
    const groupedSchedules = new Map<string, ScheduleEvent[]>();
    
    schedules.forEach(schedule => {
      if (!groupedSchedules.has(schedule.date)) {
        groupedSchedules.set(schedule.date, []);
      }
      groupedSchedules.get(schedule.date)!.push(schedule);
    });

    // 날짜순 정렬된 배열로 반환
    return Array.from(groupedSchedules.entries())
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, events]) => ({
        date,
        events: events.sort((a, b) => {
          if (a.startTime && b.startTime) {
            return a.startTime.toDate().getTime() - b.startTime.toDate().getTime();
          }
          return 0;
        }),
      }));
  }, [schedules]);

  // 새로고침
  const refreshData = useCallback(async () => {
    logger.info('스케줄 데이터 새로고침 시작', { component: 'useScheduleData' });
    await context.refresh();
  }, [context.refresh]);

  return {
    // 데이터
    schedules,
    stats,
    loading: context.state.loading.initial,
    error: context.state.error.global,
    
    // 함수들
    getScheduleById,
    getSchedulesByDate,
    refreshData,
    
    // 필터 관리
    filters: context.state.filters,
    setFilters: (filters: Partial<UnifiedFilters>) => {
      context.dispatch({ type: 'SET_FILTERS', filters });
    },
  };
};

/**
 * 스태프 관리 전용 훅
 */
export const useStaffData = () => {
  const context = useUnifiedDataContext();

  const staff = useMemo(() => {
    return context.getFilteredStaff();
  }, [context.getFilteredStaff]);

  const getStaffWorkLogs = useCallback((staffId: string): WorkLog[] => {
    return context.getWorkLogsByStaffId(staffId);
  }, [context.getWorkLogsByStaffId]);

  const getStaffAttendance = useCallback((staffId: string): AttendanceRecord[] => {
    return context.getAttendanceByStaffId(staffId);
  }, [context.getAttendanceByStaffId]);

  const getStaffSchedules = useCallback((staffId: string): ScheduleEvent[] => {
    return context.getFilteredScheduleEvents().filter(event => {
      if (event.sourceCollection === 'workLogs') {
        const workLog = context.state.workLogs.get(event.sourceId);
        return workLog?.staffId === staffId;
      }
      return false;
    });
  }, [context.getFilteredScheduleEvents, context.state.workLogs]);

  return {
    staff,
    loading: context.state.loading.staff,
    error: context.state.error.staff,
    getStaffWorkLogs,
    getStaffAttendance,
    getStaffSchedules,
    filters: context.state.filters,
    setFilters: (filters: Partial<UnifiedFilters>) => {
      context.dispatch({ type: 'SET_FILTERS', filters });
    },
    refresh: () => context.refresh('staff'),
  };
};

/**
 * 구인공고 관리 전용 훅
 */
export const useJobPostingData = () => {
  const context = useUnifiedDataContext();

  const jobPostings = useMemo(() => {
    return Array.from(context.state.jobPostings.values());
  }, [context.state.jobPostings]);

  const getApplicationsForPost = useCallback((postId: string): Application[] => {
    return context.getApplicationsByPostId(postId);
  }, [context.getApplicationsByPostId]);

  const getActiveJobPostings = useMemo(() => {
    return jobPostings.filter(posting => 
      posting.status === 'published' && 
      new Date(posting.endDate?.toDate() || new Date()) >= new Date()
    );
  }, [jobPostings]);

  return {
    jobPostings,
    activeJobPostings: getActiveJobPostings,
    loading: context.state.loading.jobPostings,
    error: context.state.error.jobPostings,
    getApplicationsForPost,
    refresh: () => context.refresh('jobPostings'),
  };
};

/**
 * 지원자 관리 전용 훅
 */
export const useApplicationData = () => {
  const context = useUnifiedDataContext();

  const applications = useMemo(() => {
    return Array.from(context.state.applications.values());
  }, [context.state.applications]);

  const getPendingApplications = useMemo(() => {
    return applications.filter(app => app.status === 'pending');
  }, [applications]);

  const getConfirmedApplications = useMemo(() => {
    return applications.filter(app => app.status === 'confirmed');
  }, [applications]);

  const getApplicationsByStatus = useCallback((status: string) => {
    return applications.filter(app => app.status === status);
  }, [applications]);

  return {
    applications,
    pendingApplications: getPendingApplications,
    confirmedApplications: getConfirmedApplications,
    loading: context.state.loading.applications,
    error: context.state.error.applications,
    getApplicationsByStatus,
    refresh: () => context.refresh('applications'),
  };
};

/**
 * 출석 관리 전용 훅
 */
export const useAttendanceData = () => {
  const context = useUnifiedDataContext();

  const attendanceRecords = useMemo(() => {
    return Array.from(context.state.attendanceRecords.values());
  }, [context.state.attendanceRecords]);

  const getTodayAttendance = useMemo(() => {
    const today = new Date().toISOString().substring(0, 10);
    return attendanceRecords.filter(record => {
      // WorkLog의 date와 매칭
      const workLog = context.state.workLogs.get(record.workLogId || '');
      return workLog?.date === today;
    });
  }, [attendanceRecords, context.state.workLogs]);

  const getAttendanceByEventId = useCallback((eventId: string): AttendanceRecord[] => {
    return attendanceRecords.filter(record => record.eventId === eventId);
  }, [attendanceRecords]);

  const getAttendanceStats = useMemo(() => {
    const total = attendanceRecords.length;
    const checkedIn = attendanceRecords.filter(r => r.status === 'checked_in').length;
    const checkedOut = attendanceRecords.filter(r => r.status === 'checked_out').length;
    const notStarted = attendanceRecords.filter(r => r.status === 'not_started').length;

    return {
      total,
      checkedIn,
      checkedOut,
      notStarted,
      checkedInRate: total > 0 ? (checkedIn / total) * 100 : 0,
      completionRate: total > 0 ? (checkedOut / total) * 100 : 0,
    };
  }, [attendanceRecords]);

  return {
    attendanceRecords,
    todayAttendance: getTodayAttendance,
    attendanceStats: getAttendanceStats,
    loading: context.state.loading.attendanceRecords,
    error: context.state.error.attendanceRecords,
    getAttendanceByEventId,
    refresh: () => context.refresh('attendanceRecords'),
  };
};

/**
 * 성능 모니터링 전용 훅
 */
export const useUnifiedDataPerformance = () => {
  const context = useUnifiedDataContext();

  const metrics = useMemo(() => {
    return context.getPerformanceMetrics();
  }, [context.getPerformanceMetrics]);

  const getOptimizationSuggestions = useMemo(() => {
    const suggestions: string[] = [];

    if (metrics.cacheHitRate < 80) {
      suggestions.push('캐시 적중률이 낮습니다. 필터 사용 패턴을 검토해보세요.');
    }

    if (metrics.averageQueryTime > 100) {
      suggestions.push('평균 쿼리 시간이 높습니다. 데이터 크기를 확인해보세요.');
    }

    if (metrics.subscriptionCount > 6) {
      suggestions.push('구독 수가 예상보다 높습니다. 중복 구독을 확인해보세요.');
    }

    return suggestions;
  }, [metrics]);

  return {
    metrics,
    optimizationSuggestions: getOptimizationSuggestions,
    isPerformanceGood: metrics.cacheHitRate >= 80 && metrics.averageQueryTime <= 100,
  };
};

/**
 * 개발자 디버깅용 훅
 */
export const useUnifiedDataDebug = () => {
  const context = useUnifiedDataContext();

  const getDataSummary = useCallback(() => {
    return {
      staff: context.state.staff.size,
      workLogs: context.state.workLogs.size,
      attendanceRecords: context.state.attendanceRecords.size,
      jobPostings: context.state.jobPostings.size,
      applications: context.state.applications.size,
      tournaments: context.state.tournaments.size,
      scheduleEvents: context.getFilteredScheduleEvents().length,
    };
  }, [context.state, context.getFilteredScheduleEvents]);

  const getCacheInfo = useCallback(() => {
    return {
      cacheKeys: context.state.cacheKeys,
      lastUpdated: context.state.lastUpdated,
      filters: context.state.filters,
    };
  }, [context.state.cacheKeys, context.state.lastUpdated, context.state.filters]);

  const logCurrentState = useCallback(() => {
    logger.info('UnifiedData 현재 상태', {
      component: 'useUnifiedDataDebug',
      data: {
        summary: getDataSummary(),
        cache: getCacheInfo(),
        performance: context.getPerformanceMetrics(),
      }
    });
  }, [getDataSummary, getCacheInfo, context.getPerformanceMetrics]);

  return {
    dataSummary: getDataSummary(),
    cacheInfo: getCacheInfo(),
    performance: context.getPerformanceMetrics(),
    logCurrentState,
    forceRefresh: () => context.refresh(),
    clearCache: () => context.dispatch({ type: 'INVALIDATE_CACHE' }),
  };
};

// 기본 export
export default useUnifiedData;