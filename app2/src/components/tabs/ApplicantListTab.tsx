import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, arrayRemove, runTransaction, getDoc, deleteDoc } from 'firebase/firestore';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../contexts/AuthContext';
import { db, promoteToStaff } from '../../firebase';
import { RoleRequirement, TimeSlot, shouldCloseJobPosting, DateSpecificRequirement } from '../../types/jobPosting';
import { formatDate as formatDateUtil } from '../../utils/jobPosting/dateUtils';
// Applicant interface (extended for multiple selections)
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
  assignedDate?: string;    // 할당된 날짜 (yyyy-MM-dd 형식)
  email?: string;
  phone?: string;  // ProfilePage와 일치하도록 phone으로 변경
  
  // 다중 선택 지원을 위한 새로운 필드들 (하위 호환성을 위해 선택적)
  assignedRoles?: string[];   // 선택한 역할들
  assignedTimes?: string[];   // 선택한 시간들
  assignedDates?: string[];   // 선택한 날짜들
  
  // 사전질문 답변
  preQuestionAnswers?: Array<{
    questionId: string;
    question: string;
    answer: string;
    required?: boolean;
  }>;
}

interface ApplicantListTabProps {
  jobPosting?: any; // JobPosting interface will be used later
}

const ApplicantListTab: React.FC<ApplicantListTabProps> = ({ jobPosting }) => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<{ [key: string]: Array<{ timeSlot: string, role: string, date: string }> }>({});

  // Load applicants when component mounts or jobPosting changes
  useEffect(() => {
    if (jobPosting?.id) {
      loadApplicants(jobPosting.id);
    }
  }, [jobPosting?.id]);

  const loadApplicants = async (postId: string) => {
    setLoadingApplicants(true);
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
                experience: userData.experience,
                email: userData.email,
                phone: userData.phone  // phoneNumber에서 phone으로 변경
              };
            }
            return applicant;
          } catch (error) {
            console.error('Error fetching user data for applicant:', applicant.applicantId, error);
            return applicant;
          }
        })
      );

      setApplicants(applicantsWithUserInfo);
      
      // 초기 할당 상태 설정 (다중 선택용 배열)
      const initialAssignments: { [key: string]: Array<{ timeSlot: string, role: string, date: string }> } = {};
      applicantsWithUserInfo.forEach(applicant => {
        initialAssignments[applicant.id] = []; // 빈 배열로 초기화
      });
      setSelectedAssignment(initialAssignments);
      

    } catch (error) {
      console.error('Error fetching applicants: ', error);
      alert(t('jobPostingAdmin.alerts.fetchApplicantsFailed'));
    } finally {
      setLoadingApplicants(false);
    }
  };

  const handleConfirmApplicant = async (applicant: Applicant) => {
    const assignments = selectedAssignment[applicant.id];
    
    console.log('🔍 handleConfirmApplicant 시작:', {
      applicantId: applicant.id,
      applicantName: applicant.applicantName,
      selectedAssignment: selectedAssignment,
      assignments,
      assignmentsLength: assignments?.length
    });
    
    if (!assignments || assignments.length === 0) {
      alert(t('jobPostingAdmin.alerts.selectRoleToAssign'));
      return;
    }
    if (!jobPosting) return;

    const jobPostingRef = doc(db, "jobPostings", jobPosting.id);
    const applicationRef = doc(db, "applications", applicant.id);

    try {
      await runTransaction(db, async (transaction) => {
        // Update job posting with all confirmed staff assignments
        assignments.forEach(assignment => {
          const { timeSlot, role, date } = assignment;
          const staffEntry: any = {
            userId: applicant.applicantId,
            role,
            timeSlot
          };
          
          // date가 존재하고 유효한 값일 때만 추가
          if (date && date.trim() !== '') {
            staffEntry.date = date;
          }
          
          transaction.update(jobPostingRef, {
            confirmedStaff: arrayUnion(staffEntry)
          });
        });
        
        // Update application status with multiple assignments
        const confirmedAt = new Date();
        
        transaction.update(applicationRef, {
          status: 'confirmed',
          confirmedAt: confirmedAt,
          // 기존 단일 필드는 첫 번째 항목으로 설정 (하위 호환성)
          assignedRole: assignments[0]?.role || '',
          assignedTime: assignments[0]?.timeSlot || '',
          assignedDate: assignments[0]?.date || '',
          // 새로운 다중 선택 필드들
          assignedRoles: assignments.map(a => a.role),
          assignedTimes: assignments.map(a => a.timeSlot),
          assignedDates: assignments.map(a => String(a.date || '')),
        });
        
      });

      // 각 assignment마다 별도의 스태프 문서 생성 (다중 날짜/시간대 지원)
      if (currentUser && assignments.length > 0) {
        console.log('🔍 다중 promoteToStaff 호출 시작:', {
          assignments,
          assignmentsCount: assignments.length,
          applicantId: applicant.applicantId,
          applicantName: applicant.applicantName
        });
        
        // role 값을 적절한 JobRole 형식으로 변환
        const jobRoleMap: { [key: string]: string } = {
          'dealer': 'Dealer',
          'floor': 'Floor',
          'serving': 'Server',
          'tournament_director': 'Tournament Director',
          'chip_master': 'Chip Master', 
          'registration': 'Registration',
          'security': 'Security',
          'other': 'Other'
        };
        
        // 각 assignment에 대해 개별적으로 promoteToStaff 호출
        for (let i = 0; i < assignments.length; i++) {
          const assignment = assignments[i];
          const assignedDate = String(assignment?.date || '');
          
          // 날짜가 빈 문자열이면 기본값 설정 (오늘 날짜 또는 공고의 기본 날짜)
          let finalAssignedDate = assignedDate;
          if (!finalAssignedDate || finalAssignedDate.trim() === '') {
            // 공고에 날짜 정보가 있으면 사용, 없으면 오늘 날짜
            if (jobPosting.eventDate) {
              finalAssignedDate = jobPosting.eventDate;
            } else {
              finalAssignedDate = new Date().toISOString().split('T')[0]; // yyyy-MM-dd 형식
            }
          }
          
          const jobRole = jobRoleMap[assignment?.role || ''] || 'Other';
          
          // 고유한 문서 ID 생성 (userId + assignment index)
          const staffDocId = `${applicant.applicantId}_${i}`;
          
          console.log(`🔍 promoteToStaff 호출 ${i + 1}/${assignments.length}:`, {
            assignment,
            assignedDate,
            finalAssignedDate,
            jobRole,
            staffDocId,
            'assignment.date': assignment?.date,
            'assignment.role': assignment?.role,
            'assignment.timeSlot': assignment?.timeSlot
          });
          
          try {
            await promoteToStaff(
              staffDocId, // 고유한 문서 ID 사용
              applicant.applicantName, 
              jobRole, 
              jobPosting.id, 
              currentUser.uid,
              assignment?.role || '',      // assignedRole - 지원자에서 확정된 역할
              assignment?.timeSlot || '',  // assignedTime - 지원자에서 확정된 시간
              applicant.email || '', // email 정보
              applicant.phone || '',  // phone 정보
              finalAssignedDate, // assignedDate - 지원자에서 확정된 날짜 (기본값 포함)
              applicant.applicantId // 실제 사용자 ID
            );
            console.log(`✅ promoteToStaff 성공 ${i + 1}/${assignments.length}:`, staffDocId);
          } catch (promoteError) {
            console.error(`❌ promoteToStaff 오류 ${i + 1}/${assignments.length}:`, promoteError);
            // 개별 promoteToStaff 실패해도 전체 프로세스는 계속 진행
          }
        }
        
        console.log('✅ 모든 promoteToStaff 호출 완료');
      }
      
      // 해당 지원자의 선택 상태 초기화
      setSelectedAssignment(prev => ({
        ...prev,
        [applicant.id]: []
      }));
      
      alert(`${t('jobPostingAdmin.alerts.applicantConfirmSuccess')} (${assignments.length}개 시간대 확정)`);
      
      // 새로운 통합 마감 로직 사용
      const jobPostingDoc = await getDoc(jobPostingRef);
      if (jobPostingDoc.exists()) {
        const updatedPost = jobPostingDoc.data();
        if (shouldCloseJobPosting(updatedPost)) {
          await updateDoc(jobPostingRef, { status: 'closed' });
          alert(t('jobPostingAdmin.alerts.postingClosed'));
        }
      }
      
      loadApplicants(jobPosting.id); // Refresh applicants list
    } catch (error) {
      console.error("Error confirming applicant: ", error);
      alert(t('jobPostingAdmin.alerts.applicantConfirmFailed'));
    }
  };



  // 다중 선택 지원 헬퍼 함수들
  const hasMultipleSelections = (applicant: Applicant): boolean => {
    return !!(applicant.assignedRoles?.length || 
              applicant.assignedTimes?.length || 
              applicant.assignedDates?.length);
  };
  
  
  const getApplicantSelections = (applicant: Applicant) => {
    console.log('🔍 getApplicantSelections 호출:', {
      applicantId: applicant.id,
      applicantName: applicant.applicantName,
      hasMultiple: hasMultipleSelections(applicant),
      assignedRoles: applicant.assignedRoles,
      assignedTimes: applicant.assignedTimes,
      assignedDates: applicant.assignedDates,
      assignedRole: applicant.assignedRole,
      assignedTime: applicant.assignedTime,
      assignedDate: applicant.assignedDate
    });
    
    // 다중 선택이 있는 경우
    if (hasMultipleSelections(applicant)) {
      const selections = [];
      const maxLength = Math.max(
        applicant.assignedRoles?.length || 0,
        applicant.assignedTimes?.length || 0,
        applicant.assignedDates?.length || 0
      );
      
      for (let i = 0; i < maxLength; i++) {
        // assignedDates 배열의 요소를 안전하게 문자열로 변환
        let dateValue = '';
        const rawDate = applicant.assignedDates?.[i];
        if (rawDate) {
          if (typeof rawDate === 'string') {
            dateValue = rawDate;
          } else {
            // Timestamp 객체이거나 다른 타입인 경우 문자열로 변환
            try {
              dateValue = String(rawDate);
            } catch (error) {
              console.error('❌ assignedDates 배열 요소 변환 오류:', error, rawDate);
              dateValue = '';
            }
          }
        }
        
        selections.push({
          role: applicant.assignedRoles?.[i] || '',
          time: applicant.assignedTimes?.[i] || '',
          date: dateValue
        });
      }
      
      console.log('🔍 다중 선택 결과:', selections);
      return selections;
    }
    
    // 기존 단일 선택 방식
    if (applicant.assignedRole && applicant.assignedTime) {
      // assignedDate를 안전하게 문자열로 변환
      let singleDateValue = '';
      if (applicant.assignedDate) {
        if (typeof applicant.assignedDate === 'string') {
          singleDateValue = applicant.assignedDate;
        } else {
          try {
            singleDateValue = String(applicant.assignedDate);
          } catch (error) {
            console.error('❌ assignedDate 변환 오류:', error, applicant.assignedDate);
            singleDateValue = '';
          }
        }
      }
      
      const singleSelection = [{
        role: applicant.assignedRole,
        time: applicant.assignedTime,
        date: singleDateValue
      }];
      
      console.log('🔍 단일 선택 결과:', singleSelection);
      return singleSelection;
    }
    
    console.log('🔍 선택 사항 없음');
    return [];
  };

  // 다중 선택용 체크박스 토글 함수
  const handleMultipleAssignmentToggle = (applicantId: string, value: string, isChecked: boolean) => {
    console.log('🔍 handleMultipleAssignmentToggle 시작:', { applicantId, value, isChecked });
    
    // 날짜별 형식: date__timeSlot__role (3부분) 또는 기존 형식: timeSlot__role (2부분)
    const parts = value.split('__');
    let timeSlot = '', role = '', date = '';
    
    if (parts.length === 3) {
      // 날짜별 요구사항: date__timeSlot__role
      [date = '', timeSlot = '', role = ''] = parts;
    } else if (parts.length === 2) {
      // 기존 형식: timeSlot__role
      [timeSlot = '', role = ''] = parts;
    }
    
    const newAssignment = { 
      timeSlot: timeSlot.trim(), 
      role: role.trim(), 
      date: date.trim() 
    };
    
    console.log('🔍 assignment 파싱 결과:', {
      parts,
      newAssignment,
      originalValue: value
    });
    
    setSelectedAssignment(prev => {
      const currentAssignments = prev[applicantId] || [];
      
      if (isChecked) {
        // 체크됨: 중복 체크 후 배열에 추가
        const isDuplicate = currentAssignments.some(assignment => 
          assignment.timeSlot === newAssignment.timeSlot && 
          assignment.role === newAssignment.role && 
          assignment.date === newAssignment.date
        );
        
        if (isDuplicate) {
          return prev;
        }
        
        return {
          ...prev,
          [applicantId]: [...currentAssignments, newAssignment]
        };
      } else {
        // 체크 해제됨: 배열에서 제거
        const filtered = currentAssignments.filter(assignment => 
          !(assignment.timeSlot === newAssignment.timeSlot && 
            assignment.role === newAssignment.role && 
            assignment.date === newAssignment.date)
        );
        
        return {
          ...prev,
          [applicantId]: filtered
        };
      }
    });
  };

  // 특정 assignment가 선택되었는지 확인하는 헬퍼 함수
  const isAssignmentSelected = (applicantId: string, timeSlot: string, role: string, date?: string): boolean => {
    const assignments = selectedAssignment[applicantId] || [];
    // date를 안전하게 문자열로 변환 후 정규화
    const safeDateParam = typeof date === 'string' ? date : String(date || '');
    const normalizedDate = safeDateParam.trim();
    const normalizedTimeSlot = timeSlot.trim();
    const normalizedRole = role.trim();
    
    return assignments.some(assignment => 
      assignment.timeSlot === normalizedTimeSlot && 
      assignment.role === normalizedRole && 
      assignment.date === normalizedDate
    );
  };

  // 확정 취소 핸들러 함수
  const handleCancelConfirmation = async (applicant: Applicant) => {
    if (!jobPosting) return;

    // 확정 취소 확인 대화상자
    const confirmed = window.confirm(
      `${applicant.applicantName}님의 확정을 취소하시겠습니까?\n\n취소 시 다음 작업이 수행됩니다:\n• 지원자 상태가 '지원함'으로 변경됩니다\n• 원래 지원한 시간대는 유지됩니다\n• 확정 스태프 목록에서 제거됩니다\n• 다시 확정 선택이 가능해집니다`
    );

    if (!confirmed) return;

    try {
      const jobPostingRef = doc(db, "jobPostings", jobPosting.id);
      const applicationRef = doc(db, "applications", applicant.id);

      await runTransaction(db, async (transaction) => {
        // 1. applications 컬렉션에서 상태 변경 (원래 지원 정보는 유지)
        transaction.update(applicationRef, {
          status: 'applied',
          // 확정 시 추가된 단일 선택 필드들은 제거
          assignedRole: null,
          assignedTime: null,
          assignedDate: null,
          // 확정 관련 필드 제거
          confirmedAt: null,
          cancelledAt: new Date()
          // 원래 지원 정보(assignedRoles[], assignedTimes[], assignedDates[])는 유지
          // 이것들이 체크박스에 표시되는 원본 데이터입니다
        });

        // 2. jobPostings 컬렉션의 confirmedStaff 배열에서 해당 지원자 항목들 제거
        if (jobPosting.confirmedStaff && jobPosting.confirmedStaff.length > 0) {
          const staffEntriesToRemove = jobPosting.confirmedStaff.filter(
            (staff: any) => staff.userId === applicant.applicantId
          );

          // 각 항목을 개별적으로 제거
          staffEntriesToRemove.forEach((staffEntry: any) => {
            transaction.update(jobPostingRef, {
              confirmedStaff: arrayRemove(staffEntry)
            });
          });
        }
      });

      // --- [여기서부터 후처리: 자동 마감 해제, staff 삭제] ---
      // 1. jobPostings 자동 마감 해제
      try {
        const jobPostingDoc = await getDoc(jobPostingRef);
        if (jobPostingDoc.exists()) {
          const updatedPost = jobPostingDoc.data();
          if (!updatedPost.confirmedStaff || updatedPost.confirmedStaff.length === 0) {
            await updateDoc(jobPostingRef, { status: 'open' });
            alert('모든 확정 인원이 사라져 공고가 다시 오픈되었습니다.');
          }
        }
      } catch (err) {
        console.error('자동 마감 해제 처리 중 오류:', err);
        alert('자동 마감 해제 처리 중 오류가 발생했습니다.');
      }

      // 2. staff 컬렉션 자동 삭제 (다중 문서 지원)
      try {
        console.log('🔍 다중 스태프 문서 삭제 시작:', applicant.applicantId);
        
        // 해당 지원자와 관련된 모든 스태프 문서 찾기
        const staffQuery = query(
          collection(db, 'staff'), 
          where('userId', '==', applicant.applicantId),
          where('postingId', '==', jobPosting.id)
        );
        
        const staffSnapshot = await getDocs(staffQuery);
        console.log('🔍 삭제할 스태프 문서 수:', staffSnapshot.size);
        
        // 각 스태프 문서 개별 삭제
        const deletePromises = staffSnapshot.docs.map(async (staffDoc) => {
          console.log('🗑️ 스태프 문서 삭제:', staffDoc.id);
          return deleteDoc(doc(db, 'staff', staffDoc.id));
        });
        
        await Promise.all(deletePromises);
        console.log('✅ 모든 스태프 문서 삭제 완료');
      } catch (err) {
        console.error('staff 컬렉션 자동 삭제 중 오류:', err);
        alert('staff 컬렉션 자동 삭제 중 오류가 발생했습니다.');
      }

      // 3. 성공 알림
      alert(`${applicant.applicantName}님의 확정이 취소되었습니다.`);

      // 4. 지원자 목록 새로고침
      loadApplicants(jobPosting.id);

    } catch (error) {
      console.error('Error cancelling confirmation:', error);
      alert('확정 취소 중 오류가 발생했습니다.');
    }
  };

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

  if (loadingApplicants) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center min-h-96">
          <div className="text-lg">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-medium">{t('jobPostingAdmin.applicants.title')}</h3>
        <button
          onClick={() => loadApplicants(jobPosting.id)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {t('common.refresh')}
        </button>
      </div>

      {applicants.length === 0 ? (
        <div className="bg-gray-50 p-6 rounded-lg text-center">
          <p className="text-gray-600">{t('jobPostingAdmin.applicants.none')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {applicants.map((applicant) => (
            <div key={applicant.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{applicant.applicantName}</h4>
                  <div className="mt-2 text-sm text-gray-600 space-y-1">
                    <p>
                      <span className="font-medium">{t('jobPostingAdmin.applicants.status')}:</span>
                      <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                        applicant.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                        applicant.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {t(`jobPostingAdmin.applicants.status_${applicant.status}`)}
                      </span>
                    </p>
                    {applicant.appliedAt && (
                      <p>
                        <span className="font-medium">지원일:</span>
                        <span className="ml-2">{(() => {
                          try {
                            return formatDateUtil(applicant.appliedAt);
                          } catch (error) {
                            console.error('❌ appliedAt 날짜 포맷 오류:', error, applicant.appliedAt);
                            return '날짜 오류';
                          }
                        })()}</span>
                      </p>
                    )}
                    {applicant.gender ? <p><span className="font-medium">{t('profile.gender')}:</span> {applicant.gender}</p> : null}
                    {applicant.age ? <p><span className="font-medium">{t('profile.age')}:</span> {applicant.age}</p> : null}
                    {applicant.experience ? <p><span className="font-medium">{t('profile.experience')}:</span> {applicant.experience}</p> : null}
                    {applicant.email ? <p><span className="font-medium">{t('profile.email')}:</span> {applicant.email}</p> : null}
                    {applicant.phone ? <p><span className="font-medium">{t('profile.phone')}:</span> {applicant.phone}</p> : null}
                    
                    {/* 사전질문 답변 표시 */}
                    {applicant.preQuestionAnswers && applicant.preQuestionAnswers.length > 0 && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <h5 className="font-medium text-blue-800 mb-2">📝 사전질문 답변</h5>
                        <div className="space-y-2">
                          {applicant.preQuestionAnswers.map((answer, index) => (
                            <div key={index} className="text-sm">
                              <p className="font-medium text-gray-700">
                                Q{index + 1}. {answer.question}
                                {answer.required ? <span className="text-red-500 ml-1">*</span> : null}
                              </p>
                              <p className="text-gray-600 ml-4 mt-1">
                                ▶ {answer.answer || <span className="text-gray-400">(답변 없음)</span>}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {applicant.status === 'applied' && (() => {
                  const selections = getApplicantSelections(applicant);
                  
                  // 다중 선택이 있는 경우 - 체크박스로 여러 개 선택 가능
                  if (selections.length > 0) {
                    const selectedCount = selectedAssignment[applicant.id]?.length || 0;
                    return (
                      <div className="ml-4 space-y-3">
                        <div className="text-sm font-medium text-gray-700 mb-2">
                          ✅ 확정할 시간대 선택 ({selections.length}개 옵션 중 {selectedCount}개 선택):
                        </div>
                        <div className="space-y-2">
                          {selections.map((selection, index) => {
                            // selection.date를 안전하게 문자열로 처리
                            const safeDateString = typeof selection.date === 'string' ? selection.date : String(selection.date || '');
                            const optionValue = (safeDateString && safeDateString.trim() !== '') 
                              ? `${safeDateString}__${selection.time}__${selection.role}`
                              : `${selection.time}__${selection.role}`;
                            
                            console.log('🔍 체크박스 optionValue 생성:', {
                              index,
                              selection,
                              'selection.date (truthy?)': !!selection.date,
                              'selection.date (raw)': selection.date,
                              'safeDateString': safeDateString,
                              optionValue
                            });
                            const isSelected = isAssignmentSelected(applicant.id, selection.time, selection.role, safeDateString);
                              
                            return (
                              <label key={index} className={`flex items-center p-2 border rounded cursor-pointer ${
                                isSelected ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                              }`}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => handleMultipleAssignmentToggle(applicant.id, optionValue, e.target.checked)}
                                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                                />
                                <div className="ml-3 flex-1">
                                  <div className="flex items-center space-x-2 text-sm">
                                    {safeDateString ? <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                                        📅 {(() => {
                                          try {
                                            return formatDateUtil(safeDateString);
                                          } catch (error) {
                                            console.error('❌ selection.date 날짜 포맷 오류:', error, safeDateString);
                                            return '날짜 오류';
                                          }
                                        })()}
                                      </span> : null}
                                    <span className="text-gray-700">⏰ {selection.time}</span>
                                    <span className="text-gray-700">👤 {t(`jobPostingAdmin.create.${selection.role}`) || selection.role}</span>
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                        <button 
                          onClick={() => handleConfirmApplicant(applicant)}
                          className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                          disabled={selectedCount === 0}
                        >
                          ✓ 선택한 시간대로 확정 ({selectedCount}개)
                        </button>
                      </div>
                    );
                  }
                  
                  // 다중 선택이 없는 경우 - 기존 방식 유지 (단일 선택)
                  return (
                    <div className="ml-4 flex items-center space-x-2">
                      <select
                        value={''}
                        onChange={(e) => {
                          // 단일 선택 처리 - 기존 선택을 모두 지우고 새로운 선택 추가
                          if (e.target.value) {
                            const parts = e.target.value.split('__');
                            let timeSlot = '', role = '', date: string | undefined = '';
                            
                            if (parts.length === 3) {
                              [date, timeSlot, role] = parts as [string, string, string];
                            } else if (parts.length === 2) {
                              [timeSlot, role] = parts as [string, string];
                            }
                            
                            setSelectedAssignment(prev => ({
                              ...prev,
                              [applicant.id]: [{ timeSlot, role, date: date || '' }]
                            }));
                          }
                        }}
                        className="text-sm border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="" disabled>{t('jobPostingAdmin.applicants.selectRole')}</option>
                        
                        {/* 날짜별 요구사항 */}
                        {jobPosting?.dateSpecificRequirements?.flatMap((dateReq: DateSpecificRequirement) =>
                          dateReq.timeSlots.flatMap((ts: TimeSlot) =>
                            ts.roles.map((r: RoleRequirement) => (
                              <option key={`${dateReq.date}-${ts.time}-${r.name}`} value={`${dateReq.date}__${ts.time}__${r.name}`}>
                                📅 {dateReq.date} | {ts.time} - {t(`jobPostingAdmin.create.${r.name}`, r.name)}
                              </option>
                            ))
                          )
                        )}
                        
                        {/* 기존 방식 timeSlots */}
                        {jobPosting?.timeSlots?.flatMap((ts: TimeSlot) => 
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
                          disabled={!selectedAssignment[applicant.id] || !selectedAssignment[applicant.id]?.length}
                        >
                          {t('jobPostingAdmin.applicants.confirm')}
                        </button>
                    </div>
                  );
                })()}
                
                {applicant.status === 'confirmed' && (
                  <div className="ml-4 text-sm space-y-2">
                    <div className="text-green-600">
                      <p className="font-medium">{t('jobPostingAdmin.applicants.confirmed')}</p>
                      {(() => {
                        // 확정된 지원자의 선택 정보 표시
                        const confirmedSelections = getApplicantSelections(applicant);
                        if (confirmedSelections.length > 0) {
                          return (
                            <div className="space-y-1">
                              {confirmedSelections.map((selection, index) => {
                                // selection.date를 안전하게 문자열로 처리
                                const confirmedSafeDateString = typeof selection.date === 'string' ? selection.date : String(selection.date || '');
                                return (
                                <div key={index} className="flex items-center space-x-2">
                                  {confirmedSafeDateString ? <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                                      📅 {(() => {
                                        try {
                                          return formatDateUtil(confirmedSafeDateString);
                                        } catch (error) {
                                          console.error('❌ confirmed selection.date 날짜 포맷 오류:', error, confirmedSafeDateString);
                                          return '날짜 오류';
                                        }
                                      })()}
                                    </span> : null}
                                  <span>⏰ {selection.time}</span>
                                  <span>👤 {t(`jobPostingAdmin.create.${selection.role}`) || selection.role}</span>
                                </div>
                                );
                              })}
                            </div>
                          );
                        }
                        
                        // 기존 단일 선택 지원자 표시 (하위 호환성)
                        return (
                          <p>
                            {applicant.assignedDate ? <span className="text-blue-600 font-medium">📅 {(() => {
                              try {
                                return formatDateUtil(applicant.assignedDate);
                              } catch (error) {
                                console.error('❌ ApplicantListTab assignedDate 포맷 오류:', error, applicant.assignedDate);
                                return '날짜 오류';
                              }
                            })()} | </span> : null}
                            {applicant.assignedTime} - {applicant.assignedRole ? t(`jobPostingAdmin.create.${applicant.assignedRole}`) : applicant.assignedRole}
                          </p>
                        );
                      })()}
                    </div>
                    <button 
                      onClick={() => handleCancelConfirmation(applicant)}
                      className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm font-medium"
                    >
                      ❌ 확정 취소
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ApplicantListTab;