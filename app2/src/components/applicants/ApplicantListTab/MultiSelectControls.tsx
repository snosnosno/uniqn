import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { logger } from '../../../utils/logger';
import { TimeSlot, DateSpecificRequirement, JobPostingUtils } from '../../../types/jobPosting';
import { timestampToLocalDateString } from '../../../utils/dateUtils';
import { Applicant, Assignment } from './types';
import { 
  getApplicantSelectionsByDate, 
  getDateSelectionStats
} from './utils/applicantHelpers';

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
 * 지원자의 다중 선택을 처리하는 컴포넌트 (날짜별 UI)
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
  
  // 날짜별 그룹화된 선택 사항 (메모이제이션)
  const dateGroupedSelections = useMemo(() => {
    const groups = getApplicantSelectionsByDate(applicant);
    
    // 각 그룹의 선택된 개수 계산
    return groups.map(group => {
      const stats = getDateSelectionStats(
        group.selections, 
        selectedAssignments, 
        group.date
      );
      return {
        ...group,
        selectedCount: stats.selectedCount
      };
    });
  }, [applicant, selectedAssignments]);
  
  if (dateGroupedSelections.length === 0) {
    return null;
  }

  const totalSelectedCount = selectedAssignments.length;
  const totalCount = dateGroupedSelections.reduce((sum, group) => sum + group.totalCount, 0);

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
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="text-sm font-medium text-gray-700 mb-3">
        ✅ 확정할 시간 선택
        <br />
        <span className="text-xs text-gray-500">
          (총 {totalCount}개 중 {totalSelectedCount}개)
        </span>
      </div>

      {/* 날짜별 섹션 */}
      <div className="space-y-4">
        {dateGroupedSelections.map((dateGroup, groupIndex) => (
          <div key={`${dateGroup.date}-${groupIndex}`} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* 날짜 헤더 */}
            <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-base">📅</span>
                  <span className="text-sm font-medium text-gray-800">
                    {dateGroup.date === 'no-date' ? '날짜 미정' : dateGroup.displayDate}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {dateGroup.selectedCount}개 선택됨
                </span>
              </div>
            </div>

            {/* 선택 항목들 */}
            <div className="divide-y divide-gray-100">
              {dateGroup.selections.map((selection, selectionIndex) => {
                const safeDateString = selection.date || '';
                const optionValue = safeDateString.trim() !== '' 
                  ? `${safeDateString}__${selection.time}__${selection.role}`
                  : `${selection.time}__${selection.role}`;
                
                const isSelected = isAssignmentSelected(selection.time, selection.role, safeDateString);
                
                // 같은 날짜에 이미 다른 항목이 선택되었는지 확인
                const hasOtherSelectionInSameDate = safeDateString.trim() !== '' && 
                  selectedAssignments.some(assignment => 
                    assignment.date === safeDateString && 
                    !(assignment.timeSlot === selection.time && assignment.role === selection.role)
                  );
                
                // 역할이 마감되었는지 확인
                const isFull = safeDateString 
                  ? JobPostingUtils.isRoleFull(
                      jobPosting,
                      selection.time,
                      selection.role,
                      safeDateString
                    )
                  : false;
                
                // 선택 불가능한 상태 (마감 또는 같은 날짜에 다른 선택이 있는 경우)
                const isDisabled = isFull || hasOtherSelectionInSameDate;
                
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
                  
                  // "미정" 시간대의 경우 특별 처리
                  if (selection.time === '미정' && requiredCount === 0) {
                    const undefinedTimeSlot = dateReq?.timeSlots.find((t: TimeSlot) => t.isTimeToBeAnnounced || t.time === '미정');
                    const roleReqUndefined = undefinedTimeSlot?.roles.find((r: any) => r.name === selection.role);
                    requiredCount = roleReqUndefined?.count || 0;
                  }
                }

                return (
                  <div 
                    key={`${groupIndex}-${selectionIndex}`}
                    className={`flex items-center justify-between p-3 ${
                      isDisabled 
                        ? 'bg-gray-100 cursor-not-allowed opacity-60' 
                        : isSelected 
                        ? 'bg-green-50 hover:bg-green-100 cursor-pointer' 
                        : 'bg-white hover:bg-gray-50 cursor-pointer'
                    }`}
                    onClick={() => !isDisabled && onAssignmentToggle(optionValue, !isSelected)}
                  >
                    {/* 왼쪽: 체크박스와 역할 정보 */}
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      {/* 체크박스 */}
                      <div className="flex-shrink-0">
                        {isDisabled ? (
                          <div className="w-4 h-4 bg-gray-300 rounded border border-gray-400 flex items-center justify-center">
                            <span className="text-xs text-gray-600">
                              {isFull ? '×' : hasOtherSelectionInSameDate ? '!' : '×'}
                            </span>
                          </div>
                        ) : (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // onClick으로 처리
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500 focus:ring-2"
                          />
                        )}
                      </div>
                      
                      {/* 역할 정보 */}
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-medium truncate ${
                          isDisabled ? 'text-gray-500' : 'text-gray-900'
                        }`}>
                          {t(`jobPostingAdmin.create.${selection.role}`) || selection.role}
                        </span>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className={`text-xs ${
                            isDisabled ? 'text-red-600 font-medium' : 'text-gray-500'
                          }`}>
                            ({confirmedCount}/{requiredCount})
                          </span>
                          {isFull && (
                            <span className="text-xs text-red-600 font-medium">마감</span>
                          )}
                          {hasOtherSelectionInSameDate && !isFull && (
                            <span className="text-xs text-orange-600 font-medium">날짜 중복</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 오른쪽: 시간 드롭다운 */}
                    <div className="flex-shrink-0 ml-2">
                      <select
                        value={selection.time}
                        disabled={isDisabled}
                        onChange={(e) => handleTimeChange(selectionIndex, e.target.value)}
                        className={`text-xs border border-gray-300 rounded px-2 py-1 min-w-[4rem] ${
                          isDisabled ? 'bg-gray-100 cursor-not-allowed text-gray-500' : 'bg-white'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* 사용 가능한 시간대 옵션들 */}
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
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 확정 버튼 */}
      <div className="pt-2">
        <button 
          onClick={onConfirm}
          className="w-full sm:w-auto px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          disabled={totalSelectedCount === 0 || !canEdit}
        >
          ✓ 선택한 시간 확정 ({totalSelectedCount}개)
        </button>
      </div>
    </div>
  );
};

export default React.memo(MultiSelectControls);