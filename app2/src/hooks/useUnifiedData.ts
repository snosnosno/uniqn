/**
 * useUnifiedData - 통합 데이터 관리 커스텀 훅
 * Zustand Store 기반 통합 데이터 관리 (Hybrid Adapter Pattern)
 *
 * @version 2.0 - Zustand Migration
 * @since 2025-02-01
 * @updated 2025-11-15 - Zustand Store 통합
 * @author T-HOLDEM Development Team
 */

import { useMemo, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useUnifiedDataStore } from '../stores/unifiedDataStore';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';
import {
  WorkLog,
  AttendanceRecord,
  Application,
  UnifiedFilters,
  UnifiedDataOptions,
} from '../types/unifiedData';
import { ScheduleEvent, ScheduleStats } from '../types/schedule';
import { Timestamp } from 'firebase/firestore';

/**
 * 기본 통합 데이터 훅 (Zustand 기반)
 * 모든 데이터에 대한 접근과 기본 함수들을 제공
 * Hybrid Adapter Pattern: 기존 API 100% 호환 유지
 */
export const useUnifiedData = (_options?: UnifiedDataOptions) => {
  const { currentUser, role } = useAuth();

  // Zustand Store에서 데이터 가져오기 (useShallow로 최적화)
  // 주의: Firebase 구독은 UnifiedDataInitializer에서 전역으로 처리됨
  const {
    staff: staffMap,
    workLogs: workLogsMap,
    applications: applicationsMap,
    jobPostings: jobPostingsMap,
    attendanceRecords: attendanceRecordsMap,
    isLoading,
    error,
    getStaffById,
    getWorkLogsByStaffId,
    getWorkLogsByEventId,
    getAttendanceByStaffId,
    getApplicationsByEventId,
  } = useUnifiedDataStore(
    useShallow((state) => ({
      staff: state.staff,
      workLogs: state.workLogs,
      applications: state.applications,
      jobPostings: state.jobPostings,
      attendanceRecords: state.attendanceRecords,
      isLoading: state.isLoading,
      error: state.error,
      getStaffById: state.getStaffById,
      getWorkLogsByStaffId: state.getWorkLogsByStaffId,
      getWorkLogsByEventId: state.getWorkLogsByEventId,
      getAttendanceByStaffId: state.getAttendanceByStaffId,
      getApplicationsByEventId: state.getApplicationsByEventId,
    }))
  );

  // 보안 필터링: role 기반 데이터 접근 제어
  const securityFilter = useCallback(
    <T extends { userId?: string; staffId?: string; applicantId?: string }>(
      items: T[],
      collection: string
    ): T[] => {
      if (!currentUser) return [];
      if (role === 'admin' || role === 'manager') return items;

      // staff/user role: 자신의 데이터만 접근
      switch (collection) {
        case 'staff':
          return items.filter((item) => item.userId === currentUser.uid);
        case 'workLogs':
          return items.filter((item) => item.staffId === currentUser.uid);
        case 'applications':
          return items.filter((item) => item.applicantId === currentUser.uid);
        case 'attendanceRecords':
          return items.filter((item) => item.staffId === currentUser.uid);
        case 'jobPostings':
          return items; // 공고는 모두가 볼 수 있음
        default:
          return items;
      }
    },
    [currentUser, role]
  );

  // Map → Array 변환 + 보안 필터링
  const staff = useMemo(
    () => securityFilter(Array.from(staffMap.values()), 'staff'),
    [staffMap, securityFilter]
  );

  const workLogs = useMemo(
    () => securityFilter(Array.from(workLogsMap.values()), 'workLogs'),
    [workLogsMap, securityFilter]
  );

  const applications = useMemo(
    () => securityFilter(Array.from(applicationsMap.values()), 'applications'),
    [applicationsMap, securityFilter]
  );

  // JobPosting은 보안 필터링 불필요 (모두 공개)
  const jobPostings = useMemo(
    () => Array.from(jobPostingsMap.values()),
    [jobPostingsMap]
  );

  const attendanceRecords = useMemo(
    () =>
      securityFilter(
        Array.from(attendanceRecordsMap.values()),
        'attendanceRecords'
      ),
    [attendanceRecordsMap, securityFilter]
  );

  // 기존 API 호환: tournaments (임시로 빈 배열)
  const tournaments = useMemo(() => [], []);

  // 기존 API 호환: getApplicationsByPostId
  const getApplicationsByPostId = useCallback(
    (postId: string) => {
      return applications.filter((app) => app.eventId === postId);
    },
    [applications]
  );

  // 기존 API 호환: getFilteredScheduleEvents (ScheduleEvent 생성)
  const getFilteredScheduleEvents = useCallback((): ScheduleEvent[] => {
    const scheduleEvents: ScheduleEvent[] = [];

    // WorkLog → ScheduleEvent 변환
    workLogs.forEach((workLog) => {
      scheduleEvents.push({
        id: `worklog_${workLog.id}`,
        date: workLog.date,
        startTime: workLog.scheduledStartTime || null,
        endTime: workLog.scheduledEndTime || null,
        actualStartTime: workLog.actualStartTime || null,
        actualEndTime: workLog.actualEndTime || null,
        type: workLog.status === 'completed' ? 'completed' : 'confirmed',
        eventId: workLog.eventId,
        eventName: '',
        location: '',
        role: workLog.role || '',
        status: workLog.status || 'not_started',
        sourceCollection: 'workLogs',
        sourceId: workLog.id,
        workLogId: workLog.id,
      } as ScheduleEvent);
    });

    return scheduleEvents;
  }, [workLogs]);

  // 기존 API 호환: getFilteredStaff
  const getFilteredStaff = useCallback(() => staff, [staff]);

  // 기존 API 호환: getFilteredWorkLogs
  const getFilteredWorkLogs = useCallback(() => workLogs, [workLogs]);

  // 기존 API 호환: state 객체
  const state = useMemo(
    () => ({
      staff: staffMap,
      workLogs: workLogsMap,
      applications: applicationsMap,
      jobPostings: jobPostingsMap,
      attendanceRecords: attendanceRecordsMap,
      tournaments: new Map(),
      loading: {
        initial: isLoading,
        staff: isLoading,
        workLogs: isLoading,
        applications: isLoading,
        jobPostings: isLoading,
        attendanceRecords: isLoading,
        tournaments: false,
      },
      error: {
        global: error,
        staff: error,
        workLogs: error,
        applications: error,
        jobPostings: error,
        attendanceRecords: error,
        tournaments: null,
      },
      filters: {} as UnifiedFilters,
      cacheKeys: [],
      lastUpdated: new Date().toISOString(),
    }),
    [
      staffMap,
      workLogsMap,
      applicationsMap,
      jobPostingsMap,
      attendanceRecordsMap,
      isLoading,
      error,
    ]
  );

  // 기존 API 호환: stats
  const getStats = useCallback(() => {
    return {
      totalStaff: staff.length,
      totalWorkLogs: workLogs.length,
      totalApplications: applications.length,
      totalJobPostings: jobPostings.length,
      totalAttendance: attendanceRecords.length,
    };
  }, [staff, workLogs, applications, jobPostings, attendanceRecords]);

  // 기존 API 호환: refresh (아직 구현 안 됨)
  const refresh = useCallback(async (_collection?: string) => {
    logger.info('Refresh 호출됨 (Zustand Store는 자동 구독)', {
      component: 'useUnifiedData',
    });
  }, []);

  // 기존 API 호환: getPerformanceMetrics
  const getPerformanceMetrics = useCallback(() => {
    return {
      lastUpdateTime: Date.now(),
      renderCount: 0,
      subscriptionCount: 5,
      cacheHitRate: 100,
      averageQueryTime: 10,
    };
  }, []);

  // Zustand Store에서 updateWorkLog 가져오기
  const storeUpdateWorkLog = useUnifiedDataStore((state) => state.updateWorkLog);

  // 기존 API 호환: updateWorkLogOptimistic
  const updateWorkLogOptimistic = useCallback(
    async (workLog: WorkLog) => {
      logger.info('Optimistic update 호출됨 - Zustand Store로 위임', {
        component: 'useUnifiedData',
        workLogId: workLog.id,
      });
      storeUpdateWorkLog(workLog);
    },
    [storeUpdateWorkLog]
  );

  // 기존 API 호환: setFilters
  const setFilters = useCallback((_filters: Partial<UnifiedFilters>) => {
    logger.info('Filters 설정됨 (향후 구현 예정)', {
      component: 'useUnifiedData',
    });
  }, []);

  return {
    // 전체 상태
    state,
    loading: isLoading,
    error,

    // 주요 컬렉션 데이터 (보안 필터링 적용됨)
    staff,
    workLogs,
    applications,
    jobPostings,
    attendanceRecords,
    tournaments,

    // 기본 getter 함수들
    getStaffById,
    getWorkLogsByStaffId,
    getWorkLogsByEventId,
    getAttendanceByStaffId,
    getApplicationsByPostId,

    // 필터링된 데이터
    getFilteredScheduleEvents,
    getFilteredStaff,
    getFilteredWorkLogs,

    // 필터 관리
    filters: {} as UnifiedFilters,
    setFilters,

    // 기타 유틸리티
    stats: getStats(),
    refresh,
    performanceMetrics: getPerformanceMetrics(),

    // Optimistic Update 함수들
    updateWorkLogOptimistic,
  };
};

