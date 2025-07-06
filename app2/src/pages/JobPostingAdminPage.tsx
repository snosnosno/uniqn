import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, query, doc, updateDoc, where, getDocs, deleteDoc, arrayUnion, runTransaction, getDoc, Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, promoteToStaff } from '../firebase';
import { useCollection } from 'react-firebase-hooks/firestore';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import DateDropdownSelector from '../components/DateDropdownSelector';

// Import centralized type definitions
import { 
  RoleRequirement, 
  TimeSlot, 
  ConfirmedStaff,
  JobPostingUtils 
} from '../types/jobPosting';

interface Applicant {
    id: string;
    applicantName: string;
    applicantId: string;
    status: 'applied' | 'confirmed' | 'rejected';
    assignedRole?: string;
    assignedTime?: string;
    appliedAt: any;
    // 추가된 사용자 정보
    gender?: string;
    age?: number;
    experience?: string;
}
const JobPostingAdminPage = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const jobPostingsQuery = useMemo(() => query(collection(db, 'jobPostings')), []);
  const [jobPostingsSnap, loading] = useCollection(jobPostingsQuery);
  const jobPostings = useMemo(() => jobPostingsSnap?.docs.map(d => ({ id: d.id, ...d.data() })), [jobPostingsSnap]);
  
  const getTodayString = () => new Date().toISOString().split('T')[0];
  
  const initialTimeSlot = { time: '09:00', roles: [{ name: 'dealer', count: 1 }] };
  const [formData, setFormData] = useState({
    title: '',
    type: 'application', // 모집 유형: 'application'(지원) 또는 'fixed'(고정)
    timeSlots: [initialTimeSlot],
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
  const [isApplicantsModalOpen, setIsApplicantsModalOpen] = useState(false);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [isCreateFormVisible, setIsCreateFormVisible] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<{ [key: string]: { timeSlot: string, role: string } }>({});


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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
     if (formData.timeSlots.some(ts => !ts.time || ts.roles.some(r => !r.name || r.count < 1))) {
      alert(t('jobPostingAdmin.alerts.invalidRoleInfo'));
      return;
    }
    if (!currentUser) {
        alert(t('jobPostingAdmin.alerts.notLoggedIn'));
        return;
    }
    setIsSubmitting(true);
    try {
      // Extract unique roles from timeSlots for filtering
      const requiredRoles = Array.from(new Set(
        formData.timeSlots.flatMap(ts => ts.roles.map(r => r.name))
      ));
      
      // Create search index for text search
      const searchIndex = [
        formData.title,
        formData.location,
        formData.description,
        ...requiredRoles
      ].join(' ').toLowerCase().split(/\s+/).filter(word => word.length > 0);
      
      await addDoc(collection(db, 'jobPostings'), {
        ...formData,
        startDate: Timestamp.fromDate(new Date(formData.startDate)), // Convert to Timestamp
        endDate: Timestamp.fromDate(new Date(formData.endDate)), // Convert to Timestamp
        requiredRoles, // Add for role filtering
        searchIndex, // Add for text search
        managerId: currentUser.uid, // Add managerId
        createdAt: serverTimestamp(),
        confirmedStaff: [],
      });
      alert(t('jobPostingAdmin.alerts.createSuccess'));
      setFormData({
        title: '',
        type: 'application',
        timeSlots: [initialTimeSlot],
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
    if (window.confirm(t('jobPostingAdmin.alerts.confirmDelete'))) {
        try {
            await deleteDoc(doc(db, 'jobPostings', postId));
            alert(t('jobPostingAdmin.alerts.deleteSuccess'));
            setIsEditModalOpen(false);
        } catch (error) {
            console.error("Error deleting job posting: ", error);
            alert(t('jobPostingAdmin.alerts.deleteFailed'));
        }
    }
  };

  const handleViewApplicants = async (postId: string) => {
    setCurrentPost(jobPostings?.find(p => p.id === postId) || null);
    setLoadingApplicants(true);
    setIsApplicantsModalOpen(true);
    try {
        const q = query(collection(db, 'applications'), where('postId', '==', postId));
        const querySnapshot = await getDocs(q);
        const fetchedApplicants = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Applicant));
        
        // 사용자 정보를 추가로 가져오기
        const applicantsWithUserInfo = await Promise.all(
            fetchedApplicants.map(async (applicant) => {
                try {
                    const userDoc = await getDoc(doc(db, 'users', applicant.applicantId));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        return {
                            ...applicant,
                            gender: userData.gender,
                            age: userData.age,
                            experience: userData.experience
                        };
                    }
                    return applicant;
                } catch (error) {
                    console.error(`Error fetching user data for ${applicant.applicantId}:`, error);
                    return applicant;
                }
            })
        );
        
        setApplicants(applicantsWithUserInfo);
        
        const initialAssignments: { [key: string]: { timeSlot: string, role: string } } = {};
        applicantsWithUserInfo.forEach(applicant => {
            if (applicant.assignedTime && applicant.assignedRole) {
                initialAssignments[applicant.id] = { timeSlot: applicant.assignedTime, role: applicant.assignedRole };
            } else {
                 // Find first available role or default
                const firstAvailable = currentPost?.timeSlots?.[0]?.roles?.[0];
                initialAssignments[applicant.id] = { timeSlot: currentPost?.timeSlots?.[0]?.time || '', role: firstAvailable?.name || 'dealer' };
            }
        });
        setSelectedAssignment(initialAssignments);

    } catch (error) {
        console.error("Error fetching applicants: ", error);
        alert(t('jobPostingAdmin.alerts.fetchApplicantsFailed'));
    } finally {
        setLoadingApplicants(false);
    }
  };
    
  const handleConfirmApplicant = async (applicant: Applicant) => {
    const assignment = selectedAssignment[applicant.id];
    if (!assignment || !assignment.timeSlot || !assignment.role) {
        alert(t('jobPostingAdmin.alerts.selectRoleToAssign'));
        return;
    }
    if (!currentPost) return;

    const { timeSlot, role } = assignment;
    const jobPostingRef = doc(db, "jobPostings", currentPost.id);
    const applicationRef = doc(db, "applications", applicant.id);

    try {
        await runTransaction(db, async (transaction) => {
            const jobPostingDoc = await transaction.get(jobPostingRef);
            if (!jobPostingDoc.exists()) throw "Job posting does not exist!";

            const postData = jobPostingDoc.data();
            const confirmedStaff: ConfirmedStaff[] = postData.confirmedStaff || [];
            
            const isAlreadyConfirmed = confirmedStaff.some(staff => staff.userId === applicant.applicantId);
            if (isAlreadyConfirmed) {
                alert(t('jobPostingAdmin.alerts.applicantAlreadyConfirmed'));
                return;
            }
            
            const newConfirmedStaffMember = { userId: applicant.applicantId, role, timeSlot };

            transaction.update(jobPostingRef, {
                confirmedStaff: arrayUnion(newConfirmedStaffMember)
            });
            transaction.update(applicationRef, {
                status: 'confirmed',
                assignedRole: role,
                assignedTime: timeSlot,
            });
        });
        
        // 지원자를 스태프로 승격
        console.log('🔍 JobPostingAdminPage - 지원자 확정 시도:', {
            applicantId: applicant.applicantId,
            applicantName: applicant.applicantName,
            role,
            postId: currentPost.id,
            managerId: currentUser?.uid
        });
        
        if (currentUser) {
            // role 값을 적절한 JobRole 형식으로 변환
            const jobRoleMap: { [key: string]: string } = {
                'dealer': 'Dealer',
                'floor': 'Floor',
                'serving': 'Server',
                'tournament_director': 'Tournament Director',
                'chip_master': 'Chip Master', 
                'registration': 'Registration',
                'security': 'Security',
                'cashier': 'Cashier'
            };
            const jobRole = jobRoleMap[role] || role.charAt(0).toUpperCase() + role.slice(1);
            
            await promoteToStaff(
                applicant.applicantId, 
                applicant.applicantName, 
                jobRole, 
                currentPost.id, 
                currentUser.uid
            );
            console.log('✅ promoteToStaff 성공!');
        }
        
        alert(t('jobPostingAdmin.alerts.applicantConfirmSuccess'));
        await checkAndClosePosting(currentPost.id);
        handleViewApplicants(currentPost.id); // Refresh applicants list
    } catch (error) {
        console.error("Error confirming applicant: ", error);
        alert(t('jobPostingAdmin.alerts.applicantConfirmFailed'));
    }
  };

  const checkAndClosePosting = async (postId: string) => {
      const jobPostingRef = doc(db, 'jobPostings', postId);
      try {
        const jobPostingDoc = await getDoc(jobPostingRef);
        if(!jobPostingDoc.exists()){
          return;
        }
        const post = jobPostingDoc.data();

        const requiredCounts: { [key: string]: number } = {};
        post.timeSlots.forEach((ts: TimeSlot) => {
            ts.roles.forEach((r: RoleRequirement) => {
                const key = `${ts.time}-${r.name}`;
                requiredCounts[key] = (requiredCounts[key] || 0) + r.count;
            });
        });

        const confirmedCounts: { [key: string]: number } = (post.confirmedStaff || []).reduce((acc: any, staff: ConfirmedStaff) => {
            const key = `${staff.timeSlot}-${staff.role}`;
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});

        const isFullyStaffed = Object.keys(requiredCounts).every(key => (confirmedCounts[key] || 0) >= requiredCounts[key]);

        if (isFullyStaffed) {
            await updateDoc(jobPostingRef, { status: 'closed' });
            alert(t('jobPostingAdmin.alerts.postingClosed'));
        }
      } catch (error) {
          console.error("Error checking and closing posting: ", error);
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
                <label className="block text-sm font-medium text-gray-700">{t('jobPostingAdmin.create.timeAndRoles')}</label>
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
            {loading && <p>{t('jobPostingAdmin.manage.loading')}</p>}
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
                                {post.timeSlots?.map((ts: TimeSlot, index: number) => (
                                    <div key={index} className="mt-2 pl-4 border-l-2 border-gray-200">
                                        <p className="text-sm font-semibold text-gray-700">{t('jobPostingAdmin.manage.time')}: {ts.time}</p>
                                        <div className="text-sm text-gray-600">
                                            {ts.roles.map((r: RoleRequirement, i: number) => (
                                                <span key={i} className="mr-4">{t(`jobPostingAdmin.create.${r.name}`, r.name)}: {r.count}{t('jobPostingAdmin.manage.people')}</span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                <p className="text-sm text-gray-500 mt-2">
                                    {t('jobPostingAdmin.create.description')}: {post.description}
                                </p>
                            </div>
                            <div className='flex flex-col items-end'>
                                <div className="flex mb-2">
                                    <button
                                        onClick={() => handleViewApplicants(post.id)}
                                        className="mr-2 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                                    >
                                        {t('jobPostingAdmin.manage.applicants')}
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
                                    className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
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
                    <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">{t('jobPostingAdmin.edit.title')}</h3>
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
                            <label className="block text-sm font-medium text-gray-700">{t('jobPostingAdmin.edit.timeAndRoles')}</label>
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
  
        {isApplicantsModalOpen && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
                    <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">{t('jobPostingAdmin.applicants.title')}</h3>
                    {loadingApplicants ? (
                        <p>{t('jobPostingAdmin.applicants.loading')}</p>
                    ) : (
                        <ul className="space-y-3">
                            {applicants.length > 0 ? applicants.map(applicant => (
                                <li key={applicant.id} className="p-3 border rounded-md flex justify-between items-center">
                                    <div className="flex-grow">
                                      <p className="font-semibold">{applicant.applicantName}</p>
                                      <div className="flex flex-wrap gap-2 text-sm text-gray-600 mt-1">
                                        <span>{t('jobPostingAdmin.applicants.gender', '성별')}: {applicant.gender ? t(`gender.${applicant.gender}`, applicant.gender) : 'N/A'}</span>
                                        <span>{t('jobPostingAdmin.applicants.age', '나이')}: {applicant.age || 'N/A'}{t('jobPostingAdmin.applicants.ageUnit', '세')}</span>
                                        <span>{t('jobPostingAdmin.applicants.experience', '경력')}: {applicant.experience || 'N/A'}</span>
                                      </div>
                                      <p className="text-sm text-gray-600 mt-1">
                                        {t('jobPostingAdmin.applicants.status')}
                                        <span className={`font-medium ${applicant.status === 'confirmed' ? 'text-green-600' : 'text-blue-600'}`}>{t(`jobPostingAdmin.applicants.statusValue.${applicant.status}`, applicant.status)}</span>
                                        {(applicant.assignedTime || applicant.assignedRole) && (
                                            ` (${applicant.assignedTime || 'N/A'} / ${applicant.assignedRole ? t(`jobPostingAdmin.create.${applicant.assignedRole}`, applicant.assignedRole) : 'N/A'})`
                                        )}
                                      </p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Link to={`/profile/${applicant.applicantId}`} target="_blank" className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">
                                          {t('jobPostingAdmin.applicants.viewProfile', '프로필 보기')}
                                        </Link>
                                        {applicant.status === 'applied' && (
                                            <>
                                                <select 
                                                    className="block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
                                                    value={selectedAssignment[applicant.id] ? `${selectedAssignment[applicant.id]?.timeSlot}__${selectedAssignment[applicant.id]?.role}` : ''}
                                                    onChange={(e) => {
                                                        const [timeSlot, role] = e.target.value.split('__');
                                                        setSelectedAssignment(prev => ({ ...prev, [applicant.id]: { timeSlot, role } }));
                                                    }}
                                                >
                                                    <option value="" disabled>{t('jobPostingAdmin.applicants.selectRole')}</option>
                                                    {currentPost?.timeSlots?.flatMap((ts: TimeSlot) => 
                                                        ts.roles.map((r: RoleRequirement) => (
                                                            <option key={`${ts.time}-${r.name}`} value={`${ts.time}__${r.name}`}>
                                                                {ts.time} - {t(`jobPostingAdmin.create.${r.name}`, r.name)}
                                                            </option>
                                                        ))
                                                    )}
                                                </select>
                                                <button 
                                                    onClick={() => handleConfirmApplicant(applicant)}
                                                    className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                                                    disabled={!selectedAssignment[applicant.id]}
                                                >
                                                    {t('jobPostingAdmin.applicants.confirm')}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </li>
                            )) : <p>{t('jobPostingAdmin.applicants.none')}</p>}
                        </ul>
                    )}
                    <div className="flex justify-end mt-4">
                        <button onClick={() => setIsApplicantsModalOpen(false)} className="py-2 px-4 bg-gray-500 text-white rounded hover:bg-gray-700">{t('jobPostingAdmin.applicants.close')}</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default JobPostingAdminPage;
