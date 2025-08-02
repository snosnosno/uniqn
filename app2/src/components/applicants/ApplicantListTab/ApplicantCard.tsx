import React from 'react';
import { useTranslation } from 'react-i18next';
import { Applicant } from './types';
import PreQuestionDisplay from './PreQuestionDisplay';
import { formatDate as formatDateUtil } from '../../../utils/jobPosting/dateUtils';
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
    <div className="bg-white border border-gray-200 rounded-lg p-4">
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
                <span className="ml-2">{formatDateUtil(applicant.appliedAt)}</span>
              </p>
            )}
            {applicant.gender ? <p><span className="font-medium">{t('profile.gender')}:</span> {applicant.gender}</p> : null}
            {applicant.age ? <p><span className="font-medium">{t('profile.age')}:</span> {applicant.age}</p> : null}
            {applicant.experience ? <p><span className="font-medium">{t('profile.experience')}:</span> {applicant.experience}</p> : null}
            {applicant.email ? <p><span className="font-medium">{t('profile.email')}:</span> {applicant.email}</p> : null}
            {applicant.phone ? <p><span className="font-medium">{t('profile.phone')}:</span> {applicant.phone}</p> : null}
            
            {/* 확정된 경우 선택 정보 표시 */}
            {applicant.status === 'confirmed' && (
              <div className="mt-2 text-green-600">
                <p className="font-medium">{t('jobPostingAdmin.applicants.confirmed')}</p>
                {(() => {
                  const confirmedSelections = getApplicantSelections(applicant);
                  if (confirmedSelections.length > 0) {
                    return (
                      <div className="space-y-1">
                        {confirmedSelections.map((selection, index) => {
                          const confirmedSafeDateString = selection.date || '';
                          return (
                            <div key={index} className="flex items-center space-x-2">
                              {confirmedSafeDateString ? 
                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                                  📅 {formatDateDisplay(confirmedSafeDateString)}
                                </span> : null
                              }
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
                      {applicant.assignedDate ? 
                        <span className="text-blue-600 font-medium">
                          📅 {formatDateDisplay(applicant.assignedDate)} | 
                        </span> : null
                      }
                      {applicant.assignedTime} - {applicant.assignedRole ? t(`jobPostingAdmin.create.${applicant.assignedRole}`) : applicant.assignedRole}
                    </p>
                  );
                })()}
              </div>
            )}
            
            {/* 사전질문 답변 표시 */}
            <PreQuestionDisplay applicant={applicant} />
          </div>
        </div>

        {/* 액션 버튼들을 위한 영역 */}
        {children}
      </div>
    </div>
  );
};

export default ApplicantCard;