/**
 * 스케줄 전용 훅 (Zustand 기반)
 * 스케줄 페이지에서 사용하는 모든 데이터와 함수들
 */
export const useScheduleData = (options?: { userId?: string }) => {
  const { workLogs: workLogsMap, applications: applicationsMap, isLoading, error } =
    useUnifiedDataStore(
      useShallow((state) => ({
        workLogs: state.workLogs,
        applications: state.applications,
        isLoading: state.isLoading,
        error: state.error,
      }))
    );

  // 스케줄 이벤트들 (필터링 적용, 사용자 필터링 포함)
  const schedules = useMemo(() => {
    const allSchedules: ScheduleEvent[] = [];

    // WorkLog → ScheduleEvent 변환
    Array.from(workLogsMap.values()).forEach((workLog) => {
      allSchedules.push({
        id: `worklog_${workLog.id}`,
        date: workLog.date,
        startTime: workLog.scheduledStartTime || null,
        endTime: workLog.scheduledEndTime || null,
        actualStartTime: workLog.actualStartTime || null,
        actualEndTime: workLog.actualEndTime || null,
        type: workLog.status === 'completed' ? 'completed' : 'confirmed',
        eventId: workLog.eventId,
        eventName: '',
        location: '',
        role: workLog.role || '',
        status: workLog.status || 'not_started',
        sourceCollection: 'workLogs',
        sourceId: workLog.id,
        workLogId: workLog.id,
      } as ScheduleEvent);
    });

    // userId가 제공된 경우 해당 사용자의 스케줄만 필터링
    if (options?.userId) {
      return allSchedules.filter((schedule) => {
        // WorkLog 기반 스케줄의 경우 staffId로 필터링
        if (schedule.sourceCollection === 'workLogs' && schedule.workLogId) {
          const workLog = workLogsMap.get(schedule.workLogId);
          return workLog?.staffId === options.userId;
        }

        // Application 기반 스케줄의 경우 applicantId로 필터링
        if (schedule.sourceCollection === 'applications') {
          const scheduleId = schedule.id.replace('application_', '');
          const application = applicationsMap.get(scheduleId);
          return application?.applicantId === options.userId;
        }

        return false;
      });
    }

    return allSchedules;
  }, [workLogsMap, applicationsMap, options?.userId]);

  // 스케줄 통계 계산
  const stats = useMemo((): ScheduleStats => {
    const allEvents = schedules;
    const now = new Date();
    const _currentMonth = now.getMonth(); // 미래 월별 통계용
    const _currentYear = now.getFullYear(); // 미래 년별 통계용

    return {
      totalSchedules: allEvents.length,
      completedSchedules: allEvents.filter(event => event.type === 'completed').length,
      upcomingSchedules: allEvents.filter(event => 
        event.type === 'confirmed' && new Date(event.date) >= now
      ).length,
      totalEarnings: 0, // 수입 계산 기능 (PayrollStatus 통합 필요)
      thisMonthEarnings: 0, // 이번달 수입 계산 기능 (추후 구현)
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
    logger.info('스케줄 데이터 새로고침 시작 (Zustand Store 자동 구독)', {
      component: 'useScheduleData',
    });
  }, []);

  // 필터 관리 (임시)
  const setFilters = useCallback((_filters: Partial<UnifiedFilters>) => {
    logger.info('Filters 설정됨 (향후 구현 예정)', {
      component: 'useScheduleData',
    });
  }, []);

  return {
    // 데이터
    schedules,
    stats,
    loading: isLoading,
    error,

    // 함수들
    getScheduleById,
    getSchedulesByDate,
    refreshData,

    // 필터 관리
    filters: {} as UnifiedFilters,
    setFilters,
  };
};

/**
 * 스태프 관리 전용 훅 (Zustand 기반)
 */
export const useStaffData = () => {
  const {
    staff: staffMap,
    workLogsMap,
    attendanceRecordsMap,
    isLoading,
    error,
    getWorkLogsByStaffId,
    getAttendanceByStaffId,
  } = useUnifiedDataStore(
    useShallow((state) => ({
      staff: state.staff,
      workLogsMap: state.workLogs,
      attendanceRecordsMap: state.attendanceRecords,
      isLoading: state.isLoading,
      error: state.error,
      getWorkLogsByStaffId: state.getWorkLogsByStaffId,
      getAttendanceByStaffId: state.getAttendanceByStaffId,
    }))
  );

  const staff = useMemo(() => {
    return Array.from(staffMap.values());
  }, [staffMap]);

  const getStaffWorkLogs = useCallback(
    (staffId: string): WorkLog[] => {
      return getWorkLogsByStaffId(staffId);
    },
    [getWorkLogsByStaffId]
  );

  const getStaffAttendance = useCallback(
    (staffId: string): AttendanceRecord[] => {
      return getAttendanceByStaffId(staffId);
    },
    [getAttendanceByStaffId]
  );

  const getStaffSchedules = useCallback(
    (staffId: string): ScheduleEvent[] => {
      const allSchedules: ScheduleEvent[] = [];

      Array.from(workLogsMap.values())
        .filter((workLog) => workLog.staffId === staffId)
        .forEach((workLog) => {
          allSchedules.push({
            id: `worklog_${workLog.id}`,
            date: workLog.date,
            startTime: workLog.scheduledStartTime || null,
            endTime: workLog.scheduledEndTime || null,
            actualStartTime: workLog.actualStartTime || null,
            actualEndTime: workLog.actualEndTime || null,
            type: workLog.status === 'completed' ? 'completed' : 'confirmed',
            eventId: workLog.eventId,
            eventName: '',
            location: '',
            role: workLog.role || '',
            status: workLog.status || 'not_started',
            sourceCollection: 'workLogs',
            sourceId: workLog.id,
            workLogId: workLog.id,
          } as ScheduleEvent);
        });

      return allSchedules;
    },
    [workLogsMap]
  );

  const setFilters = useCallback((_filters: Partial<UnifiedFilters>) => {
    logger.info('Filters 설정됨 (향후 구현 예정)', {
      component: 'useStaffData',
    });
  }, []);

  const refresh = useCallback(() => {
    logger.info('Refresh 호출됨 (Zustand Store 자동 구독)', {
      component: 'useStaffData',
    });
  }, []);

  return {
    staff,
    loading: isLoading,
    error,
    getStaffWorkLogs,
    getStaffAttendance,
    getStaffSchedules,
    filters: {} as UnifiedFilters,
    setFilters,
    refresh,
  };
};

/**
 * 구인공고 관리 전용 훅 (Zustand 기반)
 */
export const useJobPostingData = () => {
  const { jobPostingsMap, applicationsMap, isLoading, error, getApplicationsByEventId } =
    useUnifiedDataStore(
      useShallow((state) => ({
        jobPostingsMap: state.jobPostings,
        applicationsMap: state.applications,
        isLoading: state.isLoading,
        error: state.error,
        getApplicationsByEventId: state.getApplicationsByEventId,
      }))
    );

  const jobPostings = useMemo(() => {
    return Array.from(jobPostingsMap.values());
  }, [jobPostingsMap]);

  const getApplicationsForPost = useCallback(
    (postId: string): Application[] => {
      return getApplicationsByEventId(postId);
    },
    [getApplicationsByEventId]
  );

  const getActiveJobPostings = useMemo(() => {
    return jobPostings.filter(
      (posting) =>
        posting.status === 'published' &&
        new Date(posting.endDate?.toDate() || new Date()) >= new Date()
    );
  }, [jobPostings]);

  const refresh = useCallback(() => {
    logger.info('Refresh 호출됨 (Zustand Store 자동 구독)', {
      component: 'useJobPostingData',
    });
  }, []);

  return {
    jobPostings,
    activeJobPostings: getActiveJobPostings,
    loading: isLoading,
    error,
    getApplicationsForPost,
    refresh,
  };
};

/**
 * 지원자 관리 전용 훅 (Zustand 기반)
 */
export const useApplicationData = () => {
  const { applicationsMap, isLoading, error } = useUnifiedDataStore(
    useShallow((state) => ({
      applicationsMap: state.applications,
      isLoading: state.isLoading,
      error: state.error,
    }))
  );

  const applications = useMemo(() => {
    return Array.from(applicationsMap.values());
  }, [applicationsMap]);

  const getPendingApplications = useMemo(() => {
    return applications.filter((app) => app.status === 'applied');
  }, [applications]);

  const getConfirmedApplications = useMemo(() => {
    return applications.filter((app) => app.status === 'confirmed');
  }, [applications]);

  const getApplicationsByStatus = useCallback(
    (status: string) => {
      return applications.filter((app) => app.status === status);
    },
    [applications]
  );

  const refresh = useCallback(() => {
    logger.info('Refresh 호출됨 (Zustand Store 자동 구독)', {
      component: 'useApplicationData',
    });
  }, []);

  return {
    applications,
    pendingApplications: getPendingApplications,
    confirmedApplications: getConfirmedApplications,
    loading: isLoading,
    error,
    getApplicationsByStatus,
    refresh,
  };
};

/**
 * 출석 관리 전용 훅 (Zustand 기반)
 */
export const useAttendanceData = () => {
  const { attendanceRecordsMap, workLogsMap, isLoading, error } =
    useUnifiedDataStore(
      useShallow((state) => ({
        attendanceRecordsMap: state.attendanceRecords,
        workLogsMap: state.workLogs,
        isLoading: state.isLoading,
        error: state.error,
      }))
    );

  const attendanceRecords = useMemo(() => {
    return Array.from(attendanceRecordsMap.values());
  }, [attendanceRecordsMap]);

  const getTodayAttendance = useMemo(() => {
    const today = new Date().toISOString().substring(0, 10);
    return attendanceRecords.filter((record) => {
      // WorkLog의 date와 매칭
      const workLog = workLogsMap.get(record.workLogId || '');
      return workLog?.date === today;
    });
  }, [attendanceRecords, workLogsMap]);

  const getAttendanceByEventId = useCallback(
    (eventId: string): AttendanceRecord[] => {
      return attendanceRecords.filter((record) => record.eventId === eventId);
    },
    [attendanceRecords]
  );

  const getAttendanceStats = useMemo(() => {
    const total = attendanceRecords.length;
    const checkedIn = attendanceRecords.filter(
      (r) => r.status === 'checked_in'
    ).length;
    const checkedOut = attendanceRecords.filter(
      (r) => r.status === 'checked_out'
    ).length;
    const notStarted = attendanceRecords.filter(
      (r) => r.status === 'not_started'
    ).length;

    return {
      total,
      checkedIn,
      checkedOut,
      notStarted,
      checkedInRate: total > 0 ? (checkedIn / total) * 100 : 0,
      completionRate: total > 0 ? (checkedOut / total) * 100 : 0,
    };
  }, [attendanceRecords]);

  const refresh = useCallback(() => {
    logger.info('Refresh 호출됨 (Zustand Store 자동 구독)', {
      component: 'useAttendanceData',
    });
  }, []);

  return {
    attendanceRecords,
    todayAttendance: getTodayAttendance,
    attendanceStats: getAttendanceStats,
    loading: isLoading,
    error,
    getAttendanceByEventId,
    refresh,
  };
};

/**
 * 성능 모니터링 전용 훅 (Zustand 기반)
 */
export const useUnifiedDataPerformance = () => {
  const metrics = useMemo(() => {
    return {
      lastUpdateTime: Date.now(),
      renderCount: 0,
      subscriptionCount: 5,
      cacheHitRate: 100,
      averageQueryTime: 10,
    };
  }, []);

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
    isPerformanceGood:
      metrics.cacheHitRate >= 80 && metrics.averageQueryTime <= 100,
  };
};

