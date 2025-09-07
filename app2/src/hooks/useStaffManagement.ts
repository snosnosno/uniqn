import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, doc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../contexts/AuthContext';
import { useJobPostingContext } from '../contexts/JobPostingContextAdapter';
import { useToast } from '../hooks/useToast';
import { db } from '../firebase';
import { formatDate } from '../utils/jobPosting/dateUtils';
import { UnifiedWorkLog } from '../types/unified/workLog';
import { logger } from '../utils/logger';

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
  region?: string;          // 지역 정보 추가
  history?: string;
  notes?: string;
  postingId: string;
  postingTitle: string;
  
  // 은행 정보
  bankName?: string;        // 은행명
  bankAccount?: string;     // 계좌번호
  residentId?: string;      // 주민등록번호 뒷자리
  assignedEvents?: string[]; // 스태프가 등록된 모든 공고 ID 배열
  assignedRole?: string;     // 지원자에서 확정된 역할
  /** @deprecated - workLog의 scheduledStartTime/scheduledEndTime 사용 권장. 하위 호환성을 위해 유지 */
  assignedTime?: string;     // 지원자에서 확정된 시간
  assignedDate?: string;     // 할당된 날짜 (yyyy-MM-dd 형식)
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
  eventId?: string;
  enableFiltering?: boolean;
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

