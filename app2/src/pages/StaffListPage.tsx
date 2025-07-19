import { collection, query, where, getDocs, doc, documentId, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FaTimes } from 'react-icons/fa';

import { AttendanceExceptionHandler } from '../components/AttendanceExceptionHandler';
import AttendanceStatusCard from '../components/AttendanceStatusCard';
import PayrollSummaryModal from '../components/PayrollSummaryModal';
import QRCodeGeneratorModal from '../components/QRCodeGeneratorModal';
import WorkTimeEditor from '../components/WorkTimeEditor';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { useAttendanceStatus } from '../hooks/useAttendanceStatus';
import { usePayrollData } from '../hooks/usePayrollData';
import { getExceptionIcon, getExceptionSeverity } from '../utils/attendanceExceptionUtils';
import { PayrollCalculationData } from '../utils/payroll/types';

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
  }

interface UserData {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  userRole?: UserRole;    // 계정 권한 (dealer, manager, admin 등)
  gender?: string;
  age?: number;
  experience?: string;
  nationality?: string;
  history?: string;
  notes?: string;
}
interface StaffJobPosting {
  id: string;
  title: string;
  confirmedStaff?: { userId: string; role: string; timeSlot: string; }[];
  managerId?: string;
}

type SortKey = keyof StaffData;

const StaffListPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  
  const [staffData, setStaffData] = useState<StaffData[]>([]);
  const [jobPostings, setJobPostings] = useState<Pick<StaffJobPosting, 'id' | 'title'>[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 출석 상태 관리
  const { 
    attendanceRecords, 
    loading: attendanceLoading, 
    error: attendanceError,
    getStaffAttendanceStatus 
  } = useAttendanceStatus({ 
    eventId: 'default-event',
    date: new Date().toISOString().split('T')[0] 
  });
  
  // 급여 데이터 관리
  const {
    generatePayrollFromWorkLogs,
    payrollData: generatedPayrollData,
    summary: payrollSummary,
    loading: payrollLoading,
    error: payrollError,
    exportToCSV
  } = usePayrollData({
    eventId: 'default-event'
  });

  // States for filtering and sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPostId, setFilterPostId] = useState('');
  const [sortOption, setSortOption] = useState<string>(''); // 새로운 정렬 옵션 state
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>(null);
  
  // 편집 기능 관련 states
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: keyof StaffData } | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [tempStaffData, setTempStaffData] = useState<StaffData[]>([]);
  
  // QR 코드 생성 모달 관련 states
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  
  // 시간 수정 모달 관련 states
  const [isWorkTimeEditorOpen, setIsWorkTimeEditorOpen] = useState(false);
  const [selectedWorkLog, setSelectedWorkLog] = useState<any | null>(null);
  
  // 예외 상황 처리 모달 관련 states
  const [isExceptionModalOpen, setIsExceptionModalOpen] = useState(false);
  const [selectedExceptionWorkLog, setSelectedExceptionWorkLog] = useState<any | null>(null);
  
  // 급여 처리 관련 states
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);
  const [payrollData, setPayrollData] = useState<PayrollCalculationData[]>([]);
  const [isGeneratingPayroll, setIsGeneratingPayroll] = useState(false);
  
  // 스태프 추가 모달 관련 states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserData[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [tempStaffInfo, setTempStaffInfo] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'Dealer' as JobRole,  // 업무 역할
    gender: '',
    age: 0,
    experience: '',
    nationality: '',
    history: '',
    notes: ''
  });
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const fetchManagerStaff = async () => {
      setLoading(true);
      setError(null);
      try {
        // 디버깅: 현재 사용자 ID 확인
        console.log('🔍 StaffListPage - 현재 사용자 ID:', currentUser.uid);
        
        // 먼저 모든 staff 문서를 확인해보자
        const allStaffQuery = query(collection(db, 'staff'));
        const allStaffSnapshot = await getDocs(allStaffQuery);
        console.log('🔍 전체 Staff 문서 수:', allStaffSnapshot.size);
        allStaffSnapshot.forEach(doc => {
          console.log('🔍 Staff 문서:', doc.id, doc.data());
        });
        
        // 현재 로그인한 관리자(manager)의 ID와 일치하는 managerId를 가진 스태프만 가져옵니다.
        const staffQuery = query(collection(db, 'staff'), where('managerId', '==', currentUser.uid));
        const staffSnapshot = await getDocs(staffQuery);
        console.log('🔍 관리자별 Staff 문서 수:', staffSnapshot.size);
    
        if (staffSnapshot.empty) {
          console.log('⚠️ 해당 관리자의 스태프가 없습니다.');
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
            role: data.jobRole && Array.isArray(data.jobRole) ? data.jobRole[0] as JobRole : data.role
          } as StaffData;
        });

        // staffList는 나중에 구인공고 제목과 매핑된 후에 설정됩니다.

        // JobPostings 정보는 필터링을 위해서만 최소한으로 가져옵니다.
        console.log('🔍 구인공고 가져오기 시작 - 현재 사용자 ID:', currentUser.uid);
        const postingsQuery = query(collection(db, 'jobPostings'), where('managerId', '==', currentUser.uid));
        const postingsSnapshot = await getDocs(postingsQuery);
        console.log('🔍 구인공고 결과 개수:', postingsSnapshot.size);
        const postingsData = postingsSnapshot.docs.map(doc => ({ id: doc.id, title: doc.data().title }));
        console.log('🔍 구인공고 데이터:', postingsData);
        
        // 스태프 데이터에 구인공고 제목 매핑
        const staffListWithPostingTitles = staffList.map(staff => {
          // assignedEvents 배열에 있는 모든 공고 제목 가져오기
          let postingTitles: string[] = [];
          
          if (staff.assignedEvents && Array.isArray(staff.assignedEvents)) {
            postingTitles = staff.assignedEvents.map((eventId: string) => {
              const posting = postingsData.find(p => p.id === eventId);
              return posting ? posting.title : `공고 ${eventId}`;
            });
          } else if (staff.postingId) {
            // 레거시 데이터 지원
            const posting = postingsData.find(p => p.id === staff.postingId);
            postingTitles = [posting ? posting.title : `공고 ${staff.postingId}`];
          }
          
          return {
            ...staff,
            postingTitle: postingTitles.length > 0 ? postingTitles.join(', ') : '구인공고 없음'
          };
        });
        
        console.log('🔍 구인공고 제목이 매핑된 스태프 데이터:', staffListWithPostingTitles);
        
        setStaffData(staffListWithPostingTitles);
        setJobPostings(postingsData);

      } catch (e) {
        console.error("Error fetching staff data: ", e);
        setError(t('staffListPage.fetchError'));
      } finally {
        setLoading(false);
      }
    };

    fetchManagerStaff();
  }, [currentUser, t]);
  
  // 편집 기능 핸들러
  const handleCellClick = (rowId: string, field: keyof StaffData, currentValue: any) => {
    // 편집 불가능한 필드 제외
    const readOnlyFields: (keyof StaffData)[] = ['id', 'userId', 'postingId', 'postingTitle'];
    if (readOnlyFields.includes(field)) return;
    
    setEditingCell({ rowId, field });
    setEditingValue(String(currentValue || ''));
  };
  
  const handleCellSave = async () => {
    if (!editingCell) return;
    
    const { rowId, field } = editingCell;
    const currentStaff = staffData.find(staff => staff.id === rowId);
    
    if (!currentStaff) {
      setError(t('staffListPage.staffNotFound'));
      return;
    }
    
    const newValue = field === 'age' ? Number(editingValue) || 0 : editingValue;
    
    try {
      // 임시 스태프와 기존 사용자 구분
      if (currentStaff.userId && currentStaff.userId.trim() !== '') {
        // 기존 사용자의 경우 users 컸렉션 업데이트
        const userRef = doc(db, 'users', currentStaff.userId);
        await updateDoc(userRef, {
          [field]: newValue,
          updatedAt: serverTimestamp()
        });
      }
      
      // staff 컸렉션에도 업데이트 (모든 스태프)
      // 단, staff 컸렉션에 문서가 있는 경우에만
      try {
        const staffRef = doc(db, 'staff', currentStaff.id);
        await updateDoc(staffRef, {
          [field]: newValue,
          // role 필드 업데이트 시 jobRole 배열도 함께 업데이트
          ...(field === 'role' && { jobRole: [newValue] }),
          updatedAt: serverTimestamp()
        });
      } catch (staffUpdateError) {
        // staff 컸렉션에 문서가 없으면 무시 (기존 job postings에서 온 데이터)
        console.log('스태프 컸렉션 업데이트 스킵:', staffUpdateError);
      }
      
      // 로컬 상태 업데이트
      setStaffData(prevData => 
        prevData.map(staff => 
          staff.id === rowId 
            ? { ...staff, [field]: newValue }
            : staff
        )
      );
      
      console.log(`스태프 ${field} 필드가 성공적으로 업데이트되었습니다:`, newValue);
    } catch (error: any) {
      console.error('스태프 정보 업데이트 오류:', error);
      setError(error.message || t('staffListPage.updateError'));
      
      // 오류 발생 시 editingValue를 원래 값으로 되돌림
      return;
    }
    
    setEditingCell(null);
    setEditingValue('');
  };
  
  const handleCellCancel = () => {
    setEditingCell(null);
    setEditingValue('');
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellSave();
    } else if (e.key === 'Escape') {
      handleCellCancel();
    }
  };
  
  // 출퇴근 시간 수정 핸들러
  const handleEditWorkTime = (staffId: string) => {
    // 해당 스태프의 출석 기록을 찾기
    const workLog = attendanceRecords.find(record => 
      record.workLog?.eventId === 'default-event' && 
      record.staffId === staffId &&
      record.workLog?.date === new Date().toISOString().split('T')[0]
    );
    
    if (workLog) {
      setSelectedWorkLog(workLog);
      setIsWorkTimeEditorOpen(true);
    } else {
      // 오늘 날짜에 대한 근무 기록이 없는 경우
      console.log('오늘 날짜에 대한 근무 기록을 찾을 수 없습니다.');
    }
  };
  
  const handleWorkTimeUpdate = (updatedWorkLog: any) => {
    // 업데이트된 근무 로그로 로컬 상태 업데이트
    // 실제로는 useAttendanceStatus 훅이 자동으로 업데이트됨
    console.log('근무 시간이 업데이트되었습니다:', updatedWorkLog);
  };
  
  // 예외 상황 처리 함수
  const handleExceptionEdit = (staffId: string) => {
    const workLog = attendanceRecords.find(record => 
      record.workLog?.eventId === 'default-event' && 
      record.staffId === staffId &&
      record.workLog?.date === new Date().toISOString().split('T')[0]
    );
    
    if (workLog?.workLog) {
      setSelectedExceptionWorkLog(workLog.workLog);
      setIsExceptionModalOpen(true);
    }
  };
  
  const handleExceptionUpdate = (updatedWorkLog: any) => {
    console.log('예외 상황이 업데이트되었습니다:', updatedWorkLog);
    setIsExceptionModalOpen(false);
    setSelectedExceptionWorkLog(null);
  };
  
  // 급여 처리 관련 함수들
  const handleGeneratePayroll = async () => {
    setIsGeneratingPayroll(true);
    try {
      const currentDate = new Date().toISOString().split('T')[0];
      await generatePayrollFromWorkLogs('default-event', currentDate, currentDate);
      setPayrollData(generatedPayrollData);
      setIsPayrollModalOpen(true);
    } catch (error) {
      console.error('급여 데이터 생성 오류:', error);
    } finally {
      setIsGeneratingPayroll(false);
    }
  };
  
  const handleExportPayrollCSV = () => {
    if (payrollData.length === 0) {
      alert(t('payroll.noDataToExport', '내보낼 급여 데이터가 없습니다.'));
      return;
    }
    
    const csvData = exportToCSV();
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `payroll_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // 스태프 추가 모달 열기
  const addNewRow = () => {
    if (!currentUser || jobPostings.length === 0) {
      setError(t('staffListPage.cannotAddStaff'));
      return;
    }
    setIsAddModalOpen(true);
    setModalSearchTerm('');
    setSearchResults([]);
    setSelectedUser(null);
    setTempStaffInfo({
      name: '',
      email: '',
      phone: '',
      role: 'Dealer',
      gender: '',
      age: 0,
      experience: '',
      nationality: '',
      history: '',
      notes: ''
    });
  };
  
  // 기존 사용자 검색
  const searchExistingUsers = async () => {
    if (!modalSearchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    
    try {
      setIsSearching(true);
      const usersRef = collection(db, 'users');
      const q = query(usersRef);
      const querySnapshot = await getDocs(q);
      
      const users: UserData[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data() as Omit<UserData, 'id'>
      }));
      
      // 검색어로 필터링
      const filteredUsers = users.filter(user => 
        user.name?.toLowerCase().includes(modalSearchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(modalSearchTerm.toLowerCase()) ||
        user.phone?.toLowerCase().includes(modalSearchTerm.toLowerCase())
      );
      
      setSearchResults(filteredUsers);
    } catch (error: any) {
      console.error('사용자 검색 오류:', error);
      setError('사용자 검색에 실패했습니다.');
    } finally {
      setIsSearching(false);
    }
  };
  
  // 기존 사용자를 스태프로 추가
  const addExistingUser = async () => {
    if (!selectedUser || jobPostings.length === 0) return;
    
    try {
      const defaultPostingId = jobPostings[0].id;
      const defaultPostingTitle = jobPostings[0].title;
      
      const newStaff: StaffData = {
        id: `user-${selectedUser.id}-${Date.now()}`,
        userId: selectedUser.id,
        name: selectedUser.name || '',
        email: selectedUser.email || '',
        phone: selectedUser.phone || '',
        role: 'Dealer' as JobRole,      // 기본 업무 역할
        userRole: selectedUser.userRole, // 계정 권한
        gender: selectedUser.gender || '',
        age: selectedUser.age || 0,
        experience: selectedUser.experience || '',
        nationality: selectedUser.nationality || '',
        history: selectedUser.history || '',
        notes: selectedUser.notes || '',
        postingId: defaultPostingId,
        postingTitle: defaultPostingTitle
      };
      
      // Firebase에 저장
      const staffRef = collection(db, 'staff');
      const docRef = await addDoc(staffRef, {
        ...newStaff,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // ID를 문서 ID로 업데이트
      await updateDoc(docRef, { id: docRef.id });
      newStaff.id = docRef.id;
      
      // 로컬 상태 업데이트
      setStaffData(prevData => [...prevData, newStaff]);
      
      // 모달 닫기
      setIsAddModalOpen(false);
      setSelectedUser(null);
      setModalSearchTerm('');
      setSearchResults([]);
      
      setError('');
    } catch (error: any) {
      console.error('스태프 추가 오류:', error);
      setError('스태프 추가에 실패했습니다.');
    }
  };
  
  // 임시 스태프 추가
  const addTempStaff = async () => {
    if (!tempStaffInfo.name.trim() || jobPostings.length === 0) {
      setError('스태프 이름을 입력해주세요.');
      return;
    }
    
    try {
      const defaultPostingId = jobPostings[0].id;
      const defaultPostingTitle = jobPostings[0].title;
      
      const newStaff: StaffData = {
        id: `temp-${Date.now()}`,
        userId: '',
        name: tempStaffInfo.name,
        email: tempStaffInfo.email,
        phone: tempStaffInfo.phone,
        role: tempStaffInfo.role,
        userRole: 'staff' as UserRole, // 임시 스태프 기본 권한
        gender: tempStaffInfo.gender,
        age: tempStaffInfo.age,
        experience: tempStaffInfo.experience,
        nationality: tempStaffInfo.nationality,
        history: tempStaffInfo.history,
        notes: tempStaffInfo.notes,
        postingId: defaultPostingId,
        postingTitle: defaultPostingTitle
      };
      
      // Firebase에 저장
      const staffRef = collection(db, 'staff');
      const docRef = await addDoc(staffRef, {
        ...newStaff,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // ID를 문서 ID로 업데이트
      await updateDoc(docRef, { id: docRef.id });
      newStaff.id = docRef.id;
      
      // 로컬 상태 업데이트
      setStaffData(prevData => [...prevData, newStaff]);
      
      // 모달 닫기
      setIsAddModalOpen(false);
      setTempStaffInfo({
        name: '',
        email: '',
        phone: '',
        role: 'Dealer',
        gender: '',
        age: 0,
        experience: '',
        nationality: '',
        history: '',
        notes: ''
      });
      
      setError('');
    } catch (error: any) {
      console.error('스태프 추가 오류:', error);
      setError('스태프 추가에 실패했습니다.');
    }
  };
  const handleSortChange = (value: string) => {
    setSortOption(value);
    if (!value) {
      setSortConfig(null);
      return;
    }
    
    const [key, direction] = value.split('-') as [SortKey, 'ascending' | 'descending'];
    setSortConfig({ key, direction });
  };
  
  // 스태프 삭제 기능
  const deleteStaff = async (staffId: string) => {
    if (!window.confirm('이 스태프를 삭제하시겠습니까?')) {
      return;
    }
    
    try {
      // Firebase에서 삭제
      const staffDocRef = doc(db, 'staff', staffId);
      await deleteDoc(staffDocRef);
      
      // 로컬 상태에서 삭제
      setStaffData(prevData => prevData.filter(staff => staff.id !== staffId));
      
      setError('');
    } catch (error: any) {
      console.error('스태프 삭제 오류:', error);
      setError('스태프 삭제에 실패했습니다.');
    }
  };

  const filteredAndSortedStaff = useMemo(() => {
    let sortableItems = [...staffData];

    if (filterPostId) {
      sortableItems = sortableItems.filter(staff => staff.postingId === filterPostId);
    }

    if (searchTerm) {
      sortableItems = sortableItems.filter(staff =>
        staff.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.gender?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.experience?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.nationality?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.history?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.notes?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        const aValExists = aValue !== null && aValue !== undefined;
        const bValExists = bValue !== null && bValue !== undefined;
      
        if (!aValExists) return 1;
        if (!bValExists) return -1;
      
        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        
        return 0;
      });
    }

    return sortableItems;
  }, [staffData, searchTerm, filterPostId, sortConfig]);

  if (loading) {
    return <div className="flex justify-center items-center h-full"><div className="text-xl font-semibold">{t('loading')}</div></div>;
  }

  if (error) {
    return <div className="text-red-500 text-center">{error}</div>;
  }

  // 일반 헤더 컴포넌트 (정렬 기능 제거)
  const TableHeader = ({ label }: { label: string }) => (
    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
      {label}
    </th>
  );
  
  // 편집 가능한 셀 컴포넌트
  const EditableCell = ({ 
    staff, 
    field, 
    value, 
    isReadOnly = false 
  }: { 
    staff: StaffData; 
    field: keyof StaffData; 
    value: any; 
    isReadOnly?: boolean;
  }) => {
    const isEditing = editingCell?.rowId === staff.id && editingCell?.field === field;
    
    if (isReadOnly) {
      return (
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {value || '-'}
        </td>
      );
    }
    
    if (isEditing) {
      return (
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {field === 'role' ? (
            <select
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onBlur={handleCellSave}
              className="w-full px-2 py-1 border border-blue-300 rounded focus:outline-none focus:border-blue-500"
              autoFocus
            >
              <option value="Dealer">딜러</option>
              <option value="Floor">플로어</option>
              <option value="Server">서빙</option>
              <option value="Tournament Director">토너먼트 디렉터</option>
              <option value="Chip Master">칩 마스터</option>
              <option value="Registration">레지</option>
              <option value="Security">보안요원</option>
              <option value="Cashier">캐셔</option>
            </select>
          ) : (
            <input
              type={field === 'age' ? 'number' : 'text'}
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onKeyDown={handleKeyPress}
              onBlur={handleCellSave}
              className="w-full px-2 py-1 border border-blue-300 rounded focus:outline-none focus:border-blue-500"
              autoFocus
            />
          )}
        </td>
      );
    }
    
    return (
      <td 
        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer hover:bg-gray-50"
        onClick={() => handleCellClick(staff.id, field, value)}
        title="클릭하여 편집"
      >
        {field === 'gender' && value ? t(`gender.${value.toLowerCase()}`, value) : 
         field === 'age' && value ? `${value}세` : 
         value || '-'}
      </td>
    );
  };

  return (
    <>
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">{t('staffListPage.title')}</h1>

      <div className="mb-4 flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
        <input
          type="text"
          placeholder={t('participants.searchPlaceholder')}
          className="w-full md:w-1/3 p-2 border border-gray-300 rounded-md"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="w-full md:w-1/3 p-2 border border-gray-300 rounded-md"
          value={filterPostId}
          onChange={(e) => setFilterPostId(e.target.value)}
        >
          <option value="">구인공고 ({t('common.all', 'All')})</option>
          {jobPostings.length > 0 ? (
            jobPostings.map(post => (
              <option key={post.id} value={post.id}>{post.title}</option>
            ))
          ) : (
            <option disabled>구인공고가 없습니다</option>
          )}
        </select>
        <select
          className="w-full md:w-1/3 p-2 border border-gray-300 rounded-md"
          value={sortOption}
          onChange={(e) => handleSortChange(e.target.value)}
        >
          <option value="">{t('common.sort', '정렬')} ({t('common.none', '없음')})</option>
          <option value="postingTitle-ascending">구인공고 (오름차순)</option>
          <option value="postingTitle-descending">구인공고 (내림차순)</option>
          <option value="role-ascending">역할 (오름차순)</option>
          <option value="role-descending">역할 (내림차순)</option>
          <option value="name-ascending">{t('staffNew.labelName')} (오름차순)</option>
          <option value="name-descending">{t('staffNew.labelName')} (내림차순)</option>
          <option value="gender-ascending">{t('signUp.genderLabel')} (오름차순)</option>
          <option value="gender-descending">{t('signUp.genderLabel')} (내림차순)</option>
          <option value="age-ascending">{t('profilePage.age')} (오름차순)</option>
          <option value="age-descending">{t('profilePage.age')} (내림차순)</option>
          <option value="experience-ascending">{t('profilePage.experience')} (오름차순)</option>
          <option value="experience-descending">{t('profilePage.experience')} (내림차순)</option>
          <option value="phone-ascending">{t('signUp.phoneLabel')} (오름차순)</option>
          <option value="phone-descending">{t('signUp.phoneLabel')} (내림차순)</option>
          <option value="email-ascending">{t('staffNew.labelEmail')} (오름차순)</option>
          <option value="email-descending">{t('staffNew.labelEmail')} (내림차순)</option>
          <option value="nationality-ascending">{t('profilePage.nationality')} (오름차순)</option>
          <option value="nationality-descending">{t('profilePage.nationality')} (내림차순)</option>
        </select>
        <button
          onClick={addNewRow}
          className="w-full md:w-auto px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 whitespace-nowrap"
        >
          + 추가
          </button>
          <button
          onClick={() => setIsQrModalOpen(true)}
          className="w-full md:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 whitespace-nowrap"
          >
          {t('attendance.actions.generateQR')}
          </button>
          <button
            onClick={handleGeneratePayroll}
            disabled={isGeneratingPayroll}
            className="w-full md:w-auto px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGeneratingPayroll ? t('payroll.generating', '급여 계산중...') : t('payroll.calculate', '급여 계산')}
          </button>
          <button
            onClick={handleExportPayrollCSV}
            disabled={payrollData.length === 0 || payrollLoading}
            className="w-full md:w-auto px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('payroll.export', '급여 CSV 내보내기')}
          </button>
        </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <TableHeader label="구인공고" />
                <TableHeader label="역할" />
                <TableHeader label={t('staffNew.labelName')} />
                <TableHeader label={t('signUp.genderLabel')} />
                <TableHeader label={t('profilePage.age')} />
                <TableHeader label={t('profilePage.experience')} />
                <TableHeader label={t('signUp.phoneLabel')} />
                <TableHeader label={t('staffNew.labelEmail')} />
                <TableHeader label={t('profilePage.nationality')} />
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('profilePage.history')}</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('profilePage.notes')}</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">출석 상태</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">예외 상황</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">작업</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedStaff.length > 0 ? filteredAndSortedStaff.map((staff) => (
                <tr key={staff.id}>
                  <EditableCell staff={staff} field="postingTitle" value={staff.postingTitle} isReadOnly={true} />
                  <EditableCell staff={staff} field="role" value={staff.role} />
                  <EditableCell staff={staff} field="name" value={staff.name} />
                  <EditableCell staff={staff} field="gender" value={staff.gender} />
                  <EditableCell staff={staff} field="age" value={staff.age} />
                  <EditableCell staff={staff} field="experience" value={staff.experience} />
                  <EditableCell staff={staff} field="phone" value={staff.phone} />
                  <EditableCell staff={staff} field="email" value={staff.email} />
                  <EditableCell staff={staff} field="nationality" value={staff.nationality} />
                  <EditableCell staff={staff} field="history" value={staff.history} />
                  <EditableCell staff={staff} field="notes" value={staff.notes} />
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {(() => {
                      const attendanceRecord = getStaffAttendanceStatus(staff.id);
                      return attendanceRecord ? (
                        <AttendanceStatusCard
                          status={attendanceRecord.status}
                          checkInTime={attendanceRecord.checkInTime}
                          checkOutTime={attendanceRecord.checkOutTime}
                          size="sm"
                          exception={attendanceRecord.workLog?.exception}
                        />
                      ) : (
                        <AttendanceStatusCard
                          status="not_started"
                          size="sm"
                        />
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {/* 예외 상황 처리 기능 */}
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <button
                      onClick={() => handleEditWorkTime(staff.id)}
                      className="text-blue-600 hover:text-blue-900 font-medium mr-3"
                      title="시간 수정"
                    >
                      시간 수정
                    </button>
                    <button
                      onClick={() => handleExceptionEdit(staff.id)}
                      className="text-orange-600 hover:text-orange-900 font-medium mr-3"
                      title="예외 상황 처리"
                    >
                      예외 처리
                    </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <button
                      onClick={() => deleteStaff(staff.id)}
                      className="text-red-600 hover:text-red-900 font-medium"
                      title="스태프 삭제"
                    >
                      삭제
                    </button>
                  </td>
                  </tr>
              )) : (
               <tr>
                 <td colSpan={15} className="px-6 py-4 text-center text-sm text-gray-500">
                   {t('staffListPage.noConfirmedStaff')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    
    {/* 스태프 추가 모달 */}
    {isAddModalOpen ? <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">스태프 추가</h2>
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 기존 사용자 검색 */}
            <div className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-3">기존 사용자 검색</h3>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="이름, 이메일, 전화번호로 검색..."
                    className="flex-1 p-2 border border-gray-300 rounded-md"
                    value={modalSearchTerm}
                    onChange={(e) => setModalSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && searchExistingUsers()}
                  />
                  <button
                    onClick={searchExistingUsers}
                    disabled={isSearching}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSearching ? '검색중...' : '검색'}
                  </button>
                </div>
                
                {searchResults.length > 0 && (
                  <div className="max-h-40 overflow-y-auto border rounded-md">
                    {searchResults.map((user) => (
                      <div
                        key={user.id}
                        className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
                          selectedUser?.id === user.id ? 'bg-blue-50 border-blue-300' : ''
                        }`}
                        onClick={() => setSelectedUser(user)}
                      >
                        <div className="font-medium">{user.name || '이름 없음'}</div>
                        <div className="text-sm text-gray-600">{user.email}</div>
                        <div className="text-sm text-gray-600">계정 권한: {user.userRole || 'staff'}</div>
                      </div>
                    ))}
                  </div>
                )}
                
                {selectedUser ? <div className="mt-3">
                    <div className="p-3 bg-blue-50 rounded-md">
                      <div className="font-medium">선택된 사용자: {selectedUser.name}</div>
                      <div className="text-sm text-gray-600">{selectedUser.email}</div>
                    </div>
                    <button
                      onClick={addExistingUser}
                      className="w-full mt-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      이 사용자를 스태프로 추가
                    </button>
                  </div> : null}
              </div>
            </div>
            
            {/* 임시 스태프 추가 */}
            <div className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-3">임시 스태프 추가</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="이름 *"
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={tempStaffInfo.name}
                  onChange={(e) => setTempStaffInfo(prev => ({ ...prev, name: e.target.value }))}
                />
                <input
                  type="email"
                  placeholder="이메일"
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={tempStaffInfo.email}
                  onChange={(e) => setTempStaffInfo(prev => ({ ...prev, email: e.target.value }))}
                />
                <input
                  type="text"
                  placeholder="전화번호"
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={tempStaffInfo.phone}
                  onChange={(e) => setTempStaffInfo(prev => ({ ...prev, phone: e.target.value }))}
                />
                <select
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={tempStaffInfo.role}
                  onChange={(e) => setTempStaffInfo(prev => ({ ...prev, role: e.target.value as JobRole }))}
                  >
                  <option value="Dealer">딜러</option>
                  <option value="Floor">플로어</option>
                  <option value="Server">서빙</option>
                  <option value="Tournament Director">토너먼트 디렉터</option>
                  <option value="Chip Master">칩 마스터</option>
                  <option value="Registration">레지</option>
                  <option value="Security">보안요원</option>
                  <option value="Cashier">캐셔</option>
                  </select>
                  <input
                  type="text"
                  placeholder="성별"
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={tempStaffInfo.gender}
                  onChange={(e) => setTempStaffInfo(prev => ({ ...prev, gender: e.target.value }))}
                />
                <input
                  type="number"
                  placeholder="나이"
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={tempStaffInfo.age || ''}
                  onChange={(e) => setTempStaffInfo(prev => ({ ...prev, age: Number(e.target.value) || 0 }))}
                />
                <textarea
                  placeholder="경력"
                  className="w-full p-2 border border-gray-300 rounded-md h-20"
                  value={tempStaffInfo.experience}
                  onChange={(e) => setTempStaffInfo(prev => ({ ...prev, experience: e.target.value }))}
                />
                <input
                  type="text"
                  placeholder="국적"
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={tempStaffInfo.nationality}
                  onChange={(e) => setTempStaffInfo(prev => ({ ...prev, nationality: e.target.value }))}
                />
                <textarea
                  placeholder="비고"
                  className="w-full p-2 border border-gray-300 rounded-md h-20"
                  value={tempStaffInfo.notes}
                  onChange={(e) => setTempStaffInfo(prev => ({ ...prev, notes: e.target.value }))}
                />
                <button
                  onClick={addTempStaff}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  임시 스태프 추가
                </button>
              </div>
            </div>
          </div>
        </div>
        </div> : null}
        
        {/* QR 코드 생성 모달 */}
        <QRCodeGeneratorModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        eventId="default-event"
        title={t('attendance.actions.generateQR')}
        description="스태프들이 출석 체크를 할 수 있는 QR 코드를 생성합니다."
        />
        
        {/* 시간 수정 모달 */}
        <WorkTimeEditor
          isOpen={isWorkTimeEditorOpen}
          onClose={() => setIsWorkTimeEditorOpen(false)}
          workLog={selectedWorkLog}
          onUpdate={handleWorkTimeUpdate}
          />
          
          {selectedExceptionWorkLog ? <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">{t('exceptions.title', '예외 상황 처리')}</h3>
                <button
                  onClick={() => {
                    setIsExceptionModalOpen(false);
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
        
        
        {/* 급여 계산 요약 모달 */}
        <PayrollSummaryModal
          isOpen={isPayrollModalOpen}
          onClose={() => setIsPayrollModalOpen(false)}
          payrollData={payrollData}
          summary={payrollSummary}
          onExport={handleExportPayrollCSV}
        />
        </>
        );
        };
        
        export default StaffListPage;