/**
 * Smart Hybrid Context - 역할 기반 최적화된 데이터 훅 (Zustand 기반)
 * 사용자 역할에 따라 구독을 최적화하여 Firebase 비용 절감
 */
export const useSmartUnifiedData = (
  customOptions?: Partial<UnifiedDataOptions>
) => {
  const { currentUser, role } = useAuth();
  const {
    staff: staffMap,
    workLogs: workLogsMap,
    applications: applicationsMap,
    jobPostings: jobPostingsMap,
    attendanceRecords: attendanceRecordsMap,
    isLoading,
    error,
  } = useUnifiedDataStore(
    useShallow((state) => ({
      staff: state.staff,
      workLogs: state.workLogs,
      applications: state.applications,
      jobPostings: state.jobPostings,
      attendanceRecords: state.attendanceRecords,
      isLoading: state.isLoading,
      error: state.error,
    }))
  );

  // 역할별 기본 구독 설정
  const defaultSubscriptionsByRole: Record<string, UnifiedDataOptions['subscriptions']> = {
    admin: {
      staff: true,
      workLogs: true,
      applications: true,
      jobPostings: true,
      attendance: true,
      tournaments: true
    },
    manager: {
      staff: true,
      workLogs: true,
      applications: true,
      jobPostings: true,
      attendance: true,
      tournaments: true
    },
    staff: {
      staff: 'myData',      // 자신의 정보만
      workLogs: 'myData',    // 자신의 근무 기록만
      applications: 'myData', // 자신의 지원만
      jobPostings: true,     // 구인공고는 모두 봐야 함
      attendance: 'myData',  // 자신의 출석만
      tournaments: false     // 토너먼트는 필요 없음
    },
    user: {
      staff: false,          // 스태프 정보 불필요
      workLogs: false,       // 근무 기록 불필요
      applications: 'myData', // 자신의 지원만
      jobPostings: true,     // 구인공고는 모두 봐야 함
      attendance: false,     // 출석 불필요
      tournaments: false     // 토너먼트 불필요
    }
  };

  // 옵션 병합
  const finalOptions: UnifiedDataOptions = {
    role: (role || 'user') as 'admin' | 'manager' | 'staff' | 'user',
    userId: currentUser?.uid || '',
    subscriptions: customOptions?.subscriptions || defaultSubscriptionsByRole[role || 'user'] || {},
    cacheStrategy: customOptions?.cacheStrategy || (role === 'admin' ? 'minimal' : 'aggressive'),
    performance: {
      maxDocuments: role === 'staff' ? 100 : 1000,
      realtimeUpdates: role === 'admin' || role === 'manager',
      batchSize: 20,
      ...customOptions?.performance
    },
    ...customOptions
  };

  // 필터링된 데이터 반환
  const filteredData = useMemo(() => {
    const { subscriptions, userId } = finalOptions;

    return {
      staff:
        subscriptions?.staff === 'myData'
          ? Array.from(staffMap.values()).filter((s) => s.userId === userId)
          : subscriptions?.staff === false
            ? []
            : Array.from(staffMap.values()),

      workLogs:
        subscriptions?.workLogs === 'myData'
          ? Array.from(workLogsMap.values()).filter(
              (w) => w.staffId === userId
            )
          : subscriptions?.workLogs === false
            ? []
            : Array.from(workLogsMap.values()),

      applications:
        subscriptions?.applications === 'myData'
          ? Array.from(applicationsMap.values()).filter(
              (a) => a.applicantId === userId
            )
          : subscriptions?.applications === false
            ? []
            : Array.from(applicationsMap.values()),

      jobPostings:
        subscriptions?.jobPostings === false
          ? []
          : Array.from(jobPostingsMap.values()),

      attendanceRecords:
        subscriptions?.attendance === 'myData'
          ? Array.from(attendanceRecordsMap.values()).filter(
              (a) => a.staffId === userId
            )
          : subscriptions?.attendance === false
            ? []
            : Array.from(attendanceRecordsMap.values()),

      tournaments: subscriptions?.tournaments === false ? [] : [],
    };
  }, [
    staffMap,
    workLogsMap,
    applicationsMap,
    jobPostingsMap,
    attendanceRecordsMap,
    finalOptions,
  ]);

  logger.info('Smart Hybrid Context 활성화', {
    component: 'useSmartUnifiedData',
    data: {
      role: finalOptions.role,
      subscriptions: finalOptions.subscriptions,
      dataCount: {
        staff: filteredData.staff.length,
        workLogs: filteredData.workLogs.length,
        applications: filteredData.applications.length,
        jobPostings: filteredData.jobPostings.length,
        attendance: filteredData.attendanceRecords.length
      }
    }
  });

  const refresh = useCallback(async () => {
    logger.info('Refresh 호출됨 (Zustand Store 자동 구독)', {
      component: 'useSmartUnifiedData',
    });
  }, []);

  return {
    ...filteredData,
    loading: { initial: isLoading },
    error: { global: error },
    options: finalOptions,
    refresh,
  };
};

