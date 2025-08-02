import React from 'react';
import { useTranslation } from 'react-i18next';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { logger } from '../../../utils/logger';
import { TimeSlot, DateSpecificRequirement, JobPostingUtils } from '../../../types/jobPosting';
import { timestampToLocalDateString } from '../../../utils/dateUtils';
import { Applicant, Assignment } from './types';
import { getApplicantSelections, formatDateDisplay } from './utils/applicantHelpers';

interface MultiSelectControlsProps {
  applicant: Applicant;
  jobPosting: any;
  selectedAssignments: Assignment[];
  onAssignmentToggle: (value: string, isChecked: boolean) => void;
  onConfirm: () => void;
  canEdit: boolean;
  onRefresh: () => void;
}

/**
 * 지원자의 다중 선택을 처리하는 컴포넌트
 */
const MultiSelectControls: React.FC<MultiSelectControlsProps> = ({
  applicant,
  jobPosting,
  selectedAssignments,
  onAssignmentToggle,
  onConfirm,
  canEdit,
  onRefresh
}) => {
  const { t } = useTranslation();
  const selections = getApplicantSelections(applicant);
  
  if (selections.length === 0) {
    return null;
  }

  const selectedCount = selectedAssignments.length;

  /**
   * 특정 assignment가 선택되었는지 확인하는 함수
   */
  const isAssignmentSelected = (timeSlot: string, role: string, date?: string): boolean => {
    const normalizedDate = (date || '').trim();
    const normalizedTimeSlot = timeSlot.trim();
    const normalizedRole = role.trim();
    
    return selectedAssignments.some(assignment => 
      assignment.timeSlot === normalizedTimeSlot && 
      assignment.role === normalizedRole && 
      assignment.date === normalizedDate
    );
  };

  /**
   * 지원 시간을 수정하는 함수
   */
  const handleTimeChange = async (index: number, newTime: string) => {
    if (!jobPosting || !newTime) return;

    try {
      const applicationRef = doc(db, "applications", applicant.id);
      
      // assignedTimes 배열에서 해당 인덱스의 시간 업데이트
      const updatedTimes = applicant.assignedTimes ? [...applicant.assignedTimes] : [];
      if (updatedTimes.length > index) {
        updatedTimes[index] = newTime;
      } else {
        // 배열 크기가 부족하면 빈 값으로 채우고 해당 인덱스에 설정
        while (updatedTimes.length <= index) {
          updatedTimes.push('');
        }
        updatedTimes[index] = newTime;
      }
      
      await updateDoc(applicationRef, {
        assignedTimes: updatedTimes,
        assignedTime: index === 0 ? newTime : applicant.assignedTime // 첫 번째 시간만 단일 필드 업데이트
      });
      
      // 지원자 목록 새로고침
      onRefresh();
      
      alert('지원 시간이 성공적으로 수정되었습니다.');
    } catch (error) {
      logger.error('Error updating application time:', error instanceof Error ? error : new Error(String(error)), { 
        component: 'MultiSelectControls' 
      });
      alert('지원 시간 수정 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="ml-4 space-y-3">
      <div className="text-sm font-medium text-gray-700 mb-2">
        ✅ 확정할 시간대 선택 ({selections.length}개 옵션 중 {selectedCount}개 선택):
      </div>
      <div className="space-y-2">
        {selections.map((selection, index) => {
          const safeDateString = selection.date || '';
          const optionValue = safeDateString.trim() !== '' 
            ? `${safeDateString}__${selection.time}__${selection.role}`
            : `${selection.time}__${selection.role}`;
          
          const isSelected = isAssignmentSelected(selection.time, selection.role, safeDateString);
          
          // 역할이 마감되었는지 확인
          const isFull = JobPostingUtils.isRoleFull(
            jobPosting,
            selection.time,
            selection.role,
            safeDateString || undefined
          );
          
          // 해당 역할의 확정 인원 수 계산
          const confirmedCount = safeDateString 
            ? JobPostingUtils.getConfirmedStaffCount(jobPosting, safeDateString, selection.time, selection.role)
            : (jobPosting.confirmedStaff?.filter((staff: any) => 
                staff.timeSlot === selection.time && staff.role === selection.role
              ).length || 0);
          
          // 필요 인원 수 계산
          let requiredCount = 0;
          
          if (safeDateString && jobPosting.dateSpecificRequirements) {
            const dateReq = jobPosting.dateSpecificRequirements.find((dr: DateSpecificRequirement) => {
              const drDateString = timestampToLocalDateString(dr.date);
              return drDateString === safeDateString;
            });
            const ts = dateReq?.timeSlots.find((t: TimeSlot) => t.time === selection.time);
            const roleReq = ts?.roles.find((r: any) => r.name === selection.role);
            requiredCount = roleReq?.count || 0;
          } else if (jobPosting.timeSlots) {
            const ts = jobPosting.timeSlots.find((t: TimeSlot) => t.time === selection.time);
            const roleReq = ts?.roles.find((r: any) => r.name === selection.role);
            requiredCount = roleReq?.count || 0;
          }
          
          // "미정" 시간대의 경우 특별 처리
          if (selection.time === '미정' && requiredCount === 0) {
            if (safeDateString && jobPosting.dateSpecificRequirements) {
              const dateReq = jobPosting.dateSpecificRequirements.find((dr: DateSpecificRequirement) => dr.date === safeDateString);
              const undefinedTimeSlot = dateReq?.timeSlots.find((t: TimeSlot) => t.isTimeToBeAnnounced || t.time === '미정');
              const roleReq = undefinedTimeSlot?.roles.find((r: any) => r.name === selection.role);
              requiredCount = roleReq?.count || 0;
            } else if (jobPosting.timeSlots) {
              const undefinedTimeSlot = jobPosting.timeSlots.find((t: TimeSlot) => t.isTimeToBeAnnounced || t.time === '미정');
              const roleReq = undefinedTimeSlot?.roles.find((r: any) => r.name === selection.role);
              requiredCount = roleReq?.count || 0;
            }
          }
            
          return (
            <div key={index} className={`flex items-center justify-between p-2 border rounded ${
              isFull ? 'bg-gray-100 border-gray-300' :
              isSelected ? 'bg-green-50 border-green-300' : 
              'bg-white border-gray-200'
            }`}>
              <label className={`flex items-center ${isFull ? 'cursor-not-allowed' : 'cursor-pointer'} flex-1`}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={isFull}
                  onChange={(e) => onAssignmentToggle(optionValue, e.target.checked)}
                  className={`h-4 w-4 ${isFull ? 'text-gray-400' : 'text-green-600'} focus:ring-green-500 border-gray-300 rounded ${isFull ? 'cursor-not-allowed' : ''}`}
                />
                <div className="ml-3 flex-1">
                  <div className="flex items-center space-x-2 text-sm">
                    {safeDateString ? 
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                        📅 {formatDateDisplay(safeDateString)}
                      </span> : null
                    }
                    <span className={isFull ? "text-gray-500" : "text-gray-700"}>⏰ {selection.time}</span>
                    <span className={isFull ? "text-gray-500" : "text-gray-700"}>👤 {t(`jobPostingAdmin.create.${selection.role}`) || selection.role}</span>
                    <span className={`ml-2 text-xs ${isFull ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                      ({confirmedCount}/{requiredCount} {isFull ? '- 마감' : ''})
                    </span>
                  </div>
                </div>
              </label>
              
              {/* 시간 수정 드롭다운 */}
              <select
                value={selection.time}
                disabled={isFull}
                onChange={(e) => handleTimeChange(index, e.target.value)}
                className={`text-xs border border-gray-300 rounded px-2 py-1 ml-2 ${isFull ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                onClick={(e) => e.stopPropagation()}
              >
                {/* 사용 가능한 시간대 옵션들 */}
                {jobPosting?.timeSlots?.map((ts: TimeSlot) => (
                  <option key={ts.time} value={ts.time}>
                    {ts.time}
                  </option>
                ))}
                {jobPosting?.dateSpecificRequirements?.flatMap((dateReq: DateSpecificRequirement) => {
                  const dateString = timestampToLocalDateString(dateReq.date);
                  return dateReq.timeSlots.map((ts: TimeSlot) => (
                    <option key={`${dateString}-${ts.time}`} value={ts.time}>
                      {ts.time}
                    </option>
                  ));
                })}
              </select>
            </div>
          );
        })}
      </div>
      <button 
        onClick={onConfirm}
        className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
        disabled={selectedCount === 0 || !canEdit}
      >
        ✓ 선택한 시간대로 확정 ({selectedCount}개)
      </button>
    </div>
  );
};

export default MultiSelectControls;