import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Applicant } from './types';
import PreQuestionDisplay from './PreQuestionDisplay';
import { 
  getApplicantSelections, 
  formatDateDisplay
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
    <div className="bg-white border border-gray-200 rounded-lg p-1.5 sm:p-2.5">
      {/* 모바일 최적화된 레이아웃 */}
      <div className="space-y-2">
        
        {/* 상단: 이름, 프로필 보기 버튼, 상태 */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-gray-900 text-base">
              {applicant.applicantName}
            </h4>
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md transition-colors"
            >
              (프로필 보기)
            </button>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs ${
            applicant.status === 'confirmed' ? 'bg-green-100 text-green-800' :
            applicant.status === 'cancelled' ? 'bg-red-100 text-red-800' :
            'bg-yellow-100 text-yellow-800'
          }`}>
            {t(`jobPostingAdmin.applicants.status_${applicant.status}`)}
          </span>
        </div>
        
        {/* 기본 정보: 2x2 컴팩트 그리드 */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-gray-600">
          <div>
            <span className="font-medium">{t('profile.gender')}:</span>
            <span className="ml-1">
              {applicant.gender ? (
                applicant.gender.toLowerCase() === 'male' 
                  ? t('gender.male') 
                  : applicant.gender.toLowerCase() === 'female' 
                  ? t('gender.female') 
                  : applicant.gender
              ) : '없음'}
            </span>
          </div>
          
          <div>
            <span className="font-medium">{t('profile.age')}:</span>
            <span className="ml-1">{applicant.age || '없음'}</span>
          </div>
          
          <div>
            <span className="font-medium">지역:</span>
            <span className="ml-1">없음</span>
          </div>
          
          <div>
            <span className="font-medium">{t('profile.experience')}:</span>
            <span className="ml-1">{applicant.experience || '없음'}</span>
          </div>
        </div>
        
        {/* 연락처 정보: 한 줄로 컴팩트하게 */}
        <div className="text-sm text-gray-600 space-y-1">
          <div>
            <span className="font-medium">{t('profile.email')}:</span>
            <span className="ml-1 text-xs break-all">{applicant.email || '없음'}</span>
          </div>
          <div>
            <span className="font-medium">{t('profile.phone')}:</span>
            <span className="ml-1">{applicant.phone || '없음'}</span>
          </div>
        </div>

        {/* 사전질문 답변: 컴팩트하게 */}
        <div className="border-l-2 border-gray-200 pl-2">
          <PreQuestionDisplay applicant={applicant} />
        </div>

        {/* 하단: 선택 시간 표시 및 체크박스 영역 */}
        <div>
          {(() => {
            const applicantSelections = getApplicantSelections(applicant, jobPosting);
            
            // 확정된 상태일 때 지원 정보와 버튼을 모두 표시
            if (applicant.status === 'confirmed') {
              return (
                <div className="space-y-2">
                  {/* 지원 정보 표시 (applicantSelections가 있는 경우) */}
                  {applicantSelections.length > 0 && (() => {
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
                      <div className="mt-2 p-2 rounded-lg border bg-green-50 border-green-200">
                        <div className="space-y-1">
                          {allApplications.map((group, groupIndex) => {
                            return (
                              <div key={groupIndex} className="bg-white p-2 rounded border text-sm font-medium text-gray-700">
                                📅 {group.displayDateRange} ⏰ {group.time} 👤 {group.roles.filter((role: string) => role).map((role: string) => t(`roles.${role}`) || role).join(', ')}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                  
                  {/* 기존 단일 선택 지원자 표시 */}
                  {applicantSelections.length === 0 && (applicant.assignedDate || applicant.assignedTime || applicant.assignedRole) && (
                    <div className="mt-2 p-2 rounded-lg bg-green-50 border border-green-200">
                      <div className="text-sm bg-white p-2 rounded border font-medium text-gray-700">
                        📅 {applicant.assignedDate ? formatDateDisplay(applicant.assignedDate) : ''} ⏰ {applicant.assignedTime} 👤 {applicant.assignedRole ? (t(`roles.${applicant.assignedRole}`) || applicant.assignedRole) : ''}
                      </div>
                    </div>
                  )}
                  
                  {/* 확정취소 버튼 등 children 표시 */}
                  {children && (
                    <div>
                      {children}
                    </div>
                  )}
                </div>
              );
            }
            
            // 확정되지 않은 상태에서는 체크박스만 표시
            return (
              <div>
                {children}
              </div>
            );
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