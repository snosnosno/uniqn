import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, doc, deleteDoc, updateDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../contexts/AuthContext';
import { useJobPostingContext } from '../contexts/JobPostingContextAdapter';
import { useToast } from '../hooks/useToast';
import { db } from '../firebase';
import { formatDate } from '../utils/jobPosting/dateUtils';
import { UnifiedWorkLog } from '../types/unified/workLog';
import { logger } from '../utils/logger';

// Person 통합 타입 사용
import { Person, isStaff } from '../types/unified/person';
import { usePersons } from './usePersons';
import { personToLegacyStaff } from '../utils/compatibilityAdapter';

// 업무 역할 정의
type JobRole = 
  | 'Dealer'              // 딜러
  | 'Floor'               // 플로어
  | 'Server'              // 서빙
  | 'Tournament Director' // 토너먼트 디렉터
  | 'Chip Master'         // 칩 마스터
  | 'Registration'        // 레지
  | 'Security'            // 보안요원
  | 'Cashier';            // 캐셔

// 계정 권한은 기존 유지
type UserRole = 'staff' | 'manager' | 'admin' | 'pending_manager';

// 기존 StaffData 인터페이스를 Person 기반으로 재정의
interface StaffData {
  id: string;
  userId: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: JobRole;         // 업무 역할 (딜러, 플로어 등)
  userRole?: UserRole;    // 계정 권한 (dealer, manager, admin 등)
  gender?: string;
  age?: number;
  experience?: string;
  nationality?: string;
  history?: string;
  notes?: string;
  postingId: string;
  postingTitle: string;
  assignedEvents?: string[]; // 스태프가 등록된 모든 공고 ID 배열
  assignedRole?: string;     // 지원자에서 확정된 역할
  assignedTime?: string;     // 지원자에서 확정된 시간
  assignedDate?: string;     // 할당된 날짜 (yyyy-MM-dd 형식)
  
  // Person 타입 추가 필드
  personId?: string;  // Person.id 참조
  type?: 'staff' | 'applicant' | 'both';
}

interface StaffFilters {
  searchTerm: string;
  selectedDate: string;
  selectedRole: string;
  selectedStatus: string;
}

interface GroupedStaffData {
  grouped: Record<string, StaffData[]>;
  sortedDates: string[];
}

interface UseStaffManagementOptions {
  jobPostingId?: string;
  enableFiltering?: boolean;
  useLegacyCollection?: boolean;  // 레거시 staff 컬렉션 사용 여부
}

interface UseStaffManagementReturn {
  // 데이터
  staffData: StaffData[];
  groupedStaffData: GroupedStaffData;
  availableDates: string[];
  availableRoles: string[];
  workLogsData: UnifiedWorkLog[];
  
  // 상태
  loading: boolean;
  error: string | null;
  
  // 필터 상태
  filters: StaffFilters;
  setFilters: React.Dispatch<React.SetStateAction<StaffFilters>>;
  
  // 그룹화 상태
  expandedDates: Set<string>;
  groupByDate: boolean;
  setGroupByDate: (value: boolean) => void;
  
  // 액션
  deleteStaff: (staffId: string) => Promise<void>;
  refreshStaffData: () => Promise<void>;
  toggleDateExpansion: (date: string) => void;
  
  // 유틸리티
  formatTimeDisplay: (time: string | undefined) => string;
  getTimeSlotColor: (time: string | undefined) => string;
  getStaffCountByDate: (date: string) => number;
  getStaffWorkLog: (staffId: string, date: string) => UnifiedWorkLog | null;
}

/**
 * Staff Management Hook V2
 * Person 컬렉션을 사용하는 새로운 버전
 * 레거시 모드 지원으로 점진적 마이그레이션 가능
 */
