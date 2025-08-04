import React from 'react';
import { useTranslation } from 'react-i18next';
import { Applicant } from './types';
import PreQuestionDisplay from './PreQuestionDisplay';
import { getApplicantSelections, formatDateDisplay } from './utils/applicantHelpers';

interface ApplicantCardProps {
  applicant: Applicant;
  children?: React.ReactNode; // 액션 버튼들을 위한 children
}

/**
 * 개별 지원자 정보를 표시하는 카드 컴포넌트 (2x2 그리드 레이아웃)
 */
const ApplicantCard: React.FC<ApplicantCardProps> = ({ applicant, children }) => {
  const { t } = useTranslation();

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
      {/* 2x2 그리드 레이아웃 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        
        {/* 1사분면: 기본 정보 */}
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium text-gray-900 text-base">{applicant.applicantName}</h4>
              <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs ${
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
                    const dateStr = typeof applicant.appliedAt === 'string' 
                      ? applicant.appliedAt 
                      : applicant.appliedAt?.toDate?.()?.toISOString?.()?.split('T')?.[0] || '';
                    return formatDateDisplay(dateStr);
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

        {/* 3-4사분면: 확정 시간 선택 (날짜별 배치) */}
        <div className="lg:col-span-2">
          {/* 확정된 경우 선택 정보 표시 */}
          {applicant.status === 'confirmed' && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center mb-3">
                <span className="text-lg">✅</span>
                <p className="font-semibold text-green-800 ml-2">{t('jobPostingAdmin.applicants.confirmed')}</p>
              </div>
              {(() => {
                const confirmedSelections = getApplicantSelections(applicant);
                if (confirmedSelections.length > 0) {
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {confirmedSelections.map((selection, index) => {
                        const confirmedSafeDateString = selection.date || '';
                        return (
                          <div key={index} className="flex items-center gap-2 text-sm bg-white p-2 rounded border">
                            {confirmedSafeDateString ? 
                              <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-md">
                                📅 {formatDateDisplay(confirmedSafeDateString)}
                              </span> : null
                            }
                            <div className="flex items-center gap-1">
                              <span className={`font-medium ${selection.time ? 'text-gray-700' : 'text-red-500'}`}>
                                {selection.time || '미정'}
                              </span>
                              <span className="text-gray-500">-</span>
                              <span className="font-medium text-gray-800">
                                {t(`jobPostingAdmin.create.${selection.role}`) || selection.role}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                }
                
                // 기존 단일 선택 지원자 표시 (하위 호환성)
                return (
                  <div className="text-sm bg-white p-2 rounded border">
                    {applicant.assignedDate ? 
                      <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-md mr-2">
                        📅 {formatDateDisplay(applicant.assignedDate)}
                      </span> : null
                    }
                    <span className="font-medium text-gray-700">{applicant.assignedTime}</span>
                    <span className="text-gray-600 mx-1">-</span>
                    <span className="font-medium text-gray-800">
                      {applicant.assignedRole ? t(`jobPostingAdmin.create.${applicant.assignedRole}`) : applicant.assignedRole}
                    </span>
                  </div>
                );
              })()}
            </div>
          )}
          
          {/* 확정 시간 선택 영역 (3-4사분면) */}
          {children}
        </div>
      </div>
    </div>
  );
};

export default ApplicantCard;