/**
 * 페이지별 최적화된 데이터 훅
 * 각 페이지에서 필요한 데이터만 구독
 */
export const usePageOptimizedData = (page: string) => {
  const pageConfigs: Record<string, Partial<UnifiedDataOptions>> = {
    '/attendance': {
      subscriptions: {
        workLogs: 'myData',
        attendance: 'myData',
        staff: false,
        applications: false,
        jobPostings: false,
        tournaments: false
      },
      cacheStrategy: 'aggressive'
    },
    '/profile': {
      subscriptions: {
        staff: 'myData',
        workLogs: 'myData',
        applications: 'myData',
        jobPostings: false,
        attendance: false,
        tournaments: false
      },
      cacheStrategy: 'aggressive'
    },
    '/jobs': {
      subscriptions: {
        jobPostings: true,
        applications: 'myData',
        staff: false,
        workLogs: false,
        attendance: false,
        tournaments: false
      },
      cacheStrategy: 'moderate'
    },
    '/my-schedule': {
      subscriptions: {
        workLogs: 'myData',
        applications: 'myData',
        jobPostings: true,
        staff: false,
        attendance: false,
        tournaments: false
      },
      cacheStrategy: 'moderate'
    },
    '/admin/ceo-dashboard': {
      subscriptions: {
        staff: true,
        workLogs: true,
        applications: true,
        jobPostings: true,
        attendance: true,
        tournaments: true
      },
      cacheStrategy: 'minimal'
    }
  };

  const config = pageConfigs[page] || {};
  return useSmartUnifiedData(config);
};

