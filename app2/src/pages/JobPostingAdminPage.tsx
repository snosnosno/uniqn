import React, { useState, useMemo, Suspense, lazy } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, query, doc, updateDoc, deleteDoc, Timestamp, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useCollection } from 'react-firebase-hooks/firestore';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import DateDropdownSelector from '../components/DateDropdownSelector';
import LoadingSpinner from '../components/LoadingSpinner';

// Import centralized type definitions
import { 
  RoleRequirement, 
  TimeSlot, 
  DateSpecificRequirement,
  ConfirmedStaff,
  JobPostingUtils 
} from '../types/jobPosting';

const JobPostingAdminPage = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  
  // Memoized query for better performance
  const jobPostingsQuery = useMemo(() => query(collection(db, 'jobPostings')), []);
  const [jobPostingsSnap, loading] = useCollection(jobPostingsQuery);
  
  // Memoized filtered job postings for better performance
  const jobPostings = useMemo(() => 
    jobPostingsSnap?.docs.map(d => ({ id: d.id, ...d.data() })) || [],
    [jobPostingsSnap]
  );
  
  const getTodayString = () => new Date().toISOString().split('T')[0];
  
  const initialTimeSlot = { time: '09:00', roles: [{ name: 'dealer', count: 1 }] };
  const [formData, setFormData] = useState({
    title: '',
    type: 'application', // 모집 유형: 'application'(지원) 또는 'fixed'(고정)
    timeSlots: [initialTimeSlot],
    dateSpecificRequirements: [] as DateSpecificRequirement[], // 일자별 요구사항
    usesDifferentDailyRequirements: false, // 일자별 다른 인원 요구사항 사용 여부
    description: '',
    status: 'open',
    location: '서울',
    startDate: getTodayString(),
    endDate: getTodayString(),
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentPost, setCurrentPost] = useState<any>(null);
  const [isMatching, setIsMatching] = useState<string | null>(null);
  const [isCreateFormVisible, setIsCreateFormVisible] = useState(false);

  // 모든 JobRole을 포함하도록 확장된 역할 목록
  const predefinedRoles = [
    'dealer',              // 딜러
    'floor',               // 플로어  
    'serving',             // 서빙
    'tournament_director', // 토너먼트 디렉터
    'chip_master',         // 칩 마스터
    'registration',        // 레지스트레이션
    'security',            // 보안요원
    'cashier'              // 캐셔
  ];
  const locations = [
    '서울', '경기', '인천', '강원', '대전', '세종', '충남', '충북', 
    '광주', '전남', '전북', '대구', '경북', '부산', '울산', '경남', '제주', '해외', '기타'
  ];

  const formatDate = (dateInput: any) => {
    if (!dateInput) return '';
    
    try {
      let date: Date;
      
      // Handle Firebase Timestamp object
      if (dateInput && typeof dateInput === 'object' && 'seconds' in dateInput) {
        // Firebase Timestamp object
        date = new Date(dateInput.seconds * 1000);
      } else if (dateInput instanceof Date) {
        // Already a Date object
        date = dateInput;
      } else if (typeof dateInput === 'string') {
        // String date
        date = new Date(dateInput);
      } else {
        console.warn('Unknown date format:', dateInput);
        return String(dateInput); // Convert to string as fallback
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date:', dateInput);
        return String(dateInput); // Convert to string as fallback
      }
      
      const year = date.getFullYear().toString().slice(-2);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      
      // Get day of week with fallback
      const dayOfWeekIndex = date.getDay();
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      const dayOfWeek = dayNames[dayOfWeekIndex] || '?';
      
      return `${year}-${month}-${day}(${dayOfWeek})`;
    } catch (error) {
      console.error('Error formatting date:', error, dateInput);
      return String(dateInput); // Convert to string as fallback
    }
  };

  // 안전한 날짜 변환 함수들
  const convertToDateString = (dateInput: any): string => {
    if (!dateInput) return '';
    
    try {
      let date: Date;
      
      // Handle Firebase Timestamp object
      if (dateInput && typeof dateInput === 'object' && 'seconds' in dateInput) {
        date = new Date(dateInput.seconds * 1000);
      } else if (dateInput instanceof Date) {
        date = dateInput;
      } else if (typeof dateInput === 'string') {
        // 이미 yyyy-MM-dd 형식인지 확인
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
          return dateInput;
        }
        date = new Date(dateInput);
      } else {
        console.warn('Unknown date format:', dateInput);
        return '';
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date:', dateInput);
        return '';
      }
      
      // Convert to yyyy-MM-dd format for HTML date input
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error('Error converting date to string:', error, dateInput);
      return '';
    }
  };

  // DateDropdownSelector 호환성을 위한 변환 함수들
  const dateStringToDropdownValue = (dateString: string): { year?: string; month?: string; day?: string } => {
    if (!dateString) return {};
    
    try {
      const [year, month, day] = dateString.split('-');
      return {
        year: year || '',
        month: month || '',
        day: day || ''
      };
    } catch (error) {
      console.error('Error converting date string to dropdown value:', error, dateString);
      return {};
    }
  };

  const dropdownValueToDateString = (value: { year?: string; month?: string; day?: string }): string => {
    const { year, month, day } = value;
    
    if (!year || !month || !day) {
      return '';
    }
    
    // Ensure proper formatting with leading zeros
    const formattedMonth = month.padStart(2, '0');
    const formattedDay = day.padStart(2, '0');
    
    return `${year}-${formattedMonth}-${formattedDay}`;
  };

  const convertToTimestamp = (dateInput: any): any => {
    if (!dateInput) return null;
    
    try {
      let date: Date;
      
      // Handle Firebase Timestamp object (이미 Timestamp라면 그대로 반환)
      if (dateInput && typeof dateInput === 'object' && 'seconds' in dateInput) {
        return dateInput; // 이미 Timestamp 객체
      } else if (dateInput instanceof Date) {
        date = dateInput;
      } else if (typeof dateInput === 'string') {
        date = new Date(dateInput);
      } else {
        console.warn('Unknown date format for Timestamp conversion:', dateInput);
        return null;
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date for Timestamp conversion:', dateInput);
        return null;
      }
      
      return Timestamp.fromDate(date);
    } catch (error) {
      console.error('Error converting to Timestamp:', error, dateInput);
      return null;
    }
  };

  // Navigate to detail page for comprehensive management
  const handleNavigateToDetail = (postId: string) => {
    navigate(`/admin/job-posting/${postId}`);
  };

  // Form handlers
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTimeSlotChange = (timeSlotIndex: number, value: string) => {
    const newTimeSlots = [...formData.timeSlots];
    newTimeSlots[timeSlotIndex].time = value;
    setFormData(prev => ({ ...prev, timeSlots: newTimeSlots }));
  };

  const addTimeSlot = () => {
    setFormData(prev => ({
      ...prev,
      timeSlots: [...prev.timeSlots, { time: '', roles: [{ name: 'dealer', count: 1 }] }]
    }));
  };

  const removeTimeSlot = (timeSlotIndex: number) => {
    const newTimeSlots = formData.timeSlots.filter((_, i) => i !== timeSlotIndex);
    setFormData(prev => ({ ...prev, timeSlots: newTimeSlots }));
  };

  const handleRoleChange = (timeSlotIndex: number, roleIndex: number, field: 'name' | 'count', value: string | number) => {
    const newTimeSlots = [...formData.timeSlots];
    const roleValue = field === 'count' ? (Number(value) < 1 ? 1 : Number(value)) : value;
    newTimeSlots[timeSlotIndex].roles[roleIndex] = { ...newTimeSlots[timeSlotIndex].roles[roleIndex], [field]: roleValue };
    setFormData(prev => ({ ...prev, timeSlots: newTimeSlots }));
  };

  const addRole = (timeSlotIndex: number) => {
    const newTimeSlots = [...formData.timeSlots];
    newTimeSlots[timeSlotIndex].roles.push({ name: 'dealer', count: 1 });
    setFormData(prev => ({ ...prev, timeSlots: newTimeSlots }));
  };

  const removeRole = (timeSlotIndex: number, roleIndex: number) => {
    const newTimeSlots = [...formData.timeSlots];
    newTimeSlots[timeSlotIndex].roles = newTimeSlots[timeSlotIndex].roles.filter((_, i) => i !== roleIndex);
    setFormData(prev => ({ ...prev, timeSlots: newTimeSlots }));
  };
  
  // 일자별 요구사항 관리 함수들
  const handleDifferentDailyRequirementsToggle = (enabled: boolean) => {
    if (enabled) {
      // 기존 timeSlots를 날짜 범위에 맞게 복사하여 dateSpecificRequirements 생성
      const dates = generateDateRange(formData.startDate, formData.endDate);
      const dateSpecificRequirements = dates.map(date => ({
        date,
        timeSlots: formData.timeSlots.map(ts => ({ ...ts, date }))
      }));
      
      setFormData(prev => ({
        ...prev,
        usesDifferentDailyRequirements: true,
        dateSpecificRequirements
      }));
    } else {
      // 일자별 요구사항을 기본 timeSlots로 변환
      const timeSlots = formData.dateSpecificRequirements.length > 0
        ? formData.dateSpecificRequirements[0].timeSlots.map(ts => ({ time: ts.time, roles: ts.roles }))
        : formData.timeSlots;
      
      setFormData(prev => ({
        ...prev,
        usesDifferentDailyRequirements: false,
        dateSpecificRequirements: [],
        timeSlots
      }));
    }
  };
  
  const generateDateRange = (startDate: string, endDate: string): string[] => {
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }
    
    return dates;
  };
  
  const handleDateSpecificTimeSlotChange = (dateIndex: number, timeSlotIndex: number, value: string) => {
    const newDateSpecificRequirements = [...formData.dateSpecificRequirements];
    newDateSpecificRequirements[dateIndex].timeSlots[timeSlotIndex].time = value;
    setFormData(prev => ({ ...prev, dateSpecificRequirements: newDateSpecificRequirements }));
  };
  
  const handleDateSpecificRoleChange = (
    dateIndex: number, 
    timeSlotIndex: number, 
    roleIndex: number, 
    field: 'name' | 'count', 
    value: string | number
  ) => {
    const newDateSpecificRequirements = [...formData.dateSpecificRequirements];
    const roleValue = field === 'count' ? (Number(value) < 1 ? 1 : Number(value)) : value;
    newDateSpecificRequirements[dateIndex].timeSlots[timeSlotIndex].roles[roleIndex] = {
      ...newDateSpecificRequirements[dateIndex].timeSlots[timeSlotIndex].roles[roleIndex],
      [field]: roleValue
    };
    setFormData(prev => ({ ...prev, dateSpecificRequirements: newDateSpecificRequirements }));
  };
  
  const addDateSpecificTimeSlot = (dateIndex: number) => {
    const newDateSpecificRequirements = [...formData.dateSpecificRequirements];
    newDateSpecificRequirements[dateIndex].timeSlots.push({
      time: '',
      roles: [{ name: 'dealer', count: 1 }],
      date: newDateSpecificRequirements[dateIndex].date
    });
    setFormData(prev => ({ ...prev, dateSpecificRequirements: newDateSpecificRequirements }));
  };
  
  const removeDateSpecificTimeSlot = (dateIndex: number, timeSlotIndex: number) => {
    const newDateSpecificRequirements = [...formData.dateSpecificRequirements];
    newDateSpecificRequirements[dateIndex].timeSlots = newDateSpecificRequirements[dateIndex].timeSlots.filter((_, i) => i !== timeSlotIndex);
    setFormData(prev => ({ ...prev, dateSpecificRequirements: newDateSpecificRequirements }));
  };
  
  const addDateSpecificRole = (dateIndex: number, timeSlotIndex: number) => {
    const newDateSpecificRequirements = [...formData.dateSpecificRequirements];
    newDateSpecificRequirements[dateIndex].timeSlots[timeSlotIndex].roles.push({ name: 'dealer', count: 1 });
    setFormData(prev => ({ ...prev, dateSpecificRequirements: newDateSpecificRequirements }));
  };
  
  const removeDateSpecificRole = (dateIndex: number, timeSlotIndex: number, roleIndex: number) => {
    const newDateSpecificRequirements = [...formData.dateSpecificRequirements];
    newDateSpecificRequirements[dateIndex].timeSlots[timeSlotIndex].roles = 
      newDateSpecificRequirements[dateIndex].timeSlots[timeSlotIndex].roles.filter((_, i) => i !== roleIndex);
    setFormData(prev => ({ ...prev, dateSpecificRequirements: newDateSpecificRequirements }));
  };
  
  // Edit Modal Handlers
    const handleEditTimeSlotChange = (timeSlotIndex: number, value: string) => {
        const newTimeSlots = [...currentPost.timeSlots];
        newTimeSlots[timeSlotIndex].time = value;
        setCurrentPost((prev: any) => ({ ...prev, timeSlots: newTimeSlots }));
    };

    const addEditTimeSlot = () => {
        setCurrentPost((prev: any) => ({
            ...prev,
            timeSlots: [...prev.timeSlots, { time: '', roles: [{ name: 'dealer', count: 1 }] }]
        }));
    };

    const removeEditTimeSlot = (timeSlotIndex: number) => {
        const newTimeSlots = currentPost.timeSlots.filter((_: any, i: number) => i !== timeSlotIndex);
        setCurrentPost((prev: any) => ({ ...prev, timeSlots: newTimeSlots }));
    };
    
    const handleEditRoleChange = (timeSlotIndex: number, roleIndex: number, field: 'name' | 'count', value: string | number) => {
        const newTimeSlots = [...currentPost.timeSlots];
        const roleValue = field === 'count' ? (Number(value) < 1 ? 1 : Number(value)) : value;
        newTimeSlots[timeSlotIndex].roles[roleIndex] = { ...newTimeSlots[timeSlotIndex].roles[roleIndex], [field]: roleValue };
        setCurrentPost((prev: any) => ({ ...prev, timeSlots: newTimeSlots }));
    };

    const addEditRole = (timeSlotIndex: number) => {
        const newTimeSlots = [...currentPost.timeSlots];
        newTimeSlots[timeSlotIndex].roles.push({ name: 'dealer', count: 1 });
        setCurrentPost((prev: any) => ({ ...prev, timeSlots: newTimeSlots }));
    };

    const removeEditRole = (timeSlotIndex: number, roleIndex: number) => {
        const newTimeSlots = [...currentPost.timeSlots];
        newTimeSlots[timeSlotIndex].roles = newTimeSlots[timeSlotIndex].roles.filter((_: any, i: number) => i !== roleIndex);
        setCurrentPost((prev: any) => ({ ...prev, timeSlots: newTimeSlots }));
    };
    
    // 편집 모달 일자별 요구사항 관리 함수들
    const handleEditDifferentDailyRequirementsToggle = (enabled: boolean) => {
    if (enabled) {
      // 기존 timeSlots를 날짜 범위에 맞게 복사하여 dateSpecificRequirements 생성
      const dates = generateDateRange(currentPost.startDate, currentPost.endDate);
      const dateSpecificRequirements = dates.map(date => ({
        date,
        timeSlots: currentPost.timeSlots.map((ts: TimeSlot) => ({ ...ts, date }))
      }));
      
      setCurrentPost((prev: any) => ({
        ...prev,
        usesDifferentDailyRequirements: true,
        dateSpecificRequirements
      }));
    } else {
      // 일자별 요구사항을 기본 timeSlots로 변환
      const timeSlots = currentPost.dateSpecificRequirements && currentPost.dateSpecificRequirements.length > 0
        ? currentPost.dateSpecificRequirements[0].timeSlots.map((ts: any) => ({ time: ts.time, roles: ts.roles }))
        : currentPost.timeSlots;
      
      setCurrentPost((prev: any) => ({
        ...prev,
        usesDifferentDailyRequirements: false,
        dateSpecificRequirements: [],
        timeSlots
      }));
    }
    };
    
    const handleEditDateSpecificTimeSlotChange = (dateIndex: number, timeSlotIndex: number, value: string) => {
    const newDateSpecificRequirements = [...currentPost.dateSpecificRequirements];
    newDateSpecificRequirements[dateIndex].timeSlots[timeSlotIndex].time = value;
    setCurrentPost((prev: any) => ({ ...prev, dateSpecificRequirements: newDateSpecificRequirements }));
    };
    
    const handleEditDateSpecificRoleChange = (
    dateIndex: number, 
    timeSlotIndex: number, 
    roleIndex: number, 
    field: 'name' | 'count', 
    value: string | number
    ) => {
    const newDateSpecificRequirements = [...currentPost.dateSpecificRequirements];
    const roleValue = field === 'count' ? (Number(value) < 1 ? 1 : Number(value)) : value;
    newDateSpecificRequirements[dateIndex].timeSlots[timeSlotIndex].roles[roleIndex] = {
      ...newDateSpecificRequirements[dateIndex].timeSlots[timeSlotIndex].roles[roleIndex],
      [field]: roleValue
    };
    setCurrentPost((prev: any) => ({ ...prev, dateSpecificRequirements: newDateSpecificRequirements }));
    };
    
    const addEditDateSpecificTimeSlot = (dateIndex: number) => {
    const newDateSpecificRequirements = [...currentPost.dateSpecificRequirements];
    newDateSpecificRequirements[dateIndex].timeSlots.push({
      time: '',
      roles: [{ name: 'dealer', count: 1 }],
      date: newDateSpecificRequirements[dateIndex].date
    });
    setCurrentPost((prev: any) => ({ ...prev, dateSpecificRequirements: newDateSpecificRequirements }));
    };
    
    const removeEditDateSpecificTimeSlot = (dateIndex: number, timeSlotIndex: number) => {
    const newDateSpecificRequirements = [...currentPost.dateSpecificRequirements];
    newDateSpecificRequirements[dateIndex].timeSlots = newDateSpecificRequirements[dateIndex].timeSlots.filter((_: any, i: number) => i !== timeSlotIndex);
    setCurrentPost((prev: any) => ({ ...prev, dateSpecificRequirements: newDateSpecificRequirements }));
    };
    
    const addEditDateSpecificRole = (dateIndex: number, timeSlotIndex: number) => {
    const newDateSpecificRequirements = [...currentPost.dateSpecificRequirements];
    newDateSpecificRequirements[dateIndex].timeSlots[timeSlotIndex].roles.push({ name: 'dealer', count: 1 });
    setCurrentPost((prev: any) => ({ ...prev, dateSpecificRequirements: newDateSpecificRequirements }));
    };
    
    const removeEditDateSpecificRole = (dateIndex: number, timeSlotIndex: number, roleIndex: number) => {
    const newDateSpecificRequirements = [...currentPost.dateSpecificRequirements];
    newDateSpecificRequirements[dateIndex].timeSlots[timeSlotIndex].roles = 
      newDateSpecificRequirements[dateIndex].timeSlots[timeSlotIndex].roles.filter((_: any, i: number) => i !== roleIndex);
    setCurrentPost((prev: any) => ({ ...prev, dateSpecificRequirements: newDateSpecificRequirements }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 일자별 요구사항 사용 여부에 따른 유효성 검사
    if (formData.usesDifferentDailyRequirements) {
      // 일자별 요구사항 검사
      if (formData.dateSpecificRequirements.some(dateReq => 
        dateReq.timeSlots.some(ts => !ts.time || ts.roles.some(r => !r.name || r.count < 1))
      )) {
        alert(t('jobPostingAdmin.alerts.invalidRoleInfo'));
        return;
      }
    } else {
      // 기존 timeSlots 검사
      if (formData.timeSlots.some(ts => !ts.time || ts.roles.some(r => !r.name || r.count < 1))) {
        alert(t('jobPostingAdmin.alerts.invalidRoleInfo'));
        return;
      }
    }
    
    if (!currentUser) {
        alert(t('jobPostingAdmin.alerts.notLoggedIn'));
        return;
    }
    
    setIsSubmitting(true);
    try {
      // JobPostingUtils를 사용하여 필요한 역할들 추출
      let requiredRoles: string[];
      
      if (formData.usesDifferentDailyRequirements) {
        // 일자별 요구사항에서 역할 추출
        const roleSet = new Set<string>();
        formData.dateSpecificRequirements.forEach(dateReq => {
          dateReq.timeSlots.forEach(ts => {
            ts.roles.forEach(role => roleSet.add(role.name));
          });
        });
        requiredRoles = Array.from(roleSet);
      } else {
        // 기존 timeSlots에서 역할 추출
        requiredRoles = Array.from(new Set(
          formData.timeSlots.flatMap(ts => ts.roles.map(r => r.name))
        ));
      }
      
      // 검색 인덱스 생성
      const searchIndex = [
        formData.title,
        formData.location,
        formData.description,
        ...requiredRoles
      ].join(' ').toLowerCase().split(/\s+/).filter(word => word.length > 0);
      
      // Firebase에 저장할 데이터 준비
      const jobPostingData: any = {
        title: formData.title,
        type: formData.type,
        description: formData.description,
        status: formData.status,
        location: formData.location,
        startDate: Timestamp.fromDate(new Date(formData.startDate)),
        endDate: Timestamp.fromDate(new Date(formData.endDate)),
        requiredRoles,
        searchIndex,
        managerId: currentUser.uid,
        createdAt: serverTimestamp(),
        confirmedStaff: [],
      };
      
      // 일자별 요구사항 사용 여부에 따라 데이터 추가
      if (formData.usesDifferentDailyRequirements) {
        jobPostingData.dateSpecificRequirements = formData.dateSpecificRequirements;
        // 호환성을 위해 기본 timeSlots도 저장 (첫 번째 날짜의 timeSlots를 변환)
        jobPostingData.timeSlots = JobPostingUtils.convertToLegacyTimeSlots(formData.dateSpecificRequirements);
      } else {
        jobPostingData.timeSlots = formData.timeSlots;
      }
      
      await addDoc(collection(db, 'jobPostings'), jobPostingData);
      alert(t('jobPostingAdmin.alerts.createSuccess'));
      
      // 폼 데이터 초기화
      setFormData({
        title: '',
        type: 'application',
        timeSlots: [initialTimeSlot],
        dateSpecificRequirements: [],
        usesDifferentDailyRequirements: false,
        description: '',
        status: 'open',
        location: '서울',
        startDate: getTodayString(),
        endDate: getTodayString(),
      });
    } catch (error) {
      console.error("Error creating job posting: ", error);
      alert(t('jobPostingAdmin.alerts.createFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };
  

  const handleAutoMatch = async (jobPostingId: string) => {
    // This function will need significant updates for the new data structure.
    alert("자동 매칭 기능은 새로운 시간대별 인원 구조에 맞게 업데이트가 필요합니다.");
  };

  const handleOpenEditModal = (post: any) => {
    setCurrentPost({
        ...post,
        timeSlots: post.timeSlots && post.timeSlots.length > 0 ? post.timeSlots : [initialTimeSlot],
        startDate: convertToDateString(post.startDate),
        endDate: convertToDateString(post.endDate),
        usesDifferentDailyRequirements: JobPostingUtils.hasDateSpecificRequirements(post),
        dateSpecificRequirements: post.dateSpecificRequirements || [],
    });
    setIsEditModalOpen(true);
  };

  const handleUpdatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPost) return;
    if (currentPost.timeSlots.some((ts: TimeSlot) => !ts.time || ts.roles.some(r => !r.name || r.count < 1))) {
      alert(t('jobPostingAdmin.alerts.invalidRoleInfo'));
      return;
    }
    
    const postRef = doc(db, 'jobPostings', currentPost.id);
    try {
      // Extract unique roles from timeSlots for filtering
      const requiredRoles = Array.from(new Set(
        currentPost.timeSlots.flatMap((ts: TimeSlot) => ts.roles.map(r => r.name))
      ));
      
      // Create search index for text search
      const searchIndex = [
        currentPost.title,
        currentPost.location,
        currentPost.description,
        ...requiredRoles
      ].join(' ').toLowerCase().split(/\s+/).filter(word => word.length > 0);
      
      const { id, ...postData } = currentPost;
      await updateDoc(postRef, {
        ...postData,
        startDate: convertToTimestamp(currentPost.startDate), // Safe conversion to Timestamp
        endDate: convertToTimestamp(currentPost.endDate), // Safe conversion to Timestamp
        requiredRoles, // Add for role filtering
        searchIndex // Add for text search
      });
      alert(t('jobPostingAdmin.alerts.updateSuccess'));
      setIsEditModalOpen(false);
      setCurrentPost(null);
    } catch (error) {
      console.error("Error updating job posting: ", error);
      alert(t('jobPostingAdmin.alerts.updateFailed'));
    }
  };
  
  const handleDelete = async (postId: string) => {
    const confirmMessage = `${t('jobPostingAdmin.alerts.confirmDelete')}\n\n⚠️ 주의사항:\n• 해당 공고의 모든 지원 내역이 함께 삭제됩니다\n• 삭제된 데이터는 복구할 수 없습니다\n• 확정된 지원자가 있다면 별도로 알림을 주세요`;
    
    if (window.confirm(confirmMessage)) {
        try {
            // 1. 해당 공고에 대한 모든 applications 찾기
            const applicationsQuery = query(
                collection(db, 'applications'), 
                where('postId', '==', postId)
            );
            const applicationsSnapshot = await getDocs(applicationsQuery);
            
            // 2. 모든 applications 삭제
            const deleteApplicationPromises = applicationsSnapshot.docs.map(applicationDoc => 
                deleteDoc(doc(db, 'applications', applicationDoc.id))
            );
            
            // 3. 모든 applications 삭제 완료 대기
            await Promise.all(deleteApplicationPromises);
            
            // 4. jobPosting 삭제
            await deleteDoc(doc(db, 'jobPostings', postId));
            
            alert(`${t('jobPostingAdmin.alerts.deleteSuccess')}\n\n삭제된 데이터:\n• 공고: 1건\n• 지원 내역: ${applicationsSnapshot.docs.length}건`);
            setIsEditModalOpen(false);
        } catch (error) {
            console.error("Error deleting job posting and related applications: ", error);
            alert(`${t('jobPostingAdmin.alerts.deleteFailed')}\n\n오류 상세:\n${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        }
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">{t('jobPostingAdmin.create.title')}</h1>
          {!isCreateFormVisible && (
            <button 
              onClick={() => setIsCreateFormVisible(true)}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              {t('jobPostingAdmin.create.button')}
            </button>
          )}
        </div>
        {isCreateFormVisible && (
          <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow-md">
            {/* Form fields */}
            <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700">{t('jobPostingAdmin.create.postingTitle')}</label>
                <input type="text" name="title" id="title" value={formData.title} onChange={handleFormChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
            </div>
            
            <div>
                <label htmlFor="type" className="block text-sm font-medium text-gray-700">{t('jobPostingAdmin.create.type')}</label>
                <select name="type" id="type" value={formData.type} onChange={handleFormChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                    <option value="application">{t('jobPostingAdmin.create.typeApplication')}</option>
                    <option value="fixed">{t('jobPostingAdmin.create.typeFixed')}</option>
                </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="location" className="block text-sm font-medium text-gray-700">{t('jobPostingAdmin.create.location')}</label>
                    <select name="location" id="location" value={formData.location} onChange={handleFormChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                        {locations.map(loc => <option key={loc} value={loc}>{t(`locations.${loc}`, loc)}</option>)}
                    </select>
                </div>
            </div>
  
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <DateDropdownSelector
                        value={dateStringToDropdownValue(formData.startDate)}
                        onChange={(value) => setFormData(prev => ({ ...prev, startDate: dropdownValueToDateString(value) }))}
                        label={t('jobPostingAdmin.create.startDate')}
                        className="mt-1"
                    />
                </div>
                <div>
                    <DateDropdownSelector
                        value={dateStringToDropdownValue(formData.endDate)}
                        onChange={(value) => setFormData(prev => ({ ...prev, endDate: dropdownValueToDateString(value) }))}
                        label={t('jobPostingAdmin.create.endDate')}
                        className="mt-1"
                    />
                </div>
            </div>
  
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">{t('jobPostingAdmin.create.timeAndRoles')}</label>
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="usesDifferentDailyRequirements"
                            checked={formData.usesDifferentDailyRequirements}
                            onChange={(e) => handleDifferentDailyRequirementsToggle(e.target.checked)}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <label htmlFor="usesDifferentDailyRequirements" className="ml-2 text-sm text-gray-700">
                            일자별 다른 인원 요구사항
                        </label>
                    </div>
                </div>
                
                {!formData.usesDifferentDailyRequirements ? (
                    // 기존 방식: 전체 기간 공통 timeSlots
                    <>
                        {formData.timeSlots.map((timeSlot, tsIndex) => (
                            <div key={tsIndex} className="p-4 border border-gray-200 rounded-md">
                                <div className="flex items-center space-x-2 mb-4">
                                    <label htmlFor={`time-slot-${tsIndex}`} className="block text-sm font-medium text-gray-700">{t('jobPostingAdmin.create.time')}</label>
                                    <input
                                        type="time"
                                        id={`time-slot-${tsIndex}`}
                                        value={timeSlot.time}
                                        onChange={(e) => handleTimeSlotChange(tsIndex, e.target.value)}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                                        required
                                    />
                                    {formData.timeSlots.length > 1 && (
                                        <button type="button" onClick={() => removeTimeSlot(tsIndex)} className="text-red-600 hover:text-red-800">
                                            {t('jobPostingAdmin.create.removeTimeSlot')}
                                        </button>
                                    )}
                                </div>
                                {timeSlot.roles.map((role, rIndex) => (
                                    <div key={rIndex} className="flex items-center space-x-2 mb-2">
                                        <div className="flex-1">
                                            <select 
                                                value={role.name} 
                                                onChange={(e) => handleRoleChange(tsIndex, rIndex, 'name', e.target.value)}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required
                                            >
                                                <option value="" disabled>{t('jobPostingAdmin.create.roleNamePlaceholder')}</option>
                                                {predefinedRoles.map(r => <option key={r} value={r}>{t(`jobPostingAdmin.create.${r}`)}</option>)}
                                            </select>
                                        </div>
                                        <div className="w-24">
                                            <input type="number" value={role.count} min="1" onChange={(e) => handleRoleChange(tsIndex, rIndex, 'count', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
                                        </div>
                                        {timeSlot.roles.length > 1 && (
                                            <button type="button" onClick={() => removeRole(tsIndex, rIndex)} className="text-red-600 hover:text-red-800 text-sm">{t('jobPostingAdmin.create.remove')}</button>
                                        )}
                                    </div>
                                ))}
                                <button type="button" onClick={() => addRole(tsIndex)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                                    + {t('jobPostingAdmin.create.addRole')}
                                </button>
                            </div>
                        ))}
                        <button type="button" onClick={addTimeSlot} className="text-indigo-600 hover:text-indigo-800 font-medium">
                            + {t('jobPostingAdmin.create.addTimeSlot')}
                        </button>
                    </>
                ) : (
                    // 일자별 요구사항 방식
                    <div className="space-y-4">
                        {formData.dateSpecificRequirements.map((dateReq, dateIndex) => (
                            <div key={dateReq.date} className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                                <h4 className="text-lg font-semibold mb-3 text-blue-800">
                                    {new Date(dateReq.date).toLocaleDateString('ko-KR', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        weekday: 'short'
                                    })}
                                </h4>
                                
                                {dateReq.timeSlots.map((timeSlot, tsIndex) => (
                                    <div key={tsIndex} className="p-3 border border-gray-200 rounded-md bg-white mb-3">
                                        <div className="flex items-center space-x-2 mb-3">
                                            <label className="block text-sm font-medium text-gray-700">{t('jobPostingAdmin.create.time')}</label>
                                            <input
                                                type="time"
                                                value={timeSlot.time}
                                                onChange={(e) => handleDateSpecificTimeSlotChange(dateIndex, tsIndex, e.target.value)}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                                                required
                                            />
                                            {dateReq.timeSlots.length > 1 && (
                                                <button 
                                                    type="button" 
                                                    onClick={() => removeDateSpecificTimeSlot(dateIndex, tsIndex)} 
                                                    className="text-red-600 hover:text-red-800 text-sm"
                                                >
                                                    {t('jobPostingAdmin.create.removeTimeSlot')}
                                                </button>
                                            )}
                                        </div>
                                        
                                        {timeSlot.roles.map((role, rIndex) => (
                                            <div key={rIndex} className="flex items-center space-x-2 mb-2">
                                                <div className="flex-1">
                                                    <select 
                                                        value={role.name} 
                                                        onChange={(e) => handleDateSpecificRoleChange(dateIndex, tsIndex, rIndex, 'name', e.target.value)}
                                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" 
                                                        required
                                                    >
                                                        <option value="" disabled>{t('jobPostingAdmin.create.roleNamePlaceholder')}</option>
                                                        {predefinedRoles.map(r => <option key={r} value={r}>{t(`jobPostingAdmin.create.${r}`)}</option>)}
                                                    </select>
                                                </div>
                                                <div className="w-24">
                                                    <input 
                                                        type="number" 
                                                        value={role.count} 
                                                        min="1" 
                                                        onChange={(e) => handleDateSpecificRoleChange(dateIndex, tsIndex, rIndex, 'count', e.target.value)} 
                                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" 
                                                        required 
                                                    />
                                                </div>
                                                {timeSlot.roles.length > 1 && (
                                                    <button 
                                                        type="button" 
                                                        onClick={() => removeDateSpecificRole(dateIndex, tsIndex, rIndex)} 
                                                        className="text-red-600 hover:text-red-800 text-sm"
                                                    >
                                                        {t('jobPostingAdmin.create.remove')}
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        
                                        <button 
                                            type="button" 
                                            onClick={() => addDateSpecificRole(dateIndex, tsIndex)} 
                                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                        >
                                            + {t('jobPostingAdmin.create.addRole')}
                                        </button>
                                    </div>
                                ))}
                                
                                <button 
                                    type="button" 
                                    onClick={() => addDateSpecificTimeSlot(dateIndex)} 
                                    className="text-indigo-600 hover:text-indigo-800 font-medium"
                                >
                                    + {t('jobPostingAdmin.create.addTimeSlot')}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
  
            <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">{t('jobPostingAdmin.create.description')}</label>
                <textarea name="description" id="description" value={formData.description} onChange={handleFormChange} rows={4} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
            </div>
            <div className="flex justify-end space-x-2">
              <button type="button" onClick={() => setIsCreateFormVisible(false)} className="py-2 px-4 bg-gray-500 text-white rounded hover:bg-gray-700">
                  {t('jobPostingAdmin.edit.cancel')}
              </button>
              <button type="submit" disabled={isSubmitting} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400">
                  {isSubmitting ? t('jobPostingAdmin.create.submitting') : t('jobPostingAdmin.create.button')}
              </button>
            </div>
          </form>
        )}
      </div>
      
      <div>
        <h1 className="text-2xl font-bold mb-4">{t('jobPostingAdmin.manage.title')}</h1>
        <div className="space-y-4">
            {loading && <div className="flex justify-center"><LoadingSpinner /></div>}
            {jobPostings?.map((post: any) => {
                const formattedStartDate = formatDate(post.startDate);
                const formattedEndDate = formatDate(post.endDate);

                return (
                    <div key={post.id} className="bg-white p-6 rounded-lg shadow-md">
                        <div className="flex justify-between items-start">
                            <div className="flex-grow">
                                <div className="flex items-center mb-2">
                                    <h2 className="text-xl font-bold mr-4">{post.title}</h2>
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${post.status === 'open' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {post.status}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-500 mb-1">
                                    {t('jobPostingAdmin.manage.location')}: {String(t(`locations.${post.location}`, post.location))}
                                </p>
                                <p className="text-sm text-gray-500 mb-1">
                                    {t('jobPostingAdmin.manage.date')}: {post.endDate && post.endDate !== post.startDate ? `${formattedStartDate} ~ ${formattedEndDate}` : formattedStartDate}
                                </p>
                                {/* 시간대 및 역할 표시 - 일자별 다른 인원 요구사항 고려 */}
                                {JobPostingUtils.hasDateSpecificRequirements(post) ? (
                                    /* 일자별 다른 인원 요구사항이 있는 경우 */
                                    <div className="mt-2">
                                        <p className="text-sm font-medium text-blue-600 mb-2">📅 일자별 다른 인원 요구사항</p>
                                        {post.dateSpecificRequirements?.map((dateReq: DateSpecificRequirement, dateIndex: number) => (
                                            <div key={dateIndex} className="mt-3 pl-4 border-l-2 border-blue-300 bg-blue-50 rounded-r p-2">
                                                <div className="text-sm font-medium text-blue-800 mb-2">
                                                    📅 {formatDate(dateReq.date)} 일정
                                                </div>
                                                {dateReq.timeSlots.map((ts: TimeSlot, tsIndex: number) => (
                                                    <div key={`${dateIndex}-${tsIndex}`} className="mt-1 pl-3 border-l border-blue-200 bg-white rounded-r p-1">
                                                        <p className="text-sm font-semibold text-gray-700">{t('jobPostingAdmin.manage.time')}: {ts.time}</p>
                                                        <div className="text-sm text-gray-600">
                                                            {ts.roles.map((r: RoleRequirement, i: number) => (
                                                                <span key={i} className="mr-4">{t(`jobPostingAdmin.create.${r.name}`, r.name)}: {r.count}{t('jobPostingAdmin.manage.people')}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    /* 기존 방식: 전체 기간 공통 timeSlots */
                                    post.timeSlots?.map((ts: TimeSlot, index: number) => (
                                        <div key={index} className="mt-2 pl-4 border-l-2 border-gray-200">
                                            <p className="text-sm font-semibold text-gray-700">{t('jobPostingAdmin.manage.time')}: {ts.time}</p>
                                            <div className="text-sm text-gray-600">
                                                {ts.roles.map((r: RoleRequirement, i: number) => (
                                                    <span key={i} className="mr-4">{t(`jobPostingAdmin.create.${r.name}`, r.name)}: {r.count}{t('jobPostingAdmin.manage.people')}</span>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                )}
                                <p className="text-sm text-gray-500 mt-2">
                                    {t('jobPostingAdmin.create.description')}: {post.description}
                                </p>
                            </div>
                            <div className='flex flex-col items-end'>
                                <div className="flex mb-2">
                                    <button
                                        onClick={() => handleNavigateToDetail(post.id)}
                                        className="mr-2 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                                    >
                                        {t('jobPostingAdmin.manage.detailManagement', '상세 관리')}
                                    </button>
                                    <button
                                        onClick={() => handleOpenEditModal(post)}
                                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700"
                                    >
                                        {t('jobPostingAdmin.manage.edit')}
                                    </button>
                                </div>
                                <button 
                                    onClick={() => handleAutoMatch(post.id)}
                                    disabled={post.status !== 'open' || isMatching === post.id}
                                    className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400"
                                >
                                    {isMatching === post.id ? t('jobPostingAdmin.manage.matching') : t('jobPostingAdmin.manage.button')}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
      </div>
  
        {isEditModalOpen && currentPost && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-medium leading-6 text-gray-900">{t('jobPostingAdmin.edit.title')}</h3>
                        <Link 
                            to={`/admin/job-posting/${currentPost.id}`}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                            상세 관리 페이지로 이동 →
                        </Link>
                    </div>
                    <form onSubmit={handleUpdatePost} className="space-y-4">
                         <div>
                            <label htmlFor="edit-title" className="block text-sm font-medium text-gray-700">{t('jobPostingAdmin.edit.postingTitle')}</label>
                            <input type="text" id="edit-title" value={currentPost.title} onChange={(e) => setCurrentPost({...currentPost, title: e.target.value})} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                        </div>
                        <div>
                            <label htmlFor="edit-type" className="block text-sm font-medium text-gray-700">{t('jobPostingAdmin.edit.type')}</label>
                            <select id="edit-type" name="type" value={currentPost.type} onChange={(e) => setCurrentPost({...currentPost, type: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                                <option value="application">{t('jobPostingAdmin.edit.typeApplication')}</option>
                                <option value="fixed">{t('jobPostingAdmin.edit.typeFixed')}</option>
                            </select>
                            </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div>
                                <label htmlFor="edit-location" className="block text-sm font-medium text-gray-700">{t('jobPostingAdmin.edit.location')}</label>
                                <select id="edit-location" name="location" value={currentPost.location} onChange={(e) => setCurrentPost({...currentPost, location: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                                    {locations.map(loc => <option key={loc} value={loc}>{t(`locations.${loc}`, loc)}</option>)}
                                </select>
                            </div>
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                <DateDropdownSelector
                                    value={dateStringToDropdownValue(currentPost.startDate)}
                                    onChange={(value) => setCurrentPost({...currentPost, startDate: dropdownValueToDateString(value)})}
                                    label={t('jobPostingAdmin.edit.startDate')}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <DateDropdownSelector
                                    value={dateStringToDropdownValue(currentPost.endDate)}
                                    onChange={(value) => setCurrentPost({...currentPost, endDate: dropdownValueToDateString(value)})}
                                    label={t('jobPostingAdmin.edit.endDate')}
                                    className="mt-1"
                                />
                            </div>
                        </div>
                        
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <label className="block text-sm font-medium text-gray-700">{t('jobPostingAdmin.edit.timeAndRoles')}</label>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="edit-usesDifferentDailyRequirements"
                                        checked={currentPost.usesDifferentDailyRequirements || false}
                                        onChange={(e) => handleEditDifferentDailyRequirementsToggle(e.target.checked)}
                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor="edit-usesDifferentDailyRequirements" className="ml-2 text-sm text-gray-700">
                                        일자별 다른 인원 요구사항
                                    </label>
                                </div>
                            </div>
                            
                            {!currentPost.usesDifferentDailyRequirements ? (
                                // 기존 방식: 전체 기간 공통 timeSlots
                                <>
                            {currentPost.timeSlots.map((timeSlot: TimeSlot, tsIndex: number) => (
                                <div key={tsIndex} className="p-4 border border-gray-200 rounded-md">
                                    <div className="flex items-center space-x-2 mb-4">
                                        <label htmlFor={`edit-time-slot-${tsIndex}`} className="block text-sm font-medium text-gray-700">{t('jobPostingAdmin.edit.time')}</label>
                                        <input
                                            type="time"
                                            id={`edit-time-slot-${tsIndex}`}
                                            value={timeSlot.time}
                                            onChange={(e) => handleEditTimeSlotChange(tsIndex, e.target.value)}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                                            required
                                        />
                                        {currentPost.timeSlots.length > 1 && (
                                            <button type="button" onClick={() => removeEditTimeSlot(tsIndex)} className="text-red-600 hover:text-red-800">
                                                {t('jobPostingAdmin.edit.removeTimeSlot')}
                                            </button>
                                        )}
                                    </div>
                                    {timeSlot.roles.map((role: RoleRequirement, rIndex: number) => (
                                        <div key={rIndex} className="flex items-center space-x-2 mb-2">
                                            <div className="flex-1">
                                                <select 
                                                    value={role.name} 
                                                    onChange={(e) => handleEditRoleChange(tsIndex, rIndex, 'name', e.target.value)} 
                                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required
                                                >
                                                    {predefinedRoles.map(r => <option key={r} value={r}>{t(`jobPostingAdmin.edit.${r}`)}</option>)}
                                                </select>
                                            </div>
                                            <div className="w-24">
                                                <input type="number" value={role.count} min="1" onChange={(e) => handleEditRoleChange(tsIndex, rIndex, 'count', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
                                            </div>
                                            {timeSlot.roles.length > 1 && (
                                                <button type="button" onClick={() => removeEditRole(tsIndex, rIndex)} className="text-red-600 hover:text-red-800 text-sm">{t('jobPostingAdmin.edit.remove')}</button>
                                            )}
                                        </div>
                                    ))}
                                    <button type="button" onClick={() => addEditRole(tsIndex)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                                        + {t('jobPostingAdmin.edit.addRole')}
                                    </button>
                                </div>
                            ))}
                            <button type="button" onClick={addEditTimeSlot} className="text-indigo-600 hover:text-indigo-800 font-medium">
                                + {t('jobPostingAdmin.edit.addTimeSlot')}
                            </button>
                                </>
                            ) : (
                                // 일자별 요구사항 방식
                                <div className="space-y-4">
                                    {currentPost.dateSpecificRequirements?.map((dateReq: any, dateIndex: number) => (
                                        <div key={dateReq.date} className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                                            <h4 className="text-lg font-semibold mb-3 text-blue-800">
                                                {new Date(dateReq.date).toLocaleDateString('ko-KR', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric',
                                                    weekday: 'short'
                                                })}
                                            </h4>
                                            
                                            {dateReq.timeSlots.map((timeSlot: any, tsIndex: number) => (
                                                <div key={tsIndex} className="p-3 border border-gray-200 rounded-md bg-white mb-3">
                                                    <div className="flex items-center space-x-2 mb-3">
                                                        <label className="block text-sm font-medium text-gray-700">{t('jobPostingAdmin.edit.time')}</label>
                                                        <input
                                                            type="time"
                                                            value={timeSlot.time}
                                                            onChange={(e) => handleEditDateSpecificTimeSlotChange(dateIndex, tsIndex, e.target.value)}
                                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                                                            required
                                                        />
                                                        {dateReq.timeSlots.length > 1 && (
                                                            <button 
                                                                type="button" 
                                                                onClick={() => removeEditDateSpecificTimeSlot(dateIndex, tsIndex)} 
                                                                className="text-red-600 hover:text-red-800 text-sm"
                                                            >
                                                                {t('jobPostingAdmin.edit.removeTimeSlot')}
                                                            </button>
                                                        )}
                                                    </div>
                                                    
                                                    {timeSlot.roles.map((role: any, rIndex: number) => (
                                                        <div key={rIndex} className="flex items-center space-x-2 mb-2">
                                                            <div className="flex-1">
                                                                <select 
                                                                    value={role.name} 
                                                                    onChange={(e) => handleEditDateSpecificRoleChange(dateIndex, tsIndex, rIndex, 'name', e.target.value)}
                                                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" 
                                                                    required
                                                                >
                                                                    <option value="" disabled>{t('jobPostingAdmin.edit.roleNamePlaceholder', '역할 선택')}</option>
                                                                    {predefinedRoles.map(r => <option key={r} value={r}>{t(`jobPostingAdmin.edit.${r}`)}</option>)}
                                                                </select>
                                                            </div>
                                                            <div className="w-24">
                                                                <input 
                                                                    type="number" 
                                                                    value={role.count} 
                                                                    min="1" 
                                                                    onChange={(e) => handleEditDateSpecificRoleChange(dateIndex, tsIndex, rIndex, 'count', e.target.value)} 
                                                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" 
                                                                    required 
                                                                />
                                                            </div>
                                                            {timeSlot.roles.length > 1 && (
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => removeEditDateSpecificRole(dateIndex, tsIndex, rIndex)} 
                                                                    className="text-red-600 hover:text-red-800 text-sm"
                                                                >
                                                                    {t('jobPostingAdmin.edit.remove')}
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                    
                                                    <button 
                                                        type="button" 
                                                        onClick={() => addEditDateSpecificRole(dateIndex, tsIndex)} 
                                                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                                    >
                                                        + {t('jobPostingAdmin.edit.addRole')}
                                                    </button>
                                                </div>
                                            ))}
                                            
                                            <button 
                                                type="button" 
                                                onClick={() => addEditDateSpecificTimeSlot(dateIndex)} 
                                                className="text-indigo-600 hover:text-indigo-800 font-medium"
                                            >
                                                + {t('jobPostingAdmin.edit.addTimeSlot')}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            </div>
                        
                        <div>
                            <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700">{t('jobPostingAdmin.edit.description')}</label>
                            <textarea id="edit-description" value={currentPost.description} onChange={(e) => setCurrentPost({...currentPost, description: e.target.value})} rows={4} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                        </div>
                        <div>
                            <label htmlFor="edit-status" className="block text-sm font-medium text-gray-700">{t('jobPostingAdmin.edit.status')}</label>
                            <select id="edit-status" value={currentPost.status} onChange={(e) => setCurrentPost({...currentPost, status: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                                <option value="open">{t('jobPostingAdmin.edit.statusOpen')}</option>
                                <option value="closed">{t('jobPostingAdmin.edit.statusClosed')}</option>
                            </select>
                        </div>
                        <div className="flex justify-end space-x-2">
                            <button type="button" onClick={() => setIsEditModalOpen(false)} className="py-2 px-4 bg-gray-500 text-white rounded hover:bg-gray-700">{t('jobPostingAdmin.edit.cancel')}</button>
                            <button type="button" onClick={() => handleDelete(currentPost.id)} className="py-2 px-4 bg-red-600 text-white rounded hover:bg-red-700">
                                {t('jobPostingAdmin.manage.delete')}
                            </button>
                            <button type="submit" className="py-2 px-4 bg-indigo-600 text-white rounded hover:bg-indigo-700">{t('jobPostingAdmin.edit.save')}</button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};

export default JobPostingAdminPage;