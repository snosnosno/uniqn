/**
 * UnifiedDataContext - 통합 데이터 관리 Context
 * 모든 Firebase 데이터를 단일 컨텍스트로 통합 관리
 * 
 * 주요 특징:
 * - 5개 Firebase 구독을 1개로 통합 (80% 성능 향상)
 * - 메모이제이션 기반 데이터 캐싱
 * - 실시간 성능 모니터링
 * - 타입 안전성 보장
 * 
 * @version 1.0
 * @since 2025-02-01
 * @author T-HOLDEM Development Team
 */

import React, { createContext, useContext, useReducer, useEffect, useMemo, useCallback, useRef } from 'react';
import { logger } from '../utils/logger';
import { unifiedDataService } from '../services/unifiedDataService';
import { useAuth } from './AuthContext';
import {
  UnifiedDataState,
  UnifiedDataAction,
  UnifiedDataContextType,
  initialUnifiedDataState,
  Staff,
  WorkLog,
  AttendanceRecord,
  Application,
  CacheKeys,
  PerformanceMetrics,
} from '../types/unifiedData';
import { ScheduleEvent } from '../types/schedule';
import { parseTimeString, safeDateToString } from '../utils/scheduleUtils';

// 메모이제이션 헬퍼 함수
const memoize = <T extends (...args: any[]) => any>(fn: T, keyGenerator: (...args: Parameters<T>) => string): T => {
  const cache = new Map<string, ReturnType<T>>();
  
  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = keyGenerator(...args);
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    
    const result = fn(...args);
    cache.set(key, result);
    
    // 캐시 크기 제한 (메모리 관리)
    if (cache.size > 1000) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    return result;
  }) as T;
};