export const useStaffManagementV2 = (
  options: UseStaffManagementOptions = {}
): UseStaffManagementReturn => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { jobPosting } = useJobPostingContext();
  const { showSuccess, showError } = useToast();
  
  const { 
    jobPostingId = jobPosting?.id, 
    enableFiltering = true,
    useLegacyCollection = false  // 기본값: Person 컬렉션 사용
  } = options;

  // Person 데이터 로드 (새로운 방식)
  const { 
    persons, 
    staff: legacyStaffFromPersons, 
    loading: personsLoading, 
    error: personsError 
  } = usePersons({ type: 'staff' });

  // 상태 관리
  const [staffData, setStaffData] = useState<StaffData[]>([]);
  const [workLogsData, setWorkLogsData] = useState<UnifiedWorkLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupByDate, setGroupByDate] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  
  // 필터 상태
  const [filters, setFilters] = useState<StaffFilters>({
    searchTerm: '',
    selectedDate: '',
    selectedRole: '',
    selectedStatus: ''
  });

  // Person 데이터를 StaffData로 변환
  useEffect(() => {
    if (useLegacyCollection) {
      // 레거시 모드: 기존 staff 컬렉션 사용
      // 기존 useStaffManagement 로직 유지
      logger.info('레거시 staff 컬렉션 사용', { component: 'useStaffManagementV2' });
      // TODO: 기존 로직 구현
    } else {
      // 새로운 모드: Person 컬렉션 사용
      const staffFromPersons = persons
        .filter(isStaff)
        .map(person => {
          const legacyStaff = personToLegacyStaff(person);
          return {
            ...legacyStaff,
            personId: person.id,
            type: person.type,
            postingId: jobPostingId || '',
            postingTitle: jobPosting?.title || ''
          } as StaffData;
        });
      
      setStaffData(staffFromPersons);
      setLoading(personsLoading);
      setError(personsError);
      
      logger.debug('Person 데이터로부터 Staff 변환', {
        component: 'useStaffManagementV2',
        data: {
          personCount: persons.length,
          staffCount: staffFromPersons.length
        }
      });
    }
  }, [persons, personsLoading, personsError, useLegacyCollection, jobPostingId, jobPosting]);

  // WorkLogs 구독
  useEffect(() => {
    if (!jobPostingId) {
      setWorkLogsData([]);
      return;
    }

    const workLogsQuery = query(
      collection(db, 'workLogs'),
      where('eventId', '==', jobPostingId)
    );

    const unsubscribe = onSnapshot(
      workLogsQuery,
      (snapshot) => {
        const logs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as UnifiedWorkLog));
        
        setWorkLogsData(logs);
        
        logger.debug('WorkLogs 로드', {
          component: 'useStaffManagementV2',
          data: { count: logs.length, jobPostingId }
        });
      },
      (err) => {
        logger.error('WorkLogs 로드 실패', err, {
          component: 'useStaffManagementV2'
        });
      }
    );

    return () => unsubscribe();
  }, [jobPostingId]);

  // 필터링된 스태프 데이터
  const filteredStaffData = useMemo(() => {
    if (!enableFiltering) return staffData;
    
    return staffData.filter(staff => {
      // 검색어 필터
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const nameMatch = staff.name?.toLowerCase().includes(searchLower);
        const phoneMatch = staff.phone?.toLowerCase().includes(searchLower);
        const emailMatch = staff.email?.toLowerCase().includes(searchLower);
        
        if (!nameMatch && !phoneMatch && !emailMatch) return false;
      }
      
      // 날짜 필터
      if (filters.selectedDate && staff.assignedDate !== filters.selectedDate) {
        return false;
      }
      
      // 역할 필터
      if (filters.selectedRole && staff.assignedRole !== filters.selectedRole) {
        return false;
      }
      
      return true;
    });
  }, [staffData, filters, enableFiltering]);

  // 그룹화된 데이터
  const groupedStaffData = useMemo((): GroupedStaffData => {
    if (!groupByDate) {
      return {
        grouped: { '전체': filteredStaffData },
        sortedDates: ['전체']
      };
    }

    const grouped: Record<string, StaffData[]> = {};
    
    filteredStaffData.forEach(staff => {
      const date = staff.assignedDate || '날짜 미정';
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date]?.push(staff);
    });

    const sortedDates = Object.keys(grouped).sort((a, b) => {
      if (a === '날짜 미정') return 1;
      if (b === '날짜 미정') return -1;
      return a.localeCompare(b);
    });

    return { grouped, sortedDates };
  }, [filteredStaffData, groupByDate]);

  // 사용 가능한 날짜 목록
  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    staffData.forEach(staff => {
      if (staff.assignedDate) {
        dates.add(staff.assignedDate);
      }
    });
    return Array.from(dates).sort();
  }, [staffData]);

  // 사용 가능한 역할 목록
  const availableRoles = useMemo(() => {
    const roles = new Set<string>();
    staffData.forEach(staff => {
      if (staff.assignedRole) {
        roles.add(staff.assignedRole);
      }
    });
    return Array.from(roles).sort();
  }, [staffData]);

  // 스태프 삭제
  const deleteStaff = useCallback(async (staffId: string) => {
    try {
      if (useLegacyCollection) {
        // 레거시: persons 컬렉션에서 삭제 (레거시 모드도 persons 사용)
        await deleteDoc(doc(db, 'persons', staffId));
      } else {
        // 새로운 방식: persons 컬렉션에서 타입 변경
        // 완전 삭제 대신 타입을 'applicant'로 변경
        const personRef = doc(db, 'persons', staffId);
        await updateDoc(personRef, {
          type: 'applicant',
          updatedAt: Timestamp.now()
        });
      }
      
      showSuccess(t('staff.deleteSuccess'));
      logger.info('스태프 삭제/변경 성공', {
        component: 'useStaffManagementV2',
        data: { staffId }
      });
    } catch (err) {
      logger.error('스태프 삭제 실패', err as Error, {
        component: 'useStaffManagementV2'
      });
      showError(t('staff.deleteFailed'));
      throw err;
    }
  }, [useLegacyCollection, showSuccess, showError, t]);

  // 데이터 새로고침
  const refreshStaffData = useCallback(async () => {
    // Person 컬렉션은 실시간 구독이므로 자동 새로고침
    logger.info('데이터 새로고침 요청', { component: 'useStaffManagementV2' });
  }, []);

  // 날짜 확장/축소 토글
  const toggleDateExpansion = useCallback((date: string) => {
    setExpandedDates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  }, []);

  // 유틸리티 함수들
  const formatTimeDisplay = useCallback((time: string | undefined): string => {
    return time || '시간 미정';
  }, []);

  const getTimeSlotColor = useCallback((time: string | undefined): string => {
    if (!time) return 'bg-gray-100';
    const hour = parseInt(time.split(':')[0] || '0');
    if (hour < 12) return 'bg-blue-100';
    if (hour < 18) return 'bg-green-100';
    return 'bg-purple-100';
  }, []);

  const getStaffCountByDate = useCallback((date: string): number => {
    return staffData.filter(staff => staff.assignedDate === date).length;
  }, [staffData]);

  const getStaffWorkLog = useCallback((staffId: string, date: string): UnifiedWorkLog | null => {
    // staffId로 검색
    return workLogsData.find(log => 
      log.staffId === staffId && 
      log.date === date
    ) || null;
  }, [workLogsData]);

  return {
    staffData: filteredStaffData,
    groupedStaffData,
    availableDates,
    availableRoles,
    workLogsData,
    loading,
    error,
    filters,
    setFilters,
    expandedDates,
    groupByDate,
    setGroupByDate,
    deleteStaff,
    refreshStaffData,
    toggleDateExpansion,
    formatTimeDisplay,
    getTimeSlotColor,
    getStaffCountByDate,
    getStaffWorkLog
  };
};

// 기본 export (점진적 마이그레이션을 위해 이름 유지)
export const useStaffManagement = useStaffManagementV2;