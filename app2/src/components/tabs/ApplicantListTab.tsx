import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, arrayRemove, runTransaction, getDoc, deleteDoc } from 'firebase/firestore';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../contexts/AuthContext';
import { db, promoteToStaff } from '../../firebase';
import { RoleRequirement, TimeSlot, shouldCloseJobPosting, DateSpecificRequirement } from '../../types/jobPosting';
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
}

interface ApplicantListTabProps {
  jobPosting?: any; // JobPosting interface will be used later
}

const ApplicantListTab: React.FC<ApplicantListTabProps> = ({ jobPosting }) => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<{ [key: string]: Array<{ timeSlot: string, role: string, date?: string | undefined }> }>({});

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
      const initialAssignments: { [key: string]: Array<{ timeSlot: string, role: string, date?: string | undefined }> } = {};
      applicantsWithUserInfo.forEach(applicant => {
        initialAssignments[applicant.id] = []; // 빈 배열로 초기화 (date는 항상 string)
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
          transaction.update(jobPostingRef, {
            confirmedStaff: arrayUnion({
              userId: applicant.applicantId,
              role,
              timeSlot,
              date: date || undefined  // 날짜 정보 추가
            })
          });
        });
        
        // Update application status with multiple assignments
        transaction.update(applicationRef, {
          status: 'confirmed',
          // 기존 단일 필드는 첫 번째 항목으로 설정 (하위 호환성)
          assignedRole: assignments[0]?.role || '',
          assignedTime: assignments[0]?.timeSlot || '',
          assignedDate: assignments[0]?.date ?? '',
          // 새로운 다중 선택 필드들
          assignedRoles: assignments.map(a => a.role),
          assignedTimes: assignments.map(a => a.timeSlot),
          assignedDates: assignments.map(a => String(a.date ?? '')),
        });
      });

      console.log(`지원자 확정 및 공고 업데이트 완료! (${assignments.length}개 시간대)`);
      
      // promoteToStaff 호출 - 첫 번째 assignment로 호출 (기존 함수 호환성)
      if (currentUser && assignments.length > 0) {
        const firstAssignment = { ...assignments[0], date: String(assignments[0]?.date || '') };
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
        
        const jobRole = jobRoleMap[firstAssignment?.role || ''] || 'Other';
        
        await promoteToStaff(
          applicant.applicantId, 
          applicant.applicantName, 
          jobRole, 
          jobPosting.id, 
          currentUser.uid,
          firstAssignment?.role || '',      // assignedRole - 지원자에서 확정된 역할
          firstAssignment?.timeSlot || '',  // assignedTime - 지원자에서 확정된 시간
          applicant.email || '', // email 정보
          applicant.phone || ''  // phone 정보 (phoneNumber에서 phone으로 변경)
        );
        console.log('✅ promoteToStaff 성공!');
      }
      
      alert(`${t('jobPostingAdmin.alerts.applicantConfirmSuccess')} (${assignments.length}개 시간대 확정)`);
      
      // 새로운 통합 마감 로직 사용
      const jobPostingDoc = await getDoc(jobPostingRef);
      if (jobPostingDoc.exists()) {
        const updatedPost = jobPostingDoc.data();
        if (shouldCloseJobPosting(updatedPost)) {
          await updateDoc(jobPostingRef, { status: 'closed' });
          alert(t('jobPostingAdmin.alerts.postingClosed'));
          console.log('✅ 모든 요구사항 충족으로 자동 마감됨');
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
  
  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short'
      });
    } catch {
      return dateStr;
    }
  };
  
  const getApplicantSelections = (applicant: Applicant) => {
    // 다중 선택이 있는 경우
    if (hasMultipleSelections(applicant)) {
      const selections = [];
      const maxLength = Math.max(
        applicant.assignedRoles?.length || 0,
        applicant.assignedTimes?.length || 0,
        applicant.assignedDates?.length || 0
      );
      
      for (let i = 0; i < maxLength; i++) {
        selections.push({
          role: applicant.assignedRoles?.[i] || '',
          time: applicant.assignedTimes?.[i] || '',
          date: applicant.assignedDates?.[i] || ''
        });
      }
      return selections;
    }
    
    // 기존 단일 선택 방식
    if (applicant.assignedRole && applicant.assignedTime) {
      return [{
        role: applicant.assignedRole,
        time: applicant.assignedTime,
        date: applicant.assignedDate || ''
      }];
    }
    
    return [];
  };

  // 다중 선택용 체크박스 토글 함수
  const handleMultipleAssignmentToggle = (applicantId: string, value: string, isChecked: boolean) => {
    // 날짜별 형식: date__timeSlot__role (3부분) 또는 기존 형식: timeSlot__role (2부분)
    const parts = value.split('__');
    let timeSlot = '', role = '', date: string | undefined = '';
    
    if (parts.length === 3) {
      // 날짜별 요구사항: date__timeSlot__role
      [date = '', timeSlot = '', role = ''] = parts;
    } else if (parts.length === 2) {
      // 기존 형식: timeSlot__role
      [timeSlot = '', role = ''] = parts;
    }
    
    const newAssignment = { timeSlot: timeSlot || '', role: role || '', date: date || undefined };
    
    setSelectedAssignment(prev => {
      const currentAssignments = prev[applicantId] || [];
      
      if (isChecked) {
        // 체크됨: 배열에 추가 (date를 항상 string으로 보장)
        return {
          ...prev,
          [applicantId]: [...currentAssignments, newAssignment]
        };
      } else {
        // 체크 해제됨: 배열에서 제거 (date를 항상 string으로 보장)
        return {
          ...prev,
          [applicantId]: currentAssignments.filter(assignment => 
            !(assignment.timeSlot === timeSlot && 
              assignment.role === role && 
              assignment.date === date)
          )
        };
      }
    });
  };

  // 특정 assignment가 선택되었는지 확인하는 헬퍼 함수
  const isAssignmentSelected = (applicantId: string, timeSlot: string, role: string, date?: string): boolean => {
    const assignments = selectedAssignment[applicantId] || [];
    return assignments.some(assignment => 
      assignment.timeSlot === timeSlot && 
      assignment.role === role && 
      assignment.date === (date || '')
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
            console.log('✅ confirmedStaff 비어 status: open 자동 해제');
          }
        }
      } catch (err) {
        console.error('자동 마감 해제 처리 중 오류:', err);
        alert('자동 마감 해제 처리 중 오류가 발생했습니다.');
      }

      // 2. staff 컬렉션 자동 삭제
      try {
        await deleteDoc(doc(db, 'staff', applicant.applicantId));
        console.log('✅ staff 컬렉션에서 해당 지원자 문서 자동 삭제 완료');
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
                    {applicant.gender ? <p><span className="font-medium">{t('profile.gender')}:</span> {applicant.gender}</p> : null}
                    {applicant.age ? <p><span className="font-medium">{t('profile.age')}:</span> {applicant.age}</p> : null}
                    {applicant.experience ? <p><span className="font-medium">{t('profile.experience')}:</span> {applicant.experience}</p> : null}
                    {applicant.email ? <p><span className="font-medium">{t('profile.email')}:</span> {applicant.email}</p> : null}
                    {applicant.phone ? <p><span className="font-medium">{t('profile.phone')}:</span> {applicant.phone}</p> : null}
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
                            const optionValue = selection.date 
                              ? `${selection.date}__${selection.time}__${selection.role}`
                              : `${selection.time}__${selection.role}`;
                            const isSelected = isAssignmentSelected(applicant.id, selection.time, selection.role, selection.date);
                              
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
                                    {selection.date ? <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                                        📅 {formatDate(selection.date)}
                                      </span> : null}
                                    <span className="text-gray-700">⏰ {selection.time}</span>
                                    <span className="text-gray-700">👤 {t(`jobPostingAdmin.create.${selection.role}`, selection.role)}</span>
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
                              [applicant.id]: [{ timeSlot, role, date: date || undefined }]
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
                              {confirmedSelections.map((selection, index) => (
                                <div key={index} className="flex items-center space-x-2">
                                  {selection.date ? <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                                      📅 {formatDate(selection.date)}
                                    </span> : null}
                                  <span>⏰ {selection.time}</span>
                                  <span>👤 {t(`jobPostingAdmin.create.${selection.role}`, selection.role)}</span>
                                </div>
                              ))}
                            </div>
                          );
                        }
                        
                        // 기존 단일 선택 지원자 표시 (하위 호환성)
                        return (
                          <p>
                            {applicant.assignedDate ? <span className="text-blue-600 font-medium">📅 {applicant.assignedDate} | </span> : null}
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