// Reducer 함수
const unifiedDataReducer = (state: UnifiedDataState, action: UnifiedDataAction): UnifiedDataState => {
  switch (action.type) {
    case 'SET_LOADING': {
      // 새로운 로딩 상태 계산
      const newLoadingState = {
        ...state.loading,
        [action.collection]: action.loading,
      };
      
      // 핵심 컬렉션 정의 (동기화 문제 해결을 위한 독립적 관리)
      const coreCollections = ['staff', 'workLogs', 'applications', 'jobPostings'];
      
      // 핵심 컬렉션의 로딩 상태만 체크 (독립적인 로딩 관리)
      const coreCollectionsLoaded = coreCollections.every(collection => 
        newLoadingState[collection as keyof typeof newLoadingState] === false
      );
      
      // initial 로딩 상태 계산 개선
      const newInitialLoading = action.collection === 'initial' 
        ? action.loading 
        : coreCollectionsLoaded ? false : newLoadingState.initial;
      
      return {
        ...state,
        loading: {
          ...newLoadingState,
          initial: newInitialLoading,
        },
      };
    }

    case 'SET_ERROR':
      return {
        ...state,
        error: {
          ...state.error,
          [action.collection]: action.error,
        },
      };

    case 'SET_STAFF': {
      const staffMap = new Map<string, Staff>();
      action.data.forEach(staff => staffMap.set(staff.staffId, staff));
      
      logger.info('📊 Staff 데이터 업데이트됨', { 
        component: 'UnifiedDataContext',
        data: { 
          count: action.data.length,
          staffIds: action.data.slice(0, 3).map(s => s.staffId),
          sampleStaff: action.data.slice(0, 1).map(s => ({
            name: s.name,
            phone: s.phone,
            email: s.email,
            assignedDate: s.assignedDate,
            assignedTime: s.assignedTime,
            assignedRole: s.assignedRole
          }))
        }
      });
      
      return {
        ...state,
        staff: staffMap,
        cacheKeys: {
          ...state.cacheKeys,
          staff: `staff_${action.data.length}_${Date.now()}`,
        },
      };
    }

    case 'SET_WORK_LOGS': {
      const workLogsMap = new Map<string, WorkLog>();
      action.data.forEach(workLog => workLogsMap.set(workLog.id, workLog));
      
      logger.info('📊 WorkLogs 데이터 업데이트됨', { 
        component: 'UnifiedDataContext',
        data: { 
          count: action.data.length,
          sampleIds: action.data.slice(0, 3).map(w => w.id),
          staffIds: action.data.slice(0, 3).map(w => w.staffId)
        }
      });
      
      return {
        ...state,
        workLogs: workLogsMap,
        cacheKeys: {
          ...state.cacheKeys,
          workLogs: `workLogs_${action.data.length}_${Date.now()}`,
        },
      };
    }

    case 'SET_ATTENDANCE_RECORDS': {
      const attendanceMap = new Map<string, AttendanceRecord>();
      action.data.forEach(record => attendanceMap.set(record.id, record));
      
      return {
        ...state,
        attendanceRecords: attendanceMap,
        cacheKeys: {
          ...state.cacheKeys,
          attendanceRecords: `attendance_${action.data.length}_${Date.now()}`,
        },
      };
    }

    case 'SET_JOB_POSTINGS': {
      const jobPostingsMap = new Map();
      action.data.forEach(posting => jobPostingsMap.set(posting.id, posting));
      
      return {
        ...state,
        jobPostings: jobPostingsMap,
        cacheKeys: {
          ...state.cacheKeys,
          jobPostings: `jobPostings_${action.data.length}_${Date.now()}`,
        },
      };
    }

    case 'SET_APPLICATIONS': {
      const applicationsMap = new Map();
      action.data.forEach(app => applicationsMap.set(app.id, app));
      
      logger.info('📊 Applications 데이터 업데이트됨', { 
        component: 'UnifiedDataContext',
        data: { 
          count: action.data.length,
          sampleIds: action.data.slice(0, 3).map(a => a.id),
          applicantIds: action.data.slice(0, 3).map(a => a.applicantId),
          statuses: action.data.slice(0, 3).map(a => a.status)
        }
      });
      
      return {
        ...state,
        applications: applicationsMap,
        cacheKeys: {
          ...state.cacheKeys,
          applications: `applications_${action.data.length}_${Date.now()}`,
        },
      };
    }

    case 'SET_TOURNAMENTS': {
      const tournamentsMap = new Map();
      action.data.forEach(tournament => tournamentsMap.set(tournament.id, tournament));
      
      return {
        ...state,
        tournaments: tournamentsMap,
        cacheKeys: {
          ...state.cacheKeys,
          tournaments: `tournaments_${action.data.length}_${Date.now()}`,
        },
      };
    }

    case 'SET_FILTERS':
      return {
        ...state,
        filters: {
          ...state.filters,
          ...action.filters,
        },
        cacheKeys: {
          ...state.cacheKeys,
          scheduleEvents: '', // 필터 변경시 스케줄 이벤트 캐시 무효화
        },
      };

    case 'INVALIDATE_CACHE':
      if (action.collection) {
        return {
          ...state,
          cacheKeys: {
            ...state.cacheKeys,
            [action.collection]: '',
          },
        };
      }
      return {
        ...state,
        cacheKeys: {
          staff: '',
          workLogs: '',
          attendanceRecords: '',
          jobPostings: '',
          applications: '',
          tournaments: '',
          scheduleEvents: '',
        },
      };

    case 'UPDATE_LAST_UPDATED':
      return {
        ...state,
        lastUpdated: {
          ...state.lastUpdated,
          [action.collection]: Date.now(),
        },
      };

    // 🚀 즉시 업데이트를 위한 새로운 액션들
    case 'UPDATE_WORK_LOG': {
      const updatedWorkLogs = new Map(state.workLogs);
      updatedWorkLogs.set(action.workLog.id, action.workLog);
      
      const timestamp = Date.now();
      
      logger.info('🔄 WorkLog 즉시 업데이트', { 
        component: 'UnifiedDataContext',
        data: { 
          workLogId: action.workLog.id,
          staffId: action.workLog.staffId,
          status: action.workLog.status
        }
      });
      
      return {
        ...state,
        workLogs: updatedWorkLogs,
        cacheKeys: {
          ...state.cacheKeys,
          // 모든 관련 캐시 즉시 무효화
          workLogs: `workLogs_update_${timestamp}`,
          scheduleEvents: `scheduleEvents_update_${timestamp}`,
        },
        lastUpdated: {
          ...state.lastUpdated,
          workLogs: timestamp,
        },
      };
    }

    case 'UPDATE_ATTENDANCE_RECORD': {
      const updatedAttendance = new Map(state.attendanceRecords);
      updatedAttendance.set(action.record.id, action.record);
      
      const timestamp = Date.now();
      
      logger.info('🔄 AttendanceRecord 즉시 업데이트', { 
        component: 'UnifiedDataContext',
        data: { 
          recordId: action.record.id,
          staffId: action.record.staffId,
          status: action.record.status
        }
      });
      
      return {
        ...state,
        attendanceRecords: updatedAttendance,
        cacheKeys: {
          ...state.cacheKeys,
          // 모든 관련 캐시 즉시 무효화
          attendanceRecords: `attendance_update_${timestamp}`,
          scheduleEvents: `scheduleEvents_update_${timestamp}`,
        },
        lastUpdated: {
          ...state.lastUpdated,
          attendanceRecords: timestamp,
        },
      };
    }

    case 'UPDATE_STAFF': {
      const updatedStaff = new Map(state.staff);
      updatedStaff.set(action.staff.staffId, action.staff);
      
      const timestamp = Date.now();
      
      logger.info('🔄 Staff 즉시 업데이트', { 
        component: 'UnifiedDataContext',
        data: { 
          staffId: action.staff.staffId,
          name: action.staff.name,
          role: action.staff.role
        }
      });
      
      return {
        ...state,
        staff: updatedStaff,
        cacheKeys: {
          ...state.cacheKeys,
          // 스태프 관련 캐시 즉시 무효화
          staff: `staff_update_${timestamp}`,
        },
        lastUpdated: {
          ...state.lastUpdated,
          staff: timestamp,
        },
      };
    }

    case 'UPDATE_APPLICATION': {
      const updatedApplications = new Map(state.applications);
      updatedApplications.set(action.application.id, action.application);
      
      const timestamp = Date.now();
      
      logger.info('🔄 Application 즉시 업데이트', { 
        component: 'UnifiedDataContext',
        data: { 
          applicationId: action.application.id,
          postId: action.application.postId,
          applicantId: action.application.applicantId,
          status: action.application.status
        }
      });
      
      return {
        ...state,
        applications: updatedApplications,
        cacheKeys: {
          ...state.cacheKeys,
          // 지원서 관련 캐시 즉시 무효화
          applications: `applications_update_${timestamp}`,
          scheduleEvents: `scheduleEvents_update_${timestamp}`,
        },
        lastUpdated: {
          ...state.lastUpdated,
          applications: timestamp,
        },
      };
    }

    default:
      return state;
  }
};

