import React from 'react';
import { useTranslation } from 'react-i18next';
import { TimeSlot, RoleRequirement, DateSpecificRequirement, JobPostingUtils } from '../../../types/jobPosting';
import { timestampToLocalDateString } from '../../../utils/dateUtils';
import { Applicant, Assignment } from './types';
import { formatDateDisplay } from './utils/applicantHelpers';

interface ApplicantActionsProps {
  applicant: Applicant;
  jobPosting: any;
  selectedAssignment: Assignment | null;
  onAssignmentChange: (value: string) => void;
  onConfirm: () => void;
  onCancelConfirmation: () => void;
  canEdit: boolean;
}

/**
 * 지원자 확정/취소 액션 버튼들을 표시하는 컴포넌트
 */
const ApplicantActions: React.FC<ApplicantActionsProps> = ({
  applicant,
  jobPosting,
  selectedAssignment,
  onAssignmentChange,
  onConfirm,
  onCancelConfirmation,
  canEdit
}) => {
  const { t } = useTranslation();

  // 지원 중인 상태 - 단일 선택 드롭다운
  if (applicant.status === 'applied') {
    return (
      <div className="ml-4 flex items-center space-x-2">
        <select
          value={''}
          onChange={(e) => onAssignmentChange(e.target.value)}
          className="text-sm border border-gray-300 rounded px-2 py-1"
        >
          <option value="" disabled>{t('jobPostingAdmin.applicants.selectRole')}</option>
          
          {/* 날짜별 요구사항 */}
          {jobPosting?.dateSpecificRequirements?.flatMap((dateReq: DateSpecificRequirement) =>
            dateReq.timeSlots.flatMap((ts: TimeSlot) =>
              ts.roles.map((r: RoleRequirement) => {
                const dateString = timestampToLocalDateString(dateReq.date);
                const isFull = JobPostingUtils.isRoleFull(jobPosting, ts.time, r.name, dateString);
                const confirmedCount = JobPostingUtils.getConfirmedStaffCount(jobPosting, dateString, ts.time, r.name);
                
                return (
                  <option 
                    key={`${dateString}-${ts.time}-${r.name}`} 
                    value={`${dateString}__${ts.time}__${r.name}`}
                    disabled={isFull}
                  >
                    📅 {formatDateDisplay(dateString)} | {ts.time} - {t(`jobPostingAdmin.create.${r.name}`, r.name)} 
                    ({confirmedCount}/{r.count}{isFull ? ' - 마감' : ''})
                  </option>
                );
              })
            )
          )}
          
          {/* 기존 방식 timeSlots */}
          {jobPosting?.timeSlots?.flatMap((ts: TimeSlot) => 
            ts.roles.map((r: RoleRequirement) => {
              const isFull = JobPostingUtils.isRoleFull(jobPosting, ts.time, r.name);
              const confirmedCount = jobPosting.confirmedStaff?.filter((staff: any) => 
                staff.timeSlot === ts.time && staff.role === r.name
              ).length || 0;
              return (
                <option 
                  key={`${ts.time}-${r.name}`} 
                  value={`${ts.time}__${r.name}`}
                  disabled={isFull}
                >
                  {ts.time} - {t(`jobPostingAdmin.create.${r.name}`, r.name)}
                  ({confirmedCount}/{r.count}{isFull ? ' - 마감' : ''})
                </option>
              );
            })
          )}
        </select>
        <button 
          onClick={onConfirm}
          className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
          disabled={!selectedAssignment}
        >
          {t('jobPostingAdmin.applicants.confirm')}
        </button>
      </div>
    );
  }

  // 확정된 상태 - 취소 버튼
  if (applicant.status === 'confirmed') {
    return (
      <div className="ml-4 text-sm space-y-2">
        <div className="flex space-x-2">
          <button 
            onClick={onCancelConfirmation}
            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            disabled={!canEdit}
          >
            ❌ 확정 취소
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default ApplicantActions;