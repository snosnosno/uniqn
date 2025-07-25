import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
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
  
  // 스태프 데이터 로드
  const loadStaffData = async (postingId: string) => {
    if (!currentUser || !postingId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 useStaffManagement - 현재 사용자 ID:', currentUser.uid);
      console.log('🔍 useStaffManagement - 공고 ID:', postingId);
      
      // 해당 공고에 할당된 스태프만 가져오기
      const staffQuery = query(
        collection(db, 'staff'), 
        where('managerId', '==', currentUser.uid),
        where('postingId', '==', postingId)
      );
      const staffSnapshot = await getDocs(staffQuery);
      console.log('🔍 공고별 Staff 문서 수:', staffSnapshot.size);
  
      if (staffSnapshot.empty) {
        console.log('⚠️ 해당 공고의 스태프가 없습니다.');
        setStaffData([]);
        setLoading(false);
        return;
      }

      const staffList: StaffData[] = staffSnapshot.docs.map(doc => {
        const data = doc.data();
        const staffData = {
          id: doc.id,
          ...data,
          // jobRole 배열을 role 필드로 매핑 (promoteToStaff에서 저장한 데이터 호환성)
          role: data.jobRole && Array.isArray(data.jobRole) ? data.jobRole[0] as JobRole : data.role,
          postingTitle: data.postingTitle || '제목 없음' // 기본값 설정
        } as StaffData;
        
        console.log('🔍 스태프 데이터 로드:', {
          docId: doc.id,
          assignedDate: data.assignedDate,
          assignedTime: data.assignedTime,
          assignedRole: data.assignedRole,
          rawData: data
        });
        
        return staffData;
      });
      
      console.log('🔍 공고별 스태프 데이터:', staffList);
      setStaffData(staffList);

    } catch (e) {
      console.error("Error fetching staff data: ", e);
      setError(t('staffListPage.fetchError'));
    } finally {
      setLoading(false);
    }
  };

  // 스태프 데이터 새로고침
  const refreshStaffData = async () => {
    if (jobPostingId) {
      await loadStaffData(jobPostingId);
    }
  };
  
  // 스태프 데이터 로드 및 실시간 동기화
  useEffect(() => {
    if (jobPostingId) {
      loadStaffData(jobPostingId);
    }
  }, [currentUser, jobPostingId, staff]); // staff 추가로 실시간 동기화

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

  // 날짜별 그룹화 토글
  const toggleDateExpansion = (date: string) => {
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
  };
  
  // 시간 정보 포맷팅
  const formatTimeDisplay = (time: string | undefined): string => {
    if (!time) return '시간 미정';
    if (time === '추후공지') return '추후공지';
    return time;
  };
  
  // 시간대별 색상 반환
  const getTimeSlotColor = (time: string | undefined): string => {
    if (!time || time === '추후공지') return 'bg-gray-100 text-gray-700';
    
    const hour = parseInt(time.split(':')[0] || '0');
    if (hour >= 6 && hour < 12) return 'bg-yellow-100 text-yellow-800'; // 오전
    if (hour >= 12 && hour < 18) return 'bg-blue-100 text-blue-800'; // 오후
    if (hour >= 18 && hour < 24) return 'bg-purple-100 text-purple-800'; // 저녁
    return 'bg-gray-100 text-gray-700'; // 심야/새벽
  };

  // 스태프 삭제
  const deleteStaff = async (staffId: string): Promise<void> => {
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
  };

  // 날짜별 그룹화된 스태프 데이터
  const groupedStaffData = useMemo((): GroupedStaffData => {
    let filteredStaff = [...staffData];

    if (!enableFiltering) {
      return {
        grouped: { 'all': filteredStaff },
        sortedDates: ['all']
      };
    }

    // 검색 필터 적용
    if (filters.searchTerm) {
      filteredStaff = filteredStaff.filter(staff =>
        staff.name?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        staff.email?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        staff.phone?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        staff.role?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        staff.assignedRole?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        staff.assignedTime?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        staff.assignedDate?.toLowerCase().includes(filters.searchTerm.toLowerCase())
      );
    }

    // 날짜별 필터 적용
    if (filters.selectedDate !== 'all') {
      filteredStaff = filteredStaff.filter(staff => staff.assignedDate === filters.selectedDate);
    }

    // 역할별 필터 적용
    if (filters.selectedRole !== 'all') {
      filteredStaff = filteredStaff.filter(staff => 
        (staff.assignedRole || staff.role) === filters.selectedRole
      );
    }

    // 날짜별 그룹화
    const grouped = filteredStaff.reduce((acc, staff) => {
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
          if (timeA === '추후공지') return 1;
          if (timeB === '추후공지') return -1;
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
  }, [staffData, filters, enableFiltering]);

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

  // 날짜별 스태프 수 계산
  const getStaffCountByDate = (date: string): number => {
    return groupedStaffData.grouped[date]?.length || 0;
  };

  return {
    // 데이터
    staffData,
    groupedStaffData,
    availableDates,
    availableRoles,
    
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
    getStaffCountByDate
  };
};

export type { StaffData, StaffFilters, GroupedStaffData, UseStaffManagementReturn };