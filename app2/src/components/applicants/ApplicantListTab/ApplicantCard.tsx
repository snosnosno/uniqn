import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Applicant } from './types';
import PreQuestionDisplay from './PreQuestionDisplay';
import { 
  getApplicantSelections, 
  formatDateDisplay, 
  groupApplicationsByConsecutiveDates
} from './utils/applicantHelpers';
import StaffProfileModal from '../../StaffProfileModal';
import { StaffData } from '../../../hooks/useStaffManagement';

interface ApplicantCardProps {
  applicant: Applicant;
  jobPosting?: any; // 역할 정보 복원을 위한 구인공고 데이터
  children?: React.ReactNode; // 액션 버튼들을 위한 children
}

/**
 * 개별 지원자 정보를 표시하는 카드 컴포넌트 (2x2 그리드 레이아웃)
 */
const ApplicantCard: React.FC<ApplicantCardProps> = ({ applicant, jobPosting, children }) => {
  const { t } = useTranslation();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // StaffData 형식으로 변환
  const staffData: StaffData | null = applicant ? {
    id: applicant.applicantId || applicant.id,
    userId: applicant.applicantId || applicant.id,
    name: applicant.applicantName,
    phone: applicant.phone || '',
    email: applicant.email || '',
    role: applicant.assignedRole as any || '',
    notes: applicant.notes || '',
    postingId: applicant.eventId || '',
    postingTitle: '', // 지원자 탭에서는 posting 정보가 없으므로 빈 문자열
    assignedTime: applicant.assignedTime || ''
  } : null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
      {/* 2x2 그리드 레이아웃 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        
        {/* 1사분면: 기본 정보 */}
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 
                className="font-medium text-gray-900 text-base cursor-pointer hover:text-blue-600 hover:underline"
                onClick={() => setIsProfileModalOpen(true)}
              >
                {applicant.applicantName}
              </h4>
              <span className={`px-2 py-1 rounded-full text-xs ${
                applicant.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                applicant.status === 'rejected' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {t(`jobPostingAdmin.applicants.status_${applicant.status}`)}
              </span>
            </div>
          </div>
          
          <div className="text-sm text-gray-600 space-y-1.5">
            {applicant.appliedAt && (
              <div className="flex items-center">
                <span className="font-medium min-w-12">지원:</span>
                <span className="ml-2">
                  {(() => {
                    // 🔧 TypeScript strict mode 준수: Union 타입 완전 처리
                    if (typeof applicant.appliedAt === 'string') {
                      return formatDateDisplay(applicant.appliedAt);
                    }
                    
                    // Timestamp 타입 체크
                    if (applicant.appliedAt && typeof applicant.appliedAt === 'object' && 'toDate' in applicant.appliedAt) {
                      const dateStr = applicant.appliedAt.toDate().toISOString().split('T')[0] || '';
                      return formatDateDisplay(dateStr);
                    }
                    
                    // Date 타입 체크
                    if (applicant.appliedAt instanceof Date) {
                      const dateStr = applicant.appliedAt.toISOString().split('T')[0] || '';
                      return formatDateDisplay(dateStr);
                    }
                    
                    return '';
                  })()}
                </span>
              </div>
            )}
            
            {applicant.gender ? (
              <div className="flex items-center">
                <span className="font-medium min-w-12">{t('profile.gender')}:</span> 
                <span className="ml-2">
                  {applicant.gender.toLowerCase() === 'male' 
                    ? t('gender.male') 
                    : applicant.gender.toLowerCase() === 'female' 
                    ? t('gender.female') 
                    : applicant.gender}
                </span>
              </div>
            ) : null}
            
            {applicant.age ? (
              <div className="flex items-center">
                <span className="font-medium min-w-12">{t('profile.age')}:</span>
                <span className="ml-2">{applicant.age}</span>
              </div>
            ) : null}
            
            {applicant.experience ? (
              <div className="flex items-center">
                <span className="font-medium min-w-12">{t('profile.experience')}:</span>
                <span className="ml-2">{applicant.experience}</span>
              </div>
            ) : null}
            
            {applicant.email ? (
              <div className="flex items-center">
                <span className="font-medium min-w-12">{t('profile.email')}:</span>
                <span className="ml-2 text-xs break-all">{applicant.email}</span>
              </div>
            ) : null}
            
            {applicant.phone ? (
              <div className="flex items-center">
                <span className="font-medium min-w-12">{t('profile.phone')}:</span>
                <span className="ml-2">{applicant.phone}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* 2사분면: 사전질문 답변 */}
        <div className="space-y-3">
          <div className="border-l-2 border-gray-200 pl-3">
            <h5 className="font-medium text-gray-800 text-sm mb-2">📝 사전질문 답변</h5>
            <PreQuestionDisplay applicant={applicant} />
          </div>
        </div>

        {/* 3-4사분면: 선택 시간 표시 및 체크박스 영역 */}
        <div className="lg:col-span-2">
          {(() => {
            const applicantSelections = getApplicantSelections(applicant, jobPosting);
            
            // 확정된 상태일 때만 지원 정보 표시
            if (applicant.status === 'confirmed' && applicantSelections.length > 0) {
              // 🎯 선택 사항을 그룹과 개별로 분류
              const processedApplications = new Map<string, any>();
              
              applicantSelections.forEach((selection: any) => {
                // checkMethod가 'group'이고 dates가 여러 개인 경우 그룹으로 처리
                if (selection.checkMethod === 'group' && selection.dates && selection.dates.length > 1) {
                  const groupKey = `group-${selection.groupId || selection.time}`;
                  
                  if (!processedApplications.has(groupKey)) {
                    processedApplications.set(groupKey, {
                      displayDateRange: `${formatDateDisplay(selection.dates[0])}~${formatDateDisplay(selection.dates[selection.dates.length - 1])}`,
                      dayCount: selection.dates.length,
                      time: selection.time,
                      roles: [],
                      isGrouped: true,
                      checkMethod: 'group'
                    });
                  }
                  
                  const group = processedApplications.get(groupKey)!;
                  if (selection.role && !group.roles.includes(selection.role)) {
                    group.roles.push(selection.role);
                  }
                } else {
                  // 개별 선택 처리
                  const dateKey = selection.date || selection.dates?.[0] || 'no-date';
                  const individualKey = `individual-${dateKey}-${selection.time}`;
                  
                  if (!processedApplications.has(individualKey)) {
                    processedApplications.set(individualKey, {
                      displayDateRange: formatDateDisplay(dateKey),
                      time: selection.time,
                      roles: [],
                      isGrouped: false,
                      checkMethod: 'individual'
                    });
                  }
                  
                  const individual = processedApplications.get(individualKey)!;
                  if (selection.role && !individual.roles.includes(selection.role)) {
                    individual.roles.push(selection.role);
                  }
                }
              });
              
              const allApplications = Array.from(processedApplications.values());
              
              return (
                <div className="mb-4 p-4 rounded-lg border bg-green-50 border-green-200">
                  <div className="space-y-3 mb-4">
                    {allApplications.map((group, groupIndex) => {
                      return (
                        <div key={groupIndex} className="bg-white p-3 rounded border">
                          <div className="mb-2">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md bg-green-100 text-green-800">
                                📅 {group.displayDateRange}
                                {group.isGrouped && group.dayCount && <span className="ml-1">({group.dayCount}일)</span>}
                              </span>
                              {group.isGrouped && (
                                <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-purple-100 text-purple-700">
                                  📋
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className={`font-medium ${group.time && group.time !== '미정' && group.time !== '시간 미정' ? 'text-gray-700' : 'text-red-500'}`}>
                              ⏰ {group.time}
                            </span>
                            <span className="text-gray-500">-</span>
                            <div className="font-medium text-gray-800">
                              {group.isGrouped ? (
                                // 그룹 선택: 역할들을 배지로 표시
                                <div className="flex flex-wrap gap-1">
                                  {group.roles.map((role: string, roleIndex: number) => (
                                    role ? (
                                      <span key={roleIndex} className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-sm">
                                        👤 {t(`roles.${role}`) || role}
                                      </span>
                                    ) : null
                                  ))}
                                </div>
                              ) : (
                                // 개별 선택: 역할들을 쉼표로 구분
                                <span>
                                  👤 {group.roles.filter((role: string) => role).map((role: string) => t(`roles.${role}`) || role).join(', ')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }
            
            // 기존 단일 선택 지원자 표시 (확정된 상태에서만)
            if (applicant.status === 'confirmed' && (applicant.assignedDate || applicant.assignedTime || applicant.assignedRole)) {
              return (
                <div className="mb-4 p-4 rounded-lg bg-green-50 border border-green-200">
                  <div className="text-sm bg-white p-2 rounded border mb-4">
                    {applicant.assignedDate ? 
                      <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md mr-2 bg-green-100 text-green-800">
                        📅 {formatDateDisplay(applicant.assignedDate)}
                      </span> : null
                    }
                    <span className="font-medium text-gray-700">{applicant.assignedTime}</span>
                    {applicant.assignedRole && (
                      <>
                        <span className="text-gray-600 mx-1">-</span>
                        <span className="font-medium text-gray-800">
                          {applicant.assignedRole && (t(`roles.${applicant.assignedRole}`) || applicant.assignedRole)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            }
            
            // 확정되지 않은 상태에서는 체크박스만 표시
            if (applicant.status !== 'confirmed') {
              return (
                <div>
                  {children}
                </div>
              );
            }
            
            return null;
          })()}
        </div>
      </div>

      {/* 스태프 프로필 모달 */}
      <StaffProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        staff={staffData}
      />
    </div>
  );
};

export default ApplicantCard;