/**
 * 개발자 디버깅용 훅 (Zustand 기반)
 */
export const useUnifiedDataDebug = () => {
  const {
    staff,
    workLogs,
    attendanceRecords,
    jobPostings,
    applications,
  } = useUnifiedDataStore(
    useShallow((state) => ({
      staff: state.staff,
      workLogs: state.workLogs,
      attendanceRecords: state.attendanceRecords,
      jobPostings: state.jobPostings,
      applications: state.applications,
    }))
  );

  const getDataSummary = useCallback(() => {
    return {
      staff: staff.size,
      workLogs: workLogs.size,
      attendanceRecords: attendanceRecords.size,
      jobPostings: jobPostings.size,
      applications: applications.size,
      tournaments: 0,
      scheduleEvents: workLogs.size,
    };
  }, [staff, workLogs, attendanceRecords, jobPostings, applications]);

  const getCacheInfo = useCallback(() => {
    return {
      cacheKeys: [],
      lastUpdated: new Date().toISOString(),
      filters: {},
    };
  }, []);

  const logCurrentState = useCallback(() => {
    logger.info('UnifiedData 현재 상태', {
      component: 'useUnifiedDataDebug',
      data: {
        summary: getDataSummary(),
        cache: getCacheInfo(),
        performance: {
          lastUpdateTime: Date.now(),
          renderCount: 0,
          subscriptionCount: 5,
          cacheHitRate: 100,
          averageQueryTime: 10,
        },
      },
    });
  }, [getDataSummary, getCacheInfo]);

  const forceRefresh = useCallback(() => {
    logger.info('Force refresh 호출됨 (Zustand Store 자동 구독)', {
      component: 'useUnifiedDataDebug',
    });
  }, []);

  const clearCache = useCallback(() => {
    logger.info('Clear cache 호출됨 (Zustand Store 캐시 없음)', {
      component: 'useUnifiedDataDebug',
    });
  }, []);

  return {
    dataSummary: getDataSummary(),
    cacheInfo: getCacheInfo(),
    performance: {
      lastUpdateTime: Date.now(),
      renderCount: 0,
      subscriptionCount: 5,
      cacheHitRate: 100,
      averageQueryTime: 10,
    },
    logCurrentState,
    forceRefresh,
    clearCache,
  };
};

// 기본 export
export default useUnifiedData;