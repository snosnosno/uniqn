import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, runTransaction, getDoc } from 'firebase/firestore';
import { db, promoteToStaff } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
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
  phoneNumber?: string;
  
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
  const [selectedAssignment, setSelectedAssignment] = useState<{ [key: string]: { timeSlot: string, role: string, date?: string } }>({});

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
                phoneNumber: userData.phoneNumber
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
      
      // 초기 할당 상태 설정
      const initialAssignments: { [key: string]: { timeSlot: string, role: string } } = {};
      applicantsWithUserInfo.forEach(applicant => {
        if (applicant.assignedTime && applicant.assignedRole) {
          initialAssignments[applicant.id] = {
            timeSlot: applicant.assignedTime,
            role: applicant.assignedRole
          };
        } else {
          initialAssignments[applicant.id] = { timeSlot: '', role: '' };
        }
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
    const assignment = selectedAssignment[applicant.id];
    if (!assignment || !assignment.timeSlot || !assignment.role) {
      alert(t('jobPostingAdmin.alerts.selectRoleToAssign'));
      return;
    }
    if (!jobPosting) return;

    const { timeSlot, role, date } = assignment;
    const jobPostingRef = doc(db, "jobPostings", jobPosting.id);
    const applicationRef = doc(db, "applications", applicant.id);

    try {
      await runTransaction(db, async (transaction) => {
        // Update job posting with confirmed staff
        transaction.update(jobPostingRef, {
          confirmedStaff: arrayUnion({
            userId: applicant.applicantId,
            role: role,
            timeSlot: timeSlot,
            date: date || undefined  // 날짜 정보 추가
          })
        });
        
        // Update application status
        transaction.update(applicationRef, {
          status: 'confirmed',
          assignedRole: role,
          assignedTime: timeSlot,
          assignedDate: date || undefined  // 지원자에게 할당된 날짜 저장
        });
      });

      console.log('지원자 확정 및 공고 업데이트 완료!');
      
      // promoteToStaff 호출 (선택사항)
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
          'other': 'Other'
        };
        
        const jobRole = jobRoleMap[role] || 'Other';
        
        await promoteToStaff(
          applicant.applicantId, 
          applicant.applicantName, 
          jobRole, 
          jobPosting.id, 
          currentUser.uid,
          role,      // assignedRole - 지원자에서 확정된 역할
          timeSlot,  // assignedTime - 지원자에서 확정된 시간
          applicant.email || '', // email 정보
                    applicant.phoneNumber || ''  // phone 정보
        );
        console.log('✅ promoteToStaff 성공!');
      }
      
      alert(t('jobPostingAdmin.alerts.applicantConfirmSuccess'));
      
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

  const handleAssignmentChange = (applicantId: string, value: string) => {
    // 날짜별 형식: date__timeSlot__role (3부분) 또는 기존 형식: timeSlot__role (2부분)
    const parts = value.split('__');
    let timeSlot = '', role = '', date = '';
    
    if (parts.length === 3) {
      // 날짜별 요구사항: date__timeSlot__role
      [date, timeSlot, role] = parts;
    } else if (parts.length === 2) {
      // 기존 형식: timeSlot__role
      [timeSlot, role] = parts;
    }
    
    setSelectedAssignment(prev => ({
      ...prev,
      [applicantId]: { timeSlot: timeSlot || '', role: role || '', date: date || undefined }
    }));
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
                    {applicant.gender && <p><span className="font-medium">{t('profile.gender')}:</span> {applicant.gender}</p>}
                    {applicant.age && <p><span className="font-medium">{t('profile.age')}:</span> {applicant.age}</p>}
                    {applicant.experience && <p><span className="font-medium">{t('profile.experience')}:</span> {applicant.experience}</p>}
                    {applicant.email && <p><span className="font-medium">{t('profile.email')}:</span> {applicant.email}</p>}
                    {applicant.phoneNumber && <p><span className="font-medium">{t('profile.phone')}:</span> {applicant.phoneNumber}</p>}
                  </div>
                  {/* 지원자가 선택한 시간대들 표시 */}
                  {(() => {
                    const selections = getApplicantSelections(applicant);
                    if (selections.length > 0) {
                      return (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                          <p className="font-medium text-blue-800 mb-2">
                            {hasMultipleSelections(applicant) 
                              ? `🎯 지원한 시간대 (${selections.length}개):` 
                              : '🎯 지원한 시간대:'}
                          </p>
                          <div className="space-y-1">
                            {selections.map((selection, index) => (
                              <div key={index} className="text-sm text-blue-700 flex items-center">
                                {selection.date && (
                                  <span className="inline-flex items-center px-2 py-1 mr-2 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                                    📅 {formatDate(selection.date)}
                                  </span>
                                )}
                                <span className="mr-2">⏰ {selection.time}</span>
                                <span>👤 {t(`jobPostingAdmin.create.${selection.role}`, selection.role)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                {applicant.status === 'applied' && (() => {
                  const selections = getApplicantSelections(applicant);
                  
                  // 다중 선택이 있는 경우 - 선택한 옵션들만 표시
                  if (selections.length > 0) {
                    return (
                      <div className="ml-4 space-y-3">
                        <div className="text-sm font-medium text-gray-700 mb-2">
                          🎯 확정할 시간대 선택 ({selections.length}개 옵션 중 1개):
                        </div>
                        <div className="space-y-2">
                          {selections.map((selection, index) => {
                            const optionValue = selection.date 
                              ? `${selection.date}__${selection.time}__${selection.role}`
                              : `${selection.time}__${selection.role}`;
                            const isSelected = selectedAssignment[applicant.id] && 
                              selectedAssignment[applicant.id].timeSlot === selection.time &&
                              selectedAssignment[applicant.id].role === selection.role &&
                              (selectedAssignment[applicant.id].date || '') === (selection.date || '');
                              
                            return (
                              <label key={index} className={`flex items-center p-2 border rounded cursor-pointer ${
                                isSelected ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                              }`}>
                                <input
                                  type="radio"
                                  name={`assignment-${applicant.id}`}
                                  checked={isSelected}
                                  onChange={() => handleAssignmentChange(applicant.id, optionValue)}
                                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
                                />
                                <div className="ml-3 flex-1">
                                  <div className="flex items-center space-x-2 text-sm">
                                    {selection.date && (
                                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                                        📅 {formatDate(selection.date)}
                                      </span>
                                    )}
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
                          disabled={!selectedAssignment[applicant.id] || !selectedAssignment[applicant.id].timeSlot || !selectedAssignment[applicant.id].role}
                        >
                          ✓ 선택한 시간대로 확정
                        </button>
                      </div>
                    );
                  }
                  
                  // 다중 선택이 없는 경우 - 기존 방식 유지
                  return (
                    <div className="ml-4 flex items-center space-x-2">
                      <select
                        value={
                          selectedAssignment[applicant.id] 
                            ? selectedAssignment[applicant.id].date 
                              ? `${selectedAssignment[applicant.id].date}__${selectedAssignment[applicant.id].timeSlot}__${selectedAssignment[applicant.id].role}`
                              : `${selectedAssignment[applicant.id].timeSlot}__${selectedAssignment[applicant.id].role}`
                            : ''
                        }
                        onChange={(e) => handleAssignmentChange(applicant.id, e.target.value)}
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
                        disabled={!selectedAssignment[applicant.id] || !selectedAssignment[applicant.id].timeSlot || !selectedAssignment[applicant.id].role}
                      >
                        {t('jobPostingAdmin.applicants.confirm')}
                      </button>
                    </div>
                  );
                })()}
                
                {applicant.status === 'confirmed' && applicant.assignedRole && applicant.assignedTime && (
                  <div className="ml-4 text-sm text-green-600">
                    <p className="font-medium">{t('jobPostingAdmin.applicants.confirmed')}</p>
                    <p>
                      {applicant.assignedDate && (
                        <span className="text-blue-600 font-medium">📅 {applicant.assignedDate} | </span>
                      )}
                      {applicant.assignedTime} - {t(`jobPostingAdmin.create.${applicant.assignedRole}`, applicant.assignedRole)}
                    </p>
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