export const useStaffManagement = (
  options: UseStaffManagementOptions = {}
): UseStaffManagementReturn => {
  const { 
    eventId, 
    enableFiltering = true 
  } = options;
  
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const { staff: _staff, workLogs, workLogsLoading } = useJobPostingContext();
  
  // 기본 상태
  const [staffData, setStaffData] = useState<StaffData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // workLogs 상태 추가
  const [workLogsData, setWorkLogsData] = useState<UnifiedWorkLog[]>([]);
  const [workLogsMap, setWorkLogsMap] = useState<Record<string, UnifiedWorkLog>>({});
  
  // 필터 상태
  const [filters, setFilters] = useState<StaffFilters>({
    searchTerm: '',
    selectedDate: 'all',
    selectedRole: 'all',
    selectedStatus: 'all'
  });
  
  // 그룹화 상태
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const groupByDate = true; // 항상 날짜별 그룹화 사용
  const setGroupByDate = (_value: boolean) => {}; // 호환성을 위한 no-op 함수
  
  // 수동 새로고침 함수 (필요시에만 사용)
  const refreshStaffData = useCallback(async () => {
    // 실시간 구독이 활성화되어 있으므로 별도 액션 불필요
    // 만약 필요하다면 여기서 강제 새로고침 로직 추가 가능
  }, []);
  
  // 스태프 데이터 실시간 구독
  useEffect(() => {
    if (!currentUser || !eventId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);


    // 실시간 구독 설정 - persons 컬렉션 사용
    const staffQuery = query(
      collection(db, 'persons'), 
      where('type', 'in', ['staff', 'both']),
      where('managerId', '==', currentUser.uid),
      where('postingId', '==', eventId)
    );

    const unsubscribe = onSnapshot(
      staffQuery,
      (snapshot) => {
        
        const staffList: StaffData[] = [];
        
        // 기존 데이터와 비교하여 실제로 변경된 것만 처리
        const currentStaffMap = new Map(staffData.map(staff => [staff.id, staff]));
        
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const docId = doc.id;
          
          // 기존 데이터와 비교
          const existingStaff = currentStaffMap.get(docId);
          
          // assignedDate를 문자열로 변환 (메모이제이션 적용)
          let assignedDateString = data.assignedDate;
          if (data.assignedDate) {
            if (typeof data.assignedDate === 'object' && 'seconds' in data.assignedDate) {
              const date = new Date(data.assignedDate.seconds * 1000);
              assignedDateString = date.toISOString().split('T')[0] || '';
            }
            else if (typeof data.assignedDate === 'string' && data.assignedDate.startsWith('Timestamp(')) {
              const match = data.assignedDate.match(/seconds=(\d+)/);
              if (match?.[1]) {
                const seconds = parseInt(match[1], 10);
                assignedDateString = new Date(seconds * 1000).toISOString().split('T')[0] || '';
              }
            }
            else if (typeof data.assignedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.assignedDate)) {
              assignedDateString = data.assignedDate;
            }
          }
          
          // 데이터가 실제로 변경되었는지 확인
          const hasChanged = !existingStaff ||
            existingStaff.name !== data.name ||
            existingStaff.assignedDate !== assignedDateString ||
            existingStaff.assignedTime !== data.assignedTime ||
            existingStaff.role !== (data.jobRole?.[0] || data.role);
          
          if (hasChanged || !existingStaff) {
            // 변경된 경우에만 새 객체 생성
            const staffDataItem: StaffData = {
              id: docId,
              userId: data.userId,
              name: data.name,
              email: data.email,
              phone: data.phone,
              role: (data.jobRole && Array.isArray(data.jobRole) ? data.jobRole[0] : data.role) as JobRole,
              userRole: data.userRole,
              gender: data.gender,
              age: data.age,
              experience: data.experience,
              nationality: data.nationality,
              history: data.history,
              notes: data.notes,
              postingId: data.postingId,
              postingTitle: data.postingTitle || '제목 없음',
              assignedEvents: data.assignedEvents,
              assignedRole: data.assignedRole,
              assignedTime: data.assignedTime,
              assignedDate: assignedDateString
            };
            
            staffList.push(staffDataItem);
          } else {
            // 변경되지 않은 경우 기존 객체 재사용
            staffList.push(existingStaff);
          }
        });
        
        setStaffData(staffList);
        setLoading(false);
      },
      (error) => {
        logger.error('스태프 데이터 실시간 구독 오류', error instanceof Error ? error : new Error(String(error)), { component: 'useStaffManagement' });
        setError(t('staffListPage.fetchError'));
        setLoading(false);
      }
    );

    // 클린업 함수
    return () => {
      unsubscribe();
    };
  }, [currentUser, eventId]); // groupByDate는 데이터 구독에 영향을 주지 않으므로 제외

  // workLogs 데이터 처리 (이제 context에서 가져옴)
  useEffect(() => {
    if (workLogs) {
      setWorkLogsData(workLogs);
      
      // workLogs를 맵 형태로도 저장 (빠른 조회를 위해)
      const workLogsMapData: Record<string, UnifiedWorkLog> = {};
      workLogs.forEach(workLog => {
        // 통합 시스템에서는 staffId를 사용
        const staffId = workLog.staffId;
        const date = workLog.date;
        if (staffId && date) {
          const key = `${staffId}_${date}`;
          workLogsMapData[key] = workLog;
        }
      });
      setWorkLogsMap(workLogsMapData);
      
      // workLogs 변경 시 staffData 강제 리렌더링
      // React가 변경을 감지하도록 새 배열 생성
      setStaffData(prevData => {
        // 데이터가 동일해도 새 배열 참조를 생성하여 리렌더링 유도
        return [...prevData];
      });
      
      logger.info('workLogs 업데이트 감지 - staffData 리렌더링 트리거', { 
        component: 'useStaffManagement',
        data: { workLogsCount: workLogs.length }
      });
    }
  }, [workLogs]);

  // localStorage에서 확장 상태 복원
  useEffect(() => {
    if (eventId) {
      const savedExpanded = localStorage.getItem(`staffManagement-${eventId}-expandedDates`);
      if (savedExpanded) {
        try {
          const expandedArray = JSON.parse(savedExpanded);
          setExpandedDates(new Set(expandedArray));
        } catch (error) {
          logger.warn('확장 상태 복원 오류', { component: 'useStaffManagement', error: String(error) });
        }
      }
    }
  }, [eventId]);

  // 메모이제이션된 날짜별 그룹화 토글
  const toggleDateExpansion = useCallback((date: string) => {
    const newExpandedDates = new Set(expandedDates);
    if (newExpandedDates.has(date)) {
      newExpandedDates.delete(date);
    } else {
      newExpandedDates.add(date);
    }
    setExpandedDates(newExpandedDates);
    
    // localStorage에 상태 저장
    if (eventId) {
      localStorage.setItem(`staffManagement-${eventId}-expandedDates`, JSON.stringify(Array.from(newExpandedDates)));
    }
  }, [expandedDates, eventId]);
  
  // 메모이제이션된 시간 정보 포맷팅
  const formatTimeDisplay = useCallback((time: string | undefined): string => {
    if (!time) return '시간 미정';
    if (time === '미정') return '미정';
    return time;
  }, []);
  
  // 메모이제이션된 시간대별 색상 반환
  const getTimeSlotColor = useCallback((time: string | undefined): string => {
    if (!time) return 'bg-gray-100 text-gray-500';
    if (time === '미정') return 'bg-orange-100 text-orange-800';
    
    const hour = parseInt(time.split(':')[0] || '0');
    if (hour >= 6 && hour < 12) return 'bg-yellow-100 text-yellow-800'; // 오전
    if (hour >= 12 && hour < 18) return 'bg-blue-100 text-blue-800'; // 오후
    if (hour >= 18 && hour < 24) return 'bg-purple-100 text-purple-800'; // 저녁
    return 'bg-gray-100 text-gray-700'; // 심야/새벽
  }, []);

  // 메모이제이션된 스태프 삭제 - persons 컬렉션 사용
  const deleteStaff = useCallback(async (staffId: string): Promise<void> => {
    if (!window.confirm(t('staffManagement.deleteConfirm'))) {
      return;
    }
    
    try {
      // Firebase에서 삭제 - persons 컬렉션 사용
      const personDocRef = doc(db, 'persons', staffId);
      await deleteDoc(personDocRef);
      
      // 로컬 상태에서 삭제
      setStaffData(prevData => prevData.filter(staff => staff.id !== staffId));
      
      showSuccess(t('staffManagement.deleteSuccess'));
      setError('');
    } catch (error) {
      logger.error('스태프 삭제 오류', error instanceof Error ? error : new Error(String(error)), { component: 'useStaffManagement' });
      setError(t('staffManagement.deleteError'));
      showError(t('staffManagement.deleteError'));
    }
  }, [t, showSuccess, showError]);

  // 메모이제이션된 필터링된 스태프 데이터
  const filteredStaffData = useMemo(() => {
    if (!enableFiltering) {
      return staffData;
    }

    let filtered = [...staffData];

    // 검색 필터 적용
    if (filters.searchTerm) {
      const searchTerm = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(staff =>
        staff.name?.toLowerCase().includes(searchTerm) ||
        staff.email?.toLowerCase().includes(searchTerm) ||
        staff.phone?.toLowerCase().includes(searchTerm) ||
        staff.role?.toLowerCase().includes(searchTerm) ||
        staff.assignedRole?.toLowerCase().includes(searchTerm) ||
        staff.assignedTime?.toLowerCase().includes(searchTerm) ||
        staff.assignedDate?.toLowerCase().includes(searchTerm)
      );
    }

    // 날짜별 필터 적용
    if (filters.selectedDate !== 'all') {
      filtered = filtered.filter(staff => staff.assignedDate === filters.selectedDate);
    }

    // 역할별 필터 적용
    if (filters.selectedRole !== 'all') {
      filtered = filtered.filter(staff => 
        (staff.assignedRole || staff.role) === filters.selectedRole
      );
    }

    return filtered;
  }, [staffData, filters, enableFiltering]);

  // 메모이제이션된 날짜별 그룹화된 스태프 데이터
  const groupedStaffData = useMemo((): GroupedStaffData => {
    if (!enableFiltering) {
      return {
        grouped: { 'all': filteredStaffData },
        sortedDates: ['all']
      };
    }

    // 날짜별 그룹화
    const grouped = filteredStaffData.reduce((acc, staff) => {
      let date: string;
      
      if (!staff.assignedDate) {
        date = '날짜 미정';
      } else {
        try {
          // Timestamp 문자열을 포맷된 날짜로 변환
          date = formatDate(staff.assignedDate);
        } catch (error) {
          logger.error('useStaffManagement 날짜 포맷 오류', error instanceof Error ? error : new Error(String(error)), { component: 'useStaffManagement', data: { assignedDate: staff.assignedDate } });
          date = '날짜 오류';
        }
      }
      
      if (!acc[date]) {
        acc[date] = [];
      }
      const staffArray = acc[date];
      if (staffArray) {
        staffArray.push(staff);
      }
      return acc;
    }, {} as Record<string, StaffData[]>);

    // 각 그룹 내에서 정렬 (날짜 → 시간 → 이름 순)
    Object.keys(grouped).forEach(date => {
      const staffGroup = grouped[date];
      if (staffGroup) {
        staffGroup.sort((a, b) => {
        // 시간순 정렬
        const timeA = a.assignedTime || 'zzz';
        const timeB = b.assignedTime || 'zzz';
        if (timeA !== timeB) {
          if (timeA === '미정') return 1;
          if (timeB === '미정') return -1;
          return timeA.localeCompare(timeB);
        }
        
        // 이름순 정렬
        const nameA = a.name || 'zzz';
        const nameB = b.name || 'zzz';
        return nameA.localeCompare(nameB);
      });
      }
    });

    // 날짜순으로 정렬된 키 반환
    const sortedDates = Object.keys(grouped).sort((a, b) => {
      // 특수한 날짜들을 뒤로 보내기
      if (a === '날짜 미정') return 1;
      if (b === '날짜 미정') return -1;
      if (a === '날짜 오류') return 1;
      if (b === '날짜 오류') return -1;
      
      // 한국어 날짜 형식을 파싱하여 실제 날짜로 정렬
      const parseKoreanDate = (dateStr: string): Date | null => {
        // "9월 10일 (수)" 형식을 파싱
        const match = dateStr.match(/(\d{1,2})월\s*(\d{1,2})일/);
        if (match && match[1] && match[2]) {
          const month = parseInt(match[1], 10);
          const day = parseInt(match[2], 10);
          // 년도는 현재 년도로 가정
          const year = new Date().getFullYear();
          return new Date(year, month - 1, day); // month는 0-based
        }
        return null;
      };
      
      const dateA = parseKoreanDate(a);
      const dateB = parseKoreanDate(b);
      
      // 날짜 파싱에 실패한 경우 문자열 비교로 폴백
      if (!dateA && !dateB) return a.localeCompare(b);
      if (!dateA) return 1;
      if (!dateB) return -1;
      
      // 날짜 객체로 비교 (시간순으로 정렬)
      return dateA.getTime() - dateB.getTime();
    });

    return { grouped, sortedDates };
  }, [filteredStaffData, enableFiltering]);

  // 고유 날짜 목록 생성
  const availableDates = useMemo(() => {
    const dates = new Set(staffData.map(staff => {
      if (!staff.assignedDate) {
        return '날짜 미정';
      }
      try {
        return formatDate(staff.assignedDate);
      } catch (error) {
        logger.error('availableDates 날짜 포맷 오류', error instanceof Error ? error : new Error(String(error)), { component: 'useStaffManagement', data: { assignedDate: staff.assignedDate } });
        return '날짜 오류';
      }
    }));
    return Array.from(dates).sort((a, b) => {
      if (a === '날짜 미정') return 1;
      if (b === '날짜 미정') return -1;
      if (a === '날짜 오류') return 1;
      if (b === '날짜 오류') return -1;
      return a.localeCompare(b);
    });
  }, [staffData]);

  // 고유 역할 목록 생성
  const availableRoles = useMemo(() => {
    const roles = new Set(
      staffData
        .map(staff => staff.assignedRole || staff.role)
        .filter((role): role is string => Boolean(role))
    );
    return Array.from(roles).sort();
  }, [staffData]);

  // 메모이제이션된 날짜별 스태프 수 계산
  const getStaffCountByDate = useCallback((date: string): number => {
    return groupedStaffData.grouped[date]?.length || 0;
  }, [groupedStaffData]);
  
  // 특정 스태프의 workLog 가져오기
  const getStaffWorkLog = useCallback((staffId: string, date: string) => {
    const key = `${staffId}_${date}`;
    return workLogsMap[key] || null;
  }, [workLogsMap]);

  return {
    // 데이터
    staffData,
    groupedStaffData,
    availableDates,
    availableRoles,
    workLogsData,
    
    // 상태
    loading: loading || workLogsLoading,
    error,
    
    // 필터 상태
    filters,
    setFilters,
    
    // 그룹화 상태
    expandedDates,
    groupByDate,
    setGroupByDate,
    
    // 액션
    deleteStaff,
    refreshStaffData,
    toggleDateExpansion,
    
    // 유틸리티
    formatTimeDisplay,
    getTimeSlotColor,
    getStaffCountByDate,
    getStaffWorkLog
  };
};

export type { StaffData, StaffFilters, GroupedStaffData, UseStaffManagementReturn };