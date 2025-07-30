import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, getDocs, doc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../contexts/AuthContext';
import { useJobPostingContext } from '../contexts/JobPostingContext';
import { useToast } from '../contexts/ToastContext';
import { db } from '../firebase';
import { formatDate } from '../utils/jobPosting/dateUtils';

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
  history?: string;
  notes?: string;
  postingId: string;
  postingTitle: string;
  assignedEvents?: string[]; // 스태프가 등록된 모든 공고 ID 배열
  assignedRole?: string;     // 지원자에서 확정된 역할
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
  jobPostingId?: string;
  enableGrouping?: boolean;
  enableFiltering?: boolean;
}

interface UseStaffManagementReturn {
  // 데이터
  staffData: StaffData[];
  groupedStaffData: GroupedStaffData;
  availableDates: string[];
  availableRoles: string[];
  workLogsData: any[];
  
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
  getStaffWorkLog: (staffId: string, date: string) => any | null;
}

export const useStaffManagement = (
  options: UseStaffManagementOptions = {}
): UseStaffManagementReturn => {
  const { 
    jobPostingId, 
    enableGrouping = true, 
    enableFiltering = true 
  } = options;
  
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const { staff } = useJobPostingContext();
  
  // 기본 상태
  const [staffData, setStaffData] = useState<StaffData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // workLogs 상태 추가
  const [workLogsData, setWorkLogsData] = useState<any[]>([]);
  const [workLogsMap, setWorkLogsMap] = useState<Record<string, any>>({});
  
  // 필터 상태
  const [filters, setFilters] = useState<StaffFilters>({
    searchTerm: '',
    selectedDate: 'all',
    selectedRole: 'all',
    selectedStatus: 'all'
  });
  
  // 그룹화 상태
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [groupByDate, setGroupByDate] = useState(enableGrouping);
  
  // 수동 새로고침 함수 (필요시에만 사용)
  const refreshStaffData = useCallback(async () => {
    console.log('🔄 수동 스태프 데이터 새로고침 요청 (실시간 구독으로 인해 필요 없음)');
    // 실시간 구독이 활성화되어 있으므로 별도 액션 불필요
    // 만약 필요하다면 여기서 강제 새로고침 로직 추가 가능
  }, []);
  
  // 스태프 데이터 실시간 구독
  useEffect(() => {
    if (!currentUser || !jobPostingId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    console.log('🔍 useStaffManagement - 실시간 구독 시작');

    // 실시간 구독 설정
    const staffQuery = query(
      collection(db, 'staff'), 
      where('managerId', '==', currentUser.uid),
      where('postingId', '==', jobPostingId)
    );

    const unsubscribe = onSnapshot(
      staffQuery,
      (snapshot) => {
        console.log('🔍 스태프 데이터 실시간 업데이트, 문서 수:', snapshot.size);
        
        const staffList: StaffData[] = snapshot.docs.map(doc => {
          const data = doc.data();
          
          // assignedDate를 문자열로 변환
          let assignedDateString = data.assignedDate;
          if (data.assignedDate) {
            // Firebase Timestamp 객체인 경우
            if (typeof data.assignedDate === 'object' && 'seconds' in data.assignedDate) {
              const date = new Date(data.assignedDate.seconds * 1000);
              assignedDateString = date.toISOString().split('T')[0];
            }
            // Timestamp 문자열인 경우 (예: 'Timestamp(seconds=1753833600, nanoseconds=0)')
            else if (typeof data.assignedDate === 'string' && data.assignedDate.startsWith('Timestamp(')) {
              const match = data.assignedDate.match(/seconds=(\d+)/);
              if (match) {
                const seconds = parseInt(match[1], 10);
                const date = new Date(seconds * 1000);
                assignedDateString = date.toISOString().split('T')[0];
              }
            }
            // 이미 날짜 문자열인 경우 그대로 사용
            else if (typeof data.assignedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.assignedDate)) {
              assignedDateString = data.assignedDate;
            }
          }
          
          const staffData = {
            id: doc.id,
            ...data,
            assignedDate: assignedDateString, // 변환된 날짜 문자열 사용
            // jobRole 배열을 role 필드로 매핑 (promoteToStaff에서 저장한 데이터 호환성)
            role: data.jobRole && Array.isArray(data.jobRole) ? data.jobRole[0] as JobRole : data.role,
            postingTitle: data.postingTitle || '제목 없음' // 기본값 설정
          } as StaffData;
          
          console.log('🔍 스태프 데이터 실시간 업데이트:', {
            docId: doc.id,
            originalAssignedDate: data.assignedDate,
            convertedAssignedDate: staffData.assignedDate,
            assignedTime: data.assignedTime,
            assignedRole: data.assignedRole
          });
          
          return staffData;
        });
        
        setStaffData(staffList);
        setLoading(false);
        console.log('✅ 스태프 데이터 실시간 업데이트 완료');
      },
      (error) => {
        console.error('❌ 스태프 데이터 실시간 구독 오류:', error);
        setError(t('staffListPage.fetchError'));
        setLoading(false);
      }
    );

    // 클린업 함수
    return () => {
      console.log('🧹 스태프 데이터 실시간 구독 해제');
      unsubscribe();
    };
  }, [currentUser, jobPostingId, t]);

  // workLogs 데이터 실시간 구독 추가
  useEffect(() => {
    if (!currentUser || !jobPostingId) {
      return;
    }

    console.log('🔍 useStaffManagement - workLogs 실시간 구독 시작');

    // workLogs 실시간 구독 설정
    const workLogsQuery = query(
      collection(db, 'workLogs'), 
      where('eventId', '==', jobPostingId)
    );

    const unsubscribe = onSnapshot(
      workLogsQuery,
      (snapshot) => {
        console.log('📋 workLogs 데이터 실시간 업데이트, 문서 수:', snapshot.size);
        
        const workLogsList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setWorkLogsData(workLogsList);
        
        // workLogs를 맵 형태로도 저장 (빠른 조회를 위해)
        const workLogsMapData: Record<string, any> = {};
        workLogsList.forEach(workLog => {
          const dealerId = (workLog as any).dealerId || (workLog as any).staffId;
          const date = (workLog as any).date;
          if (dealerId && date) {
            const key = `${dealerId}_${date}`;
            workLogsMapData[key] = workLog;
          }
        });
        setWorkLogsMap(workLogsMapData);
        
        // workLogs 변경 시 staffData 강제 리렌더링
        setStaffData(prev => [...prev]);
        
        console.log('✅ workLogs 데이터 실시간 업데이트 완료:', {
          count: workLogsList.length,
          mapKeys: Object.keys(workLogsMapData).length
        });
      },
      (error) => {
        console.error('❌ workLogs 데이터 실시간 구독 오류:', error);
      }
    );

    // 클린업 함수
    return () => {
      console.log('🧹 workLogs 데이터 실시간 구독 해제');
      unsubscribe();
    };
  }, [currentUser, jobPostingId]);

  // localStorage에서 확장 상태 복원
  useEffect(() => {
    if (jobPostingId) {
      const savedExpanded = localStorage.getItem(`staffManagement-${jobPostingId}-expandedDates`);
      if (savedExpanded) {
        try {
          const expandedArray = JSON.parse(savedExpanded);
          setExpandedDates(new Set(expandedArray));
        } catch (error) {
          console.error('확장 상태 복원 오류:', error);
        }
      }
    }
  }, [jobPostingId]);

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
    if (jobPostingId) {
      localStorage.setItem(`staffManagement-${jobPostingId}-expandedDates`, JSON.stringify(Array.from(newExpandedDates)));
    }
  }, [expandedDates, jobPostingId]);
  
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

  // 메모이제이션된 스태프 삭제
  const deleteStaff = useCallback(async (staffId: string): Promise<void> => {
    if (!window.confirm(t('staffManagement.deleteConfirm'))) {
      return;
    }
    
    try {
      // Firebase에서 삭제
      const staffDocRef = doc(db, 'staff', staffId);
      await deleteDoc(staffDocRef);
      
      // 로컬 상태에서 삭제
      setStaffData(prevData => prevData.filter(staff => staff.id !== staffId));
      
      showSuccess(t('staffManagement.deleteSuccess'));
      setError('');
    } catch (error: any) {
      console.error('스태프 삭제 오류:', error);
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
          console.error('❌ useStaffManagement 날짜 포맷 오류:', error, staff.assignedDate);
          date = '날짜 오류';
        }
      }
      
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(staff);
      return acc;
    }, {} as Record<string, StaffData[]>);

    // 각 그룹 내에서 정렬 (날짜 → 시간 → 이름 순)
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => {
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
    });

    // 날짜순으로 정렬된 키 반환
    const sortedDates = Object.keys(grouped).sort((a, b) => {
      if (a === '날짜 미정') return 1;
      if (b === '날짜 미정') return -1;
      return a.localeCompare(b);
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
        console.error('❌ availableDates 날짜 포맷 오류:', error, staff.assignedDate);
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
    const roles = new Set(staffData.map(staff => staff.assignedRole || staff.role).filter(Boolean));
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
    loading,
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