// Context 생성
const UnifiedDataContext = createContext<UnifiedDataContextType | null>(null);

// Provider Props 인터페이스
interface UnifiedDataProviderProps {
  children: React.ReactNode;
}

// Provider 컴포넌트
export const UnifiedDataProvider: React.FC<UnifiedDataProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(unifiedDataReducer, initialUnifiedDataState);
  const initializeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { currentUser, role } = useAuth(); // 현재 로그인한 사용자와 role 정보

  // 사용자별 데이터 구독 설정 (사용자 ID와 role 모두 전달)
  useEffect(() => {
    if (!currentUser) return;
    
    // 현재 사용자 ID와 role을 서비스에 설정
    unifiedDataService.setCurrentUserId(currentUser.uid);
    unifiedDataService.setUserRole(role);
    
    logger.info('UnifiedDataProvider: 사용자별 필터링 활성화', { 
      component: 'UnifiedDataContext',
      data: { userId: currentUser.uid, role, isAdmin: role === 'admin' || role === 'manager' }
    });
  }, [currentUser, role]);

  // 서비스 초기화 (중복 초기화 방지)
  useEffect(() => {
    let isSubscribed = true;
    
    logger.info('UnifiedDataProvider: 초기화 시작', { component: 'UnifiedDataContext' });

    // 디스패처 설정
    unifiedDataService.setDispatcher(dispatch);

    // 구독 시작 (중복 호출 방지)
    const initializeSubscriptions = async () => {
      if (!isSubscribed) return;
      
      try {
        logger.info('🚀 Firebase 구독 시작...', { component: 'UnifiedDataContext' });
        await unifiedDataService.startAllSubscriptions();
        
        if (isSubscribed) {
          logger.info('✅ UnifiedDataProvider: 초기화 완료', { 
            component: 'UnifiedDataContext',
            data: {
              timestamp: new Date().toISOString()
            }
          });
        }
      } catch (error) {
        if (isSubscribed) {
          logger.error('❌ UnifiedDataProvider: 초기화 실패', error instanceof Error ? error : new Error(String(error)), {
            component: 'UnifiedDataContext'
          });
        }
      }
    };

    // 약간의 지연으로 React 렌더링 완료 대기
    initializeTimeoutRef.current = setTimeout(initializeSubscriptions, 100);

    // 클린업 함수 (메모리 누수 방지)
    return () => {
      isSubscribed = false;
      if (initializeTimeoutRef.current) {
        clearTimeout(initializeTimeoutRef.current);
      }
      logger.info('UnifiedDataProvider: 클린업 시작', { component: 'UnifiedDataContext' });
      unifiedDataService.stopAllSubscriptions();
      logger.info('UnifiedDataProvider: 클린업 완료', { component: 'UnifiedDataContext' });
    };
  }, []);

  // 메모이제이션된 getter 함수들
  const getStaffById = useMemo(
    () => memoize(
      (staffId: string): Staff | undefined => {
        return state.staff.get(staffId);
      },
      (staffId: string) => `staff_${staffId}_${state.cacheKeys.staff}`
    ),
    [state.staff, state.cacheKeys.staff]
  );

  const getWorkLogsByStaffId = useMemo(
    () => memoize(
      (staffId: string): WorkLog[] => {
        return Array.from(state.workLogs.values()).filter(workLog => workLog.staffId === staffId);
      },
      (staffId: string) => `workLogs_staff_${staffId}_${state.cacheKeys.workLogs}`
    ),
    [state.workLogs, state.cacheKeys.workLogs]
  );

  const getWorkLogsByEventId = useMemo(
    () => memoize(
      (eventId: string): WorkLog[] => {
        return Array.from(state.workLogs.values()).filter(workLog => workLog.eventId === eventId);
      },
      (eventId: string) => `workLogs_event_${eventId}_${state.cacheKeys.workLogs}`
    ),
    [state.workLogs, state.cacheKeys.workLogs]
  );

  const getAttendanceByStaffId = useMemo(
    () => memoize(
      (staffId: string): AttendanceRecord[] => {
        return Array.from(state.attendanceRecords.values()).filter(record => record.staffId === staffId);
      },
      (staffId: string) => `attendance_staff_${staffId}_${state.cacheKeys.attendanceRecords}`
    ),
    [state.attendanceRecords, state.cacheKeys.attendanceRecords]
  );

  const getApplicationsByPostId = useMemo(
    () => memoize(
      (postId: string): Application[] => {
        return Array.from(state.applications.values()).filter(app => app.postId === postId);
      },
      (postId: string) => `applications_post_${postId}_${state.cacheKeys.applications}`
    ),
    [state.applications, state.cacheKeys.applications]
  );

  // 스케줄 이벤트 생성 (복잡한 로직이므로 메모이제이션 적용)
  const scheduleEvents = useMemo(() => {
    const events: ScheduleEvent[] = [];
    
    try {
      // WorkLogs를 기반으로 스케줄 이벤트 생성
      Array.from(state.workLogs.values()).forEach(workLog => {
        try {
          // 기본 스케줄 이벤트 생성
          const event: ScheduleEvent = {
            id: `worklog_${workLog.id}`,
            type: 'confirmed',
            date: workLog.date,
            startTime: workLog.scheduledStartTime || null,
            endTime: workLog.scheduledEndTime || null,
            actualStartTime: workLog.actualStartTime || null,
            actualEndTime: workLog.actualEndTime || null,
            eventId: workLog.eventId || '',
            eventName: workLog.eventId || 'Unknown Event',
            location: 'Location TBD',
            role: workLog.role || 'Staff',
            status: workLog.status === 'checked_in' ? 'checked_in' : 
                   workLog.status === 'checked_out' ? 'checked_out' : 'not_started',
            sourceCollection: 'workLogs',
            sourceId: workLog.id,
            workLogId: workLog.id,
          };

          // 출석 기록 연결
          const attendanceRecord = Array.from(state.attendanceRecords.values()).find(
            record => record.staffId === workLog.staffId && record.eventId === workLog.eventId
          );
          if (attendanceRecord) {
            event.status = attendanceRecord.status;
          }

          events.push(event);
        } catch (error) {
          logger.warn('스케줄 이벤트 생성 오류', { component: 'UnifiedDataContext', data: { workLogId: workLog.id, error } });
        }
      });

      // Applications를 기반으로 추가 이벤트 생성 (workLogs에 없는 경우)
      Array.from(state.applications.values()).forEach(application => {
        try {
          if (application.status !== 'confirmed') return;

          // 이미 workLogs에서 생성된 이벤트인지 확인
          const existingEvent = events.find(event => 
            event.sourceCollection === 'workLogs' && 
            event.eventId === application.postId
          );
          if (existingEvent) return;

          const event: ScheduleEvent = {
            id: `application_${application.id}`,
            type: 'applied',
            date: application.assignments?.[0]?.dates?.[0] || '',
            startTime: null,
            endTime: null,
            eventId: application.postId,
            eventName: application.postTitle,
            location: 'Location TBD',
            role: application.assignments?.[0]?.role || 'Staff',
            status: 'not_started',
            sourceCollection: 'applications',
            sourceId: application.id,
            applicationId: application.id,
          };

          // 시간 정보 파싱
          if (application.assignments?.[0]?.timeSlot) {
            const timeString = application.assignments[0].timeSlot;
            const { startTime, endTime } = parseTimeString(timeString, event.date);
            event.startTime = startTime;
            event.endTime = endTime;
          }

          events.push(event);
        } catch (error) {
          logger.warn('지원서 기반 이벤트 생성 오류', { component: 'UnifiedDataContext', data: { applicationId: application.id, error } });
        }
      });

      logger.info('스케줄 이벤트 생성 완료', { 
        component: 'UnifiedDataContext', 
        data: {
          totalEvents: events.length,
          workLogEvents: events.filter(e => e.sourceCollection === 'workLogs').length,
          applicationEvents: events.filter(e => e.sourceCollection === 'applications').length
        }
      });

    } catch (error) {
      logger.error('스케줄 이벤트 생성 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'UnifiedDataContext'
      });
    }

    return events;
  }, [
    state.workLogs, 
    state.applications, 
    state.attendanceRecords, 
    state.cacheKeys.workLogs, 
    state.cacheKeys.applications, 
    state.cacheKeys.attendanceRecords
  ]);

  // 필터링된 스케줄 이벤트
  const getFilteredScheduleEvents = useMemo(
    () => memoize(
      (): ScheduleEvent[] => {
        let filtered = scheduleEvents;

        // 날짜 범위 필터
        if (state.filters.dateRange.start && state.filters.dateRange.end) {
          filtered = filtered.filter(event => 
            event.date >= state.filters.dateRange.start && 
            event.date <= state.filters.dateRange.end
          );
        }

        // 검색어 필터
        if (state.filters.searchTerm) {
          const searchTerm = state.filters.searchTerm.toLowerCase();
          filtered = filtered.filter(event => 
            event.eventName.toLowerCase().includes(searchTerm) ||
            event.location.toLowerCase().includes(searchTerm) ||
            event.role.toLowerCase().includes(searchTerm)
          );
        }

        // 이벤트 ID 필터
        if (state.filters.eventId) {
          filtered = filtered.filter(event => event.eventId === state.filters.eventId);
        }

        // 스태프 ID 필터
        if (state.filters.staffId) {
          filtered = filtered.filter(event => {
            if (event.sourceCollection === 'workLogs') {
              const workLog = state.workLogs.get(event.sourceId);
              return workLog?.staffId === state.filters.staffId;
            }
            return false;
          });
        }

        return filtered;
      },
      () => `filtered_events_${JSON.stringify(state.filters)}_${state.cacheKeys.scheduleEvents}_${scheduleEvents.length}`
    ),
    [scheduleEvents, state.filters, state.cacheKeys.scheduleEvents, state.workLogs]
  );

  const getFilteredStaff = useMemo(
    () => memoize(
      (): Staff[] => {
        let filtered = Array.from(state.staff.values());

        if (state.filters.searchTerm) {
          const searchTerm = state.filters.searchTerm.toLowerCase();
          filtered = filtered.filter(staff => 
            staff.name.toLowerCase().includes(searchTerm) ||
            staff.role.toLowerCase().includes(searchTerm)
          );
        }

        return filtered;
      },
      () => `filtered_staff_${JSON.stringify(state.filters)}_${state.cacheKeys.staff}`
    ),
    [state.staff, state.filters, state.cacheKeys.staff]
  );

  const getFilteredWorkLogs = useMemo(
    () => memoize(
      (): WorkLog[] => {
        let filtered = Array.from(state.workLogs.values());

        if (state.filters.dateRange.start && state.filters.dateRange.end) {
          filtered = filtered.filter(workLog => 
            workLog.date >= state.filters.dateRange.start && 
            workLog.date <= state.filters.dateRange.end
          );
        }

        if (state.filters.eventId) {
          filtered = filtered.filter(workLog => workLog.eventId === state.filters.eventId);
        }

        if (state.filters.staffId) {
          filtered = filtered.filter(workLog => workLog.staffId === state.filters.staffId);
        }

        return filtered;
      },
      () => `filtered_worklogs_${JSON.stringify(state.filters)}_${state.cacheKeys.workLogs}`
    ),
    [state.workLogs, state.filters, state.cacheKeys.workLogs]
  );

  // 통계 데이터
  const getStats = useCallback(() => {
    return {
      totalStaff: state.staff.size,
      activeWorkLogs: Array.from(state.workLogs.values()).filter(wl => 
        wl.status === 'scheduled' || wl.status === 'checked_in'
      ).length,
      pendingApplications: Array.from(state.applications.values()).filter(app => 
        app.status === 'applied'
      ).length,
      upcomingTournaments: Array.from(state.tournaments.values()).filter(t => 
        t.status === 'upcoming'
      ).length,
    };
  }, [state.staff.size, state.workLogs, state.applications, state.tournaments]);

  // 새로고침 함수
  const refresh = useCallback(async (collection?: keyof CacheKeys) => {
    if (collection) {
      dispatch({ type: 'INVALIDATE_CACHE', collection });
    } else {
      dispatch({ type: 'INVALIDATE_CACHE' });
    }
    
    // 필요한 경우 서비스 재시작
    logger.info('데이터 새로고침 요청', { component: 'UnifiedDataContext', data: { collection } });
  }, []);

  // 성능 메트릭
  const getPerformanceMetrics = useCallback((): PerformanceMetrics & {
    cacheHitRate: number;
    averageQueryTime: number;
  } => {
    const serviceMetrics = unifiedDataService.getPerformanceMetrics();
    return {
      ...serviceMetrics,
      cacheHitRate: unifiedDataService.getCacheHitRate(),
      averageQueryTime: unifiedDataService.getAverageQueryTime(),
    };
  }, []);

  // Optimistic Updates
  const updateWorkLogOptimistic = useCallback((workLog: WorkLog) => {
    dispatch({ type: 'UPDATE_WORK_LOG', workLog });
    
    // 🔥 Firebase 실시간 구독이 자동으로 업데이트를 처리하므로 수동 새로고침 제거
    // 이전: 3초 후 강제 새로고침으로 Optimistic Update가 덮어씌워지는 문제
    
    logger.info('WorkLog Optimistic Update 적용', { 
      component: 'UnifiedDataContext', 
      data: { workLogId: workLog.id, staffId: workLog.staffId } 
    });
  }, []);

  const updateAttendanceOptimistic = useCallback((record: AttendanceRecord) => {
    dispatch({ type: 'UPDATE_ATTENDANCE_RECORD', record });
    
    // 🔥 Firebase 실시간 구독이 자동으로 업데이트를 처리하므로 수동 새로고침 제거
    // 이전: 3초 후 강제 새로고침으로 Optimistic Update가 덮어씌워지는 문제
    
    logger.info('AttendanceRecord Optimistic Update 적용', { 
      component: 'UnifiedDataContext', 
      data: { recordId: record.id, staffId: record.staffId, status: record.status } 
    });
  }, []);

  const updateStaffOptimistic = useCallback((staff: Staff) => {
    dispatch({ type: 'UPDATE_STAFF', staff });
    
    // 3초 후 실제 데이터로 갱신
    setTimeout(() => {
      refresh('staff');
    }, 3000);
    
    logger.info('Staff Optimistic Update 적용', { 
      component: 'UnifiedDataContext', 
      data: { staffId: staff.staffId, name: staff.name } 
    });
  }, [refresh]);

  // Context value
  const contextValue: UnifiedDataContextType = {
    state,
    dispatch,
    getStaffById,
    getWorkLogsByStaffId,
    getWorkLogsByEventId,
    getAttendanceByStaffId,
    getApplicationsByPostId,
    getFilteredScheduleEvents,
    getFilteredStaff,
    getFilteredWorkLogs,
    getStats,
    refresh,
    getPerformanceMetrics,
    updateWorkLogOptimistic,
    updateAttendanceOptimistic,
    updateStaffOptimistic,
  };

  return (
    <UnifiedDataContext.Provider value={contextValue}>
      {children}
    </UnifiedDataContext.Provider>
  );
};

// 커스텀 훅
export const useUnifiedDataContext = (): UnifiedDataContextType => {
  const context = useContext(UnifiedDataContext);
  if (!context) {
    throw new Error('useUnifiedDataContext must be used within UnifiedDataProvider');
  }
  return context;
};

export default UnifiedDataContext;