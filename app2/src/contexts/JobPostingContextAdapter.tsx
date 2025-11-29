/**
 * JobPostingContextAdapter
 *
 * @deprecated 이 Context Adapter는 하위 호환성을 위해 유지됩니다.
 * 새로운 코드에서는 Zustand store를 직접 사용하세요.
 *
 * 마이그레이션 가이드:
 * ```typescript
 * // ❌ 기존 방식 (deprecated)
 * import { useJobPostingContext } from '@/contexts/JobPostingContextAdapter';
 * const { jobPosting, applicants, workLogs } = useJobPostingContext();
 *
 * // ✅ 권장 방식 - Zustand store 직접 사용
 * import { useJobPostingStore } from '@/stores/jobPostingStore';
 * import { useUnifiedDataStore } from '@/stores/unifiedDataStore';
 * import { useShallow } from 'zustand/react/shallow';
 *
 * // 공고 정보
 * const { jobPosting, applicants, staff } = useJobPostingStore(
 *   useShallow(state => ({
 *     jobPosting: state.jobPosting,
 *     applicants: state.applicants,
 *     staff: state.staff
 *   }))
 * );
 *
 * // WorkLogs 정보
 * const workLogs = useUnifiedDataStore(state => state.getWorkLogsByEventId(eventId));
 * ```
 *
 * @see stores/jobPostingStore.ts - 공고/지원자/스태프 데이터
 * @see stores/unifiedDataStore.ts - WorkLogs 데이터
 */
import React, {
  createContext,
  useContext,
  useEffect,
  ReactNode,
  useMemo,
  useCallback,
} from 'react';
import { useJobPostingStore } from '../stores/jobPostingStore';
import { useAuth } from './AuthContext';
import { useUnifiedDataStore } from '../stores/unifiedDataStore';
import { useShallow } from 'zustand/react/shallow';
import { UnifiedWorkLog } from '../types/unified/workLog';
import { WorkLog } from '../types/unifiedData';

// 기존 컨텍스트 타입 유지 + workLogs 추가
interface JobPostingContextType {
  jobPosting: unknown | null;
  loading: boolean;
  error: Error | null;
  refreshJobPosting: () => Promise<void>;
  applicants: unknown[];
  staff: unknown[];
  refreshApplicants: () => Promise<void>;
  refreshStaff: () => void;
  // WorkLogs 관련 추가
  workLogs: UnifiedWorkLog[];
  workLogsLoading: boolean;
  workLogsError: Error | null;
  refreshWorkLogs: () => void;
}

const JobPostingContext = createContext<JobPostingContextType | undefined>(undefined);

interface JobPostingProviderProps {
  children: ReactNode;
  eventId: string;
}

// WorkLog 상태를 UnifiedWorkLog 상태로 변환
const convertWorkLogStatus = (
  status?: 'not_started' | 'checked_in' | 'checked_out' | 'completed' | 'absent'
): 'not_started' | 'checked_in' | 'checked_out' | 'completed' | 'cancelled' | undefined => {
  if (!status) return undefined;
  // 'absent'를 'cancelled'로 매핑 (두 타입의 차이)
  if (status === 'absent') return 'cancelled';
  return status;
};

// WorkLog → UnifiedWorkLog 변환 함수
const convertToUnifiedWorkLog = (workLog: WorkLog): UnifiedWorkLog => ({
  id: workLog.id,
  eventId: workLog.eventId,
  staffId: workLog.staffId,
  staffName: workLog.staffName || '',
  date: workLog.date,
  role: workLog.role || workLog.assignmentInfo?.role || '',
  status: convertWorkLogStatus(workLog.status),
  scheduledStartTime: workLog.scheduledStartTime || undefined,
  scheduledEndTime: workLog.scheduledEndTime || undefined,
  actualStartTime: workLog.actualStartTime || undefined,
  actualEndTime: workLog.actualEndTime || undefined,
  assignedTime: workLog.assignedTime || undefined,
  hoursWorked: workLog.hoursWorked,
  notes: workLog.notes,
  createdAt: workLog.createdAt,
  updatedAt: workLog.updatedAt,
  snapshotData: workLog.snapshotData,
});

// Zustand store를 Context API로 감싸는 어댑터
export const JobPostingProvider: React.FC<JobPostingProviderProps> = ({ children, eventId }) => {
  const { currentUser } = useAuth();
  const {
    setEventId,
    cleanup,
    refreshApplicants,
    refreshStaff,
    jobPosting,
    loading,
    error,
    applicants,
    staff,
  } = useJobPostingStore();

  // WorkLogs를 UnifiedDataStore에서 가져오기 (중복 구독 방지)
  // 기존: useUnifiedWorkLogs로 별도 Firebase 구독 → 이제: 전역 Store에서 필터링
  const {
    workLogsMap,
    isLoading: workLogsLoading,
    error: storeError,
    getWorkLogsByEventId,
  } = useUnifiedDataStore(
    useShallow((state) => ({
      workLogsMap: state.workLogs,
      isLoading: state.isLoading,
      error: state.error,
      getWorkLogsByEventId: state.getWorkLogsByEventId,
    }))
  );

  // eventId로 필터링된 workLogs (클라이언트 사이드)
  const workLogs = useMemo((): UnifiedWorkLog[] => {
    if (!eventId) return [];
    const filtered = getWorkLogsByEventId(eventId);
    return filtered.map(convertToUnifiedWorkLog);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, getWorkLogsByEventId, workLogsMap]); // workLogsMap 의존성으로 실시간 업데이트

  // 에러 변환 불필요 (이미 Error 타입)
  const workLogsError = storeError;

  // refreshWorkLogs는 이제 no-op (Zustand Store 자동 구독)
  const refreshWorkLogs = useCallback(() => {
    // Zustand Store는 자동으로 실시간 업데이트되므로 별도 refresh 불필요
    // 기존 API 호환성을 위해 빈 함수 유지
  }, []);

  // eventId 변경 시 store 업데이트
  useEffect(() => {
    setEventId(eventId);
  }, [eventId, setEventId]);

  // 컴포넌트 언마운트 시에만 cleanup 호출
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // 지원자와 스태프 데이터 구독
  useEffect(() => {
    if (eventId && currentUser) {
      refreshApplicants();
      refreshStaff();
    }
  }, [eventId, currentUser, refreshApplicants, refreshStaff]);

  const value: JobPostingContextType = React.useMemo(
    () => ({
      jobPosting,
      loading,
      error,
      refreshJobPosting: useJobPostingStore.getState().refreshJobPosting,
      applicants,
      staff,
      refreshApplicants,
      refreshStaff: () => {
        // 스태프 데이터와 WorkLogs 데이터를 함께 새로고침
        refreshStaff();
        refreshWorkLogs();
      },
      // WorkLogs 데이터 추가
      workLogs: workLogs || [],
      workLogsLoading: workLogsLoading || false,
      workLogsError: workLogsError || null,
      refreshWorkLogs,
    }),
    [
      jobPosting,
      loading,
      error,
      applicants,
      staff,
      refreshApplicants,
      refreshStaff,
      workLogs,
      workLogsLoading,
      workLogsError,
      refreshWorkLogs,
    ]
  );

  return <JobPostingContext.Provider value={value}>{children}</JobPostingContext.Provider>;
};

// 기존 컨텍스트 hook 유지 (하위 호환성)
export const useJobPostingContext = () => {
  const context = useContext(JobPostingContext);
  if (context === undefined) {
    throw new Error('useJobPostingContext must be used within a JobPostingProvider');
  }
  return context;
};
