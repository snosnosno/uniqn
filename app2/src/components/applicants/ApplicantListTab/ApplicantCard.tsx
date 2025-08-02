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
 * 개별 지원자 정보를 표시하는 카드 컴포넌트
 */
const ApplicantCard: React.FC<ApplicantCardProps> = ({ applicant, children }) => {
  const { t } = useTranslation();

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-2 sm:p-3">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div>
            <h4 className="font-medium text-gray-900">{applicant.applicantName}</h4>
            <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs ${
              applicant.status === 'confirmed' ? 'bg-green-100 text-green-800' :
              applicant.status === 'rejected' ? 'bg-red-100 text-red-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {t(`jobPostingAdmin.applicants.status_${applicant.status}`)}
            </span>
          </div>
          <div className="mt-2 text-sm text-gray-600 space-y-1">
            {applicant.appliedAt && (
              <p>
                <span className="font-medium">지원:</span>
                <span className="ml-2">
                  {(() => {
                    const dateStr = typeof applicant.appliedAt === 'string' 
                      ? applicant.appliedAt 
                      : applicant.appliedAt?.toDate?.()?.toISOString?.()?.split('T')?.[0] || '';
                    return formatDateDisplay(dateStr);
                  })()}
                </span>
              </p>
            )}
            {applicant.gender ? (
              <p>
                <span className="font-medium">{t('profile.gender')}:</span> 
                <span className="ml-1">
                  {applicant.gender.toLowerCase() === 'male' 
                    ? t('gender.male') 
                    : applicant.gender.toLowerCase() === 'female' 
                    ? t('gender.female') 
                    : applicant.gender}
                </span>
              </p>
            ) : null}
            {applicant.age ? <p><span className="font-medium">{t('profile.age')}:</span> {applicant.age}</p> : null}
            {applicant.experience ? <p><span className="font-medium">{t('profile.experience')}:</span> {applicant.experience}</p> : null}
            {applicant.email ? <p><span className="font-medium">{t('profile.email')}:</span> {applicant.email}</p> : null}
            {applicant.phone ? (
              <div>
                <span className="font-medium">{t('profile.phone')}:</span>
                <br />
                <span>{applicant.phone}</span>
              </div>
            ) : null}
            
            {/* 사전질문 답변 표시 */}
            <PreQuestionDisplay applicant={applicant} />
          </div>
        </div>

        <div className="ml-4">
          {/* 확정된 경우 선택 정보 표시 */}
          {applicant.status === 'confirmed' && (
            <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="font-semibold text-green-800 mb-2">{t('jobPostingAdmin.applicants.confirmed')}</p>
              {(() => {
                const confirmedSelections = getApplicantSelections(applicant);
                if (confirmedSelections.length > 0) {
                  return (
                    <div className="space-y-2">
                      {confirmedSelections.map((selection, index) => {
                        const confirmedSafeDateString = selection.date || '';
                        return (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            {confirmedSafeDateString ? 
                              <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-md">
                                {formatDateDisplay(confirmedSafeDateString)}
                              </span> : null
                            }
                            <span className={`font-medium ${selection.time ? 'text-gray-700' : 'text-red-500'}`}>
                              {selection.time || '미정'}
                            </span>
                            <span className="text-gray-600">-</span>
                            <span className="font-medium text-gray-800">
                              {t(`jobPostingAdmin.create.${selection.role}`) || selection.role}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                }
                
                // 기존 단일 선택 지원자 표시 (하위 호환성)
                return (
                  <div className="text-sm">
                    {applicant.assignedDate ? 
                      <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-md mr-2">
                        {formatDateDisplay(applicant.assignedDate)}
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
          
          {/* 액션 버튼들을 위한 영역 */}
          {children}
        </div>
      </div>
    </div>
  );
};

export default ApplicantCard;