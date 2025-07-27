import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FaTimes } from 'react-icons/fa';

import { useAuth } from '../../contexts/AuthContext';
import { useJobPostingContext } from '../../contexts/JobPostingContext';
import { useToast } from '../../contexts/ToastContext';
import { db } from '../../firebase';
import { useAttendanceStatus } from '../../hooks/useAttendanceStatus';
import { getExceptionIcon, getExceptionSeverity } from '../../utils/attendanceExceptionUtils';
import { AttendanceExceptionHandler } from '../AttendanceExceptionHandler';
import AttendanceStatusCard from '../AttendanceStatusCard';
import QRCodeGeneratorModal from '../QRCodeGeneratorModal';
import WorkTimeEditor from '../WorkTimeEditor';



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

interface StaffManagementTabProps {
  jobPosting?: any;
}


const StaffManagementTab: React.FC<StaffManagementTabProps> = ({ jobPosting }) => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
    const { showSuccess, showError } = useToast();
  const { staff } = useJobPostingContext();
  
  const [staffData, setStaffData] = useState<StaffData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 출석 상태 관리
  const { 
    attendanceRecords, 
    // loading: attendanceLoading, 
    // error: attendanceError,
    getStaffAttendanceStatus 
  } = useAttendanceStatus({
    eventId: jobPosting?.id || 'default-event',
    date: new Date().toISOString().split('T')[0] || ''
  });
  

  // States for filtering and searching
  const [searchTerm, setSearchTerm] = useState('');
  
  // 편집 기능 관련 states
  // const [editingCell, setEditingCell] = useState<{ rowId: string; field: keyof StaffData } | null>(null);
  // const [editingValue, setEditingValue] = useState<string>('');
  
  // QR 코드 생성 모달 관련 states
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  
  // 시간 수정 모달 관련 states
  const [isWorkTimeEditorOpen, setIsWorkTimeEditorOpen] = useState(false);
  const [selectedWorkLog, setSelectedWorkLog] = useState<any | null>(null);
  
  // 예외 상황 처리 모달 관련 states
  // const [isExceptionModalOpen, setIsExceptionModalOpen] = useState(false);
  const [selectedExceptionWorkLog, setSelectedExceptionWorkLog] = useState<any | null>(null);
  
  // 날짜별 그룹화 관련 states
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [groupByDate, setGroupByDate] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('all');

  // 스태프 데이터 로드 및 실시간 동기화
  useEffect(() => {
    if (!currentUser || !jobPosting?.id) {
      setLoading(false);
      return;
    }

    const fetchJobPostingStaff = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log('🔍 StaffManagementTab - 현재 사용자 ID:', currentUser.uid);
        console.log('🔍 StaffManagementTab - 공고 ID:', jobPosting.id);
        
        // 해당 공고에 할당된 스태프만 가져오기
        const staffQuery = query(
          collection(db, 'staff'), 
          where('managerId', '==', currentUser.uid),
          where('postingId', '==', jobPosting.id)
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
          return {
            id: doc.id,
            ...data,
            // jobRole 배열을 role 필드로 매핑 (promoteToStaff에서 저장한 데이터 호환성)
            role: data.jobRole && Array.isArray(data.jobRole) ? data.jobRole[0] as JobRole : data.role,
            postingTitle: jobPosting.title // 현재 공고 제목 설정
          } as StaffData;
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

    fetchJobPostingStaff();
    }, [currentUser, jobPosting?.id, t, staff]); // staff 추가로 실시간 동기화

  // 편집 기능 핸들러 (미사용)
  // const handleCellClick = (rowId: string, field: keyof StaffData, currentValue: any) => {
  //   // 편집 불가능한 필드 제외
  //   const readOnlyFields: (keyof StaffData)[] = ['id', 'userId', 'postingId', 'postingTitle'];
  //   if (readOnlyFields.includes(field)) return;

  //   // 편집 모드 활성화
  //   setEditingCell({ rowId, field, value: currentValue });
  // };
  
  // const handleCellSave = async () => {
  //   if (!editingCell) return;

  //   const { rowId, field } = editingCell;
  //   const newValue = editingValue;

  //   try {
  //     // 스태프 데이터 업데이트
  //     const updatedStaffData = staffData.map(staff => {
  //       if (staff.id === rowId) {
  //         return { ...staff, [field]: newValue };
  //       }
  //       return staff;
  //     });

  //     setStaffData(updatedStaffData);
  //     setEditingCell(null);
  //     setEditingValue('');

  //     showSuccess(t('staffManagement.cellUpdateSuccess'));
  //   } catch (error) {
  //     console.error('셀 저장 오류:', error);
  //     showError(t('staffManagement.cellUpdateError'));
  //   }
  // };
  
  // const handleCellCancel = () => {
  //   // setEditingCell(null); // This line is removed
  //   // setEditingValue(''); // This line is removed
  // };
  
  // 출퇴근 시간 수정 핸들러
  const handleEditWorkTime = (staffId: string) => {
    const workLog = attendanceRecords.find(record => 
      record.workLog?.eventId === (jobPosting?.id || 'default-event') && 
      record.staffId === staffId &&
      record.workLog?.date === new Date().toISOString().split('T')[0]
    );
    
    if (workLog) {
      setSelectedWorkLog(workLog);
      setIsWorkTimeEditorOpen(true);
    } else {
      console.log('오늘 날짜에 대한 근무 기록을 찾을 수 없습니다.');
    }
  };
  
  const handleWorkTimeUpdate = (updatedWorkLog: any) => {
    console.log('근무 시간이 업데이트되었습니다:', updatedWorkLog);
        showSuccess(t('staffManagement.workTimeUpdateSuccess'));
  };
  
  // 예외 상황 처리 함수
  const handleExceptionEdit = (staffId: string) => {
    const workLog = attendanceRecords.find(record => 
      record.workLog?.eventId === (jobPosting?.id || 'default-event') && 
      record.staffId === staffId &&
      record.workLog?.date === new Date().toISOString().split('T')[0]
    );
    
    if (workLog?.workLog) {
      setSelectedExceptionWorkLog(workLog.workLog);
      // setIsExceptionModalOpen(true); // This line is removed
    }
  };
  
  const handleExceptionUpdate = (updatedWorkLog: any) => {
    console.log('예외 상황이 업데이트되었습니다:', updatedWorkLog);
    // setIsExceptionModalOpen(false); // This line is removed
    setSelectedExceptionWorkLog(null);
        showSuccess(t('staffManagement.exceptionUpdateSuccess'));
  };
  
  // 날짜별 그룹화 처리 함수들
  const toggleDateExpansion = (date: string) => {
    const newExpandedDates = new Set(expandedDates);
    if (newExpandedDates.has(date)) {
      newExpandedDates.delete(date);
    } else {
      newExpandedDates.add(date);
    }
    setExpandedDates(newExpandedDates);
    
    // localStorage에 상태 저장
    localStorage.setItem(`staffManagement-${jobPosting?.id}-expandedDates`, JSON.stringify(Array.from(newExpandedDates)));
  };
  
  // localStorage에서 확장 상태 복원
  useEffect(() => {
    if (jobPosting?.id) {
      const savedExpanded = localStorage.getItem(`staffManagement-${jobPosting.id}-expandedDates`);
      if (savedExpanded) {
        try {
          const expandedArray = JSON.parse(savedExpanded);
          setExpandedDates(new Set(expandedArray));
        } catch (error) {
          console.error('확장 상태 복원 오류:', error);
        }
      }
    }
  }, [jobPosting?.id]);
  
  // 시간 정보 포맷팅 함수
  const formatTimeDisplay = (time: string | undefined) => {
    if (!time) return '시간 미정';
    if (time === '추후공지') return '추후공지';
    return time;
  };
  
  // 시간대별 색상 반환 함수
  const getTimeSlotColor = (time: string | undefined) => {
    if (!time || time === '추후공지') return 'bg-gray-100 text-gray-700';
    
    const hour = parseInt(time.split(':')[0] || '0');
    if (hour >= 6 && hour < 12) return 'bg-yellow-100 text-yellow-800'; // 오전
    if (hour >= 12 && hour < 18) return 'bg-blue-100 text-blue-800'; // 오후
    if (hour >= 18 && hour < 24) return 'bg-purple-100 text-purple-800'; // 저녁
    return 'bg-gray-100 text-gray-700'; // 심야/새벽
  };
  
  // 스태프 삭제 기능
  const deleteStaff = async (staffId: string) => {
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
  const groupedStaffData = useMemo(() => {
    let filteredStaff = [...staffData];

    // 검색 필터 적용
    if (searchTerm) {
      filteredStaff = filteredStaff.filter(staff =>
        staff.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.assignedRole?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.assignedTime?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.assignedDate?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 날짜별 필터 적용
    if (selectedDate !== 'all') {
      filteredStaff = filteredStaff.filter(staff => staff.assignedDate === selectedDate);
    }

    // 날짜별 그룹화
    const grouped = filteredStaff.reduce((acc, staff) => {
      const date = staff.assignedDate || '날짜 미정';
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
  }, [staffData, searchTerm, selectedDate]);

  // 고유 날짜 목록 생성
  const availableDates = useMemo(() => {
    const dates = new Set(staffData.map(staff => staff.assignedDate || '날짜 미정'));
    return Array.from(dates).sort((a, b) => {
      if (a === '날짜 미정') return 1;
      if (b === '날짜 미정') return -1;
      return a.localeCompare(b);
    });
  }, [staffData]);

  // Early return if no job posting data
  if (!jobPosting) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center min-h-96">
          <div className="text-lg text-gray-500">공고 정보를 불러올 수 없습니다.</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center min-h-96">
          <div className="text-lg">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium">{jobPosting.title} - 스태프 관리</h3>
          <div className="text-sm text-gray-600">
            총 {staffData.length}명의 스태프가 등록되어 있습니다.
          </div>
        </div>

        {error ? <div className="bg-red-50 p-4 rounded-lg mb-4">
            <p className="text-red-600">{error}</p>
          </div> : null}

        {/* 검색 및 제어 버튼 */}
        <div className="mb-4 flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
          <input
            type="text"
            placeholder="스태프 이름, 역할, 연락처로 검색..."
            className="w-full md:w-1/3 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="w-full md:w-1/4 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          >
            <option value="all">모든 날짜</option>
            {availableDates.map(date => (
              <option key={date} value={date}>
                {date === '날짜 미정' ? '날짜 미정' : date}
              </option>
            ))}
          </select>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="groupByDate"
              checked={groupByDate}
              onChange={(e) => setGroupByDate(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="groupByDate" className="text-sm text-gray-700">날짜별 그룹화</label>
          </div>
          <button
            onClick={() => setIsQrModalOpen(true)}
            className="w-full md:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 whitespace-nowrap transition-colors"
          >
            {t('attendance.actions.generateQR')}
          </button>
        </div>

        {staffData.length === 0 ? (
          <div className="bg-gray-50 p-6 rounded-lg text-center">
            <p className="text-gray-600 mb-4">이 공고에 할당된 스태프가 없습니다.</p>
            <p className="text-sm text-gray-500">
              지원자 목록에서 지원자를 확정하면 자동으로 스태프로 등록됩니다.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupByDate ? (
              // 날짜별 그룹화 보기
              groupedStaffData.sortedDates.map((date) => {
                const staffForDate = groupedStaffData.grouped[date];
                const isExpanded = expandedDates.has(date);
                const staffCount = staffForDate.length;
                
                return (
                  <div key={date} className="bg-white rounded-lg shadow-md overflow-hidden">
                    {/* 날짜 헤더 */}
                    <div 
                      className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200 cursor-pointer hover:from-blue-100 hover:to-indigo-100 transition-colors"
                      onClick={() => toggleDateExpansion(date)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="text-lg font-semibold text-gray-900">
                            {date === '날짜 미정' ? (
                              <span className="text-gray-500">📅 날짜 미정</span>
                            ) : (
                              <span>📅 {date}</span>
                            )}
                          </div>
                          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                            {staffCount}명
                          </div>
                        </div>
                        <div className="text-gray-400">
                          {isExpanded ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* 스태프 리스트 */}
                    {isExpanded && (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                시간
                              </th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                이름
                              </th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                역할
                              </th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                연락처
                              </th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                출석
                              </th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                예외
                              </th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                작업
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {staffForDate.map((staff) => (
                              <tr key={staff.id} className="hover:bg-gray-50 transition-colors">
                                {/* 시간 열 */}
                                <td className="px-4 py-4 whitespace-nowrap">
                                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getTimeSlotColor(staff.assignedTime)}`}>
                                    ⏰ {formatTimeDisplay(staff.assignedTime)}
                                  </div>
                                </td>
                                
                                {/* 이름 열 */}
                                <td className="px-4 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <div className="flex-shrink-0 h-8 w-8">
                                      <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center text-sm font-medium text-gray-700">
                                        {(staff.name || 'U').charAt(0).toUpperCase()}
                                      </div>
                                    </div>
                                    <div className="ml-3">
                                      <div className="text-sm font-medium text-gray-900">
                                        {staff.name || '이름 미정'}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                
                                {/* 역할 열 */}
                                <td className="px-4 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">
                                    {staff.assignedRole || staff.role || '-'}
                                  </div>
                                </td>
                                
                                {/* 연락처 열 (전화번호 + 이메일 통합) */}
                                <td className="px-4 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900 space-y-1">
                                    {staff.phone && (
                                      <div className="flex items-center">
                                        <svg className="w-3 h-3 mr-1 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                          <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                                        </svg>
                                        <a href={`tel:${staff.phone}`} className="text-blue-600 hover:text-blue-800">
                                          {staff.phone}
                                        </a>
                                      </div>
                                    )}
                                    {staff.email && (
                                      <div className="flex items-center">
                                        <svg className="w-3 h-3 mr-1 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                          <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                          <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                                        </svg>
                                        <a href={`mailto:${staff.email}`} className="text-blue-600 hover:text-blue-800">
                                          {staff.email.length > 20 ? `${staff.email.substring(0, 20)}...` : staff.email}
                                        </a>
                                      </div>
                                    )}
                                    {!staff.phone && !staff.email && (
                                      <span className="text-gray-400 text-xs">연락처 없음</span>
                                    )}
                                  </div>
                                </td>
                                
                                {/* 출석 상태 열 */}
                                <td className="px-4 py-4 whitespace-nowrap">
                                  {(() => {
                                    const attendanceRecord = getStaffAttendanceStatus(staff.id);
                                    return attendanceRecord ? (
                                      <AttendanceStatusCard
                                        status={attendanceRecord.status}
                                        checkInTime={attendanceRecord.checkInTime}
                                        checkOutTime={attendanceRecord.checkOutTime}
                                        size="sm"
                                      />
                                    ) : (
                                      <AttendanceStatusCard
                                        status="not_started"
                                        size="sm"
                                      />
                                    );
                                  })()} 
                                </td>
                                
                                {/* 예외 상황 열 */}
                                <td className="px-4 py-4 whitespace-nowrap">
                                  {(() => {
                                    const record = attendanceRecords.find(r => r.staffId === staff.id);
                                    if (record?.workLog?.exception) {
                                      const exceptionType = record.workLog.exception.type;
                                      const exceptionIcon = getExceptionIcon(exceptionType);
                                      const severity = getExceptionSeverity(exceptionType);
                                      return (
                                        <div className="flex items-center gap-1">
                                          <span className={`text-${severity === 'high' ? 'red' : severity === 'medium' ? 'yellow' : 'orange'}-500`}>
                                            {exceptionIcon}
                                          </span>
                                          <span className="text-xs text-gray-600">
                                            {t(`exceptions.types.${exceptionType}`)}
                                          </span>
                                        </div>
                                      );
                                    }
                                    return <span className="text-gray-400 text-xs">정상</span>;
                                  })()} 
                                </td>
                                
                                {/* 작업 열 */}
                                <td className="px-4 py-4 whitespace-nowrap">
                                  <div className="flex space-x-1">
                                    <button
                                      onClick={() => handleEditWorkTime(staff.id)}
                                      className="px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                      title="시간 수정"
                                    >
                                      시간
                                    </button>
                                    <button
                                      onClick={() => handleExceptionEdit(staff.id)}
                                      className="px-2 py-1 text-xs font-medium text-orange-600 hover:text-orange-800 hover:bg-orange-50 rounded transition-colors"
                                      title="예외 상황 처리"
                                    >
                                      예외
                                    </button>
                                    <button
                                      onClick={() => deleteStaff(staff.id)}
                                      className="px-2 py-1 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                                      title="스태프 삭제"
                                    >
                                      삭제
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              // 단일 테이블 보기
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          시간
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          이름
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          역할
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          연락처
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          출석
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          예외
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          작업
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {Object.values(groupedStaffData.grouped).flat().map((staff) => (
                        <tr key={staff.id} className="hover:bg-gray-50 transition-colors">
                          {/* 단일 테이블에서는 날짜별 그룹화와 동일한 내용 */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getTimeSlotColor(staff.assignedTime)}`}>
                              ⏰ {formatTimeDisplay(staff.assignedTime)}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-8 w-8">
                                <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center text-sm font-medium text-gray-700">
                                  {(staff.name || 'U').charAt(0).toUpperCase()}
                                </div>
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900">
                                  {staff.name || '이름 미정'}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {staff.assignedDate ? staff.assignedDate : '날짜 미정'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {staff.assignedRole || staff.role || '-'}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 space-y-1">
                              {staff.phone && (
                                <div className="flex items-center">
                                  <svg className="w-3 h-3 mr-1 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                                  </svg>
                                  <a href={`tel:${staff.phone}`} className="text-blue-600 hover:text-blue-800">
                                    {staff.phone}
                                  </a>
                                </div>
                              )}
                              {staff.email && (
                                <div className="flex items-center">
                                  <svg className="w-3 h-3 mr-1 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                                  </svg>
                                  <a href={`mailto:${staff.email}`} className="text-blue-600 hover:text-blue-800">
                                    {staff.email.length > 20 ? `${staff.email.substring(0, 20)}...` : staff.email}
                                  </a>
                                </div>
                              )}
                              {!staff.phone && !staff.email && (
                                <span className="text-gray-400 text-xs">연락처 없음</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            {(() => {
                              const attendanceRecord = getStaffAttendanceStatus(staff.id);
                              return attendanceRecord ? (
                                <AttendanceStatusCard
                                  status={attendanceRecord.status}
                                  checkInTime={attendanceRecord.checkInTime}
                                  checkOutTime={attendanceRecord.checkOutTime}
                                  size="sm"
                                />
                              ) : (
                                <AttendanceStatusCard
                                  status="not_started"
                                  size="sm"
                                />
                              );
                            })()} 
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            {(() => {
                              const record = attendanceRecords.find(r => r.staffId === staff.id);
                              if (record?.workLog?.exception) {
                                const exceptionType = record.workLog.exception.type;
                                const exceptionIcon = getExceptionIcon(exceptionType);
                                const severity = getExceptionSeverity(exceptionType);
                                return (
                                  <div className="flex items-center gap-1">
                                    <span className={`text-${severity === 'high' ? 'red' : severity === 'medium' ? 'yellow' : 'orange'}-500`}>
                                      {exceptionIcon}
                                    </span>
                                    <span className="text-xs text-gray-600">
                                      {t(`exceptions.types.${exceptionType}`)}
                                    </span>
                                  </div>
                                );
                              }
                              return <span className="text-gray-400 text-xs">정상</span>;
                            })()} 
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex space-x-1">
                              <button
                                onClick={() => handleEditWorkTime(staff.id)}
                                className="px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                title="시간 수정"
                              >
                                시간
                              </button>
                              <button
                                onClick={() => handleExceptionEdit(staff.id)}
                                className="px-2 py-1 text-xs font-medium text-orange-600 hover:text-orange-800 hover:bg-orange-50 rounded transition-colors"
                                title="예외 상황 처리"
                              >
                                예외
                              </button>
                              <button
                                onClick={() => deleteStaff(staff.id)}
                                className="px-2 py-1 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                                title="스태프 삭제"
                              >
                                삭제
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* QR 코드 생성 모달 */}
      <QRCodeGeneratorModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        eventId={jobPosting?.id || 'default-event'}
        title={t('attendance.actions.generateQR')}
        description={`${jobPosting?.title || '공고'} 스태프들이 출석 체크를 할 수 있는 QR 코드를 생성합니다.`}
      />

      {/* 시간 수정 모달 */}
      <WorkTimeEditor
        isOpen={isWorkTimeEditorOpen}
        onClose={() => setIsWorkTimeEditorOpen(false)}
        workLog={selectedWorkLog}
        onUpdate={handleWorkTimeUpdate}
      />

      {/* 예외 상황 처리 모달 */}
      {selectedExceptionWorkLog ? <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{t('exceptions.title', '예외 상황 처리')}</h3>
              <button
                onClick={() => {
                  // setIsExceptionModalOpen(false); // This line is removed
                  setSelectedExceptionWorkLog(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimes />
              </button>
            </div>
            
            <AttendanceExceptionHandler
              workLog={selectedExceptionWorkLog}
              onExceptionUpdated={handleExceptionUpdate}
            />
          </div>
        </div> : null}

    </>
  );
};

export default StaffManagementTab;