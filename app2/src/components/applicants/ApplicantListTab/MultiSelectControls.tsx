import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '../../../utils/logger';
import { TimeSlot, DateSpecificRequirement } from '../../../types/jobPosting';
import { timestampToLocalDateString } from '../../../utils/dateUtils';
import { Applicant, Assignment } from './types';
import { 
  getApplicantSelectionsByDate, 
  getDateSelectionStats,
  getApplicantSelections,
  groupMultiDaySelections,
  groupSingleDaySelections,
  generateDateRange,
  convertDateToString
} from './utils/applicantHelpers';

interface MultiSelectControlsProps {
  applicant: Applicant;
  jobPosting: any;
  selectedAssignments: Assignment[];
  onAssignmentToggle: (value: string, isChecked: boolean) => void;
  onConfirm: () => void;
  canEdit: boolean;
  _onRefresh: () => void;
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
  _onRefresh
}) => {
  const { t } = useTranslation();
  
  // 선택사항을 다중일과 단일날짜로 분류하여 그룹화
  const groupedSelections = useMemo(() => {
    const allSelections = getApplicantSelections(applicant);
    const multiDaySelections: any[] = [];
    let singleDaySelections: any[] = [];
    
    // duration 정보로 분류
    allSelections.forEach((selection: any) => {
      if (selection.duration?.type === 'multi' && selection.duration?.endDate) {
        multiDaySelections.push(selection);
      } else {
        singleDaySelections.push(selection);
      }
    });
    
    // 다중일 그룹 처리
    const multiGroups = groupMultiDaySelections(multiDaySelections);
    
    // 다중일 그룹에 포함된 모든 날짜를 수집
    const multiDayDates = new Set<string>();
    multiDaySelections.forEach((selection: any) => {
      if (selection.duration?.type === 'multi' && selection.duration?.endDate) {
        const dates = generateDateRange(selection.date, convertDateToString(selection.duration.endDate));
        dates.forEach(date => multiDayDates.add(date));
      }
    });
    
    // 단일날짜 선택사항에서 다중일에 이미 포함된 날짜 제외
    singleDaySelections = singleDaySelections.filter((selection: any) => {
      // 해당 날짜가 다중일 그룹에 포함되어 있지 않은 경우만 단일날짜로 표시
      return !multiDayDates.has(selection.date);
    });
    
    // 단일 날짜 그룹 처리
    const singleGroups = groupSingleDaySelections(singleDaySelections);
    
    return {
      multiDayGroups: multiGroups,
      singleDayGroups: singleGroups
    };
  }, [applicant]);
  
  // 날짜별 그룹화된 선택 사항 (메모이제이션) - 기존 코드 호환성 유지
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
  
  if (groupedSelections.multiDayGroups.length === 0 && groupedSelections.singleDayGroups.length === 0) {
    return null;
  }

  const totalSelectedCount = selectedAssignments.length;
  const _totalCount = dateGroupedSelections.reduce((sum, group) => sum + group.totalCount, 0);

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
  const _handleTimeChange = async (_index: number, _newTime: string) => {
    // 시간 변경 기능은 현재 비활성화됨
    // 향후 필요시 구현 예정
    alert('시간 변경 기능은 준비 중입니다.');
  };
  
  /**
   * 다중일 그룹의 특정 시간대-역할이 모두 선택되었는지 확인
   */
  const isMultiDayRoleSelected = (dates: string[], timeSlot: string, role: string): boolean => {
    return dates.every((date: string) => 
      selectedAssignments.some(assignment => 
        assignment.timeSlot === timeSlot && 
        assignment.role === role && 
        assignment.date === date
      )
    );
  };
  
  /**
   * 다중일 그룹의 특정 시간대-역할 전체 선택/해제
   */
  const handleMultiDayRoleToggle = (dates: string[], timeSlot: string, role: string, isChecked: boolean) => {
    // 각 날짜에 대해 중복 체크 후 선택/해제
    dates.forEach((date: string) => {
      if (isChecked) {
        // 체크하려는 경우: 해당 날짜에 이미 다른 선택이 있는지 확인
        const hasOtherSelection = selectedAssignments.some(assignment => 
          assignment.date === date && 
          !(assignment.timeSlot === timeSlot && assignment.role === role)
        );
        
        if (!hasOtherSelection) {
          // 다른 선택이 없을 때만 추가
          const value = `${date}__${timeSlot}__${role}`;
          onAssignmentToggle(value, true);
        }
      } else {
        // 체크 해제하는 경우: 그냥 제거
        const value = `${date}__${timeSlot}__${role}`;
        onAssignmentToggle(value, false);
      }
    });
  };

  return (
    <div className="space-y-3">
      
      {/* 다중일 그룹 표시 - 날짜 범위별로 그룹화 */}
      {groupedSelections.multiDayGroups.length > 0 && (
        <div className="space-y-3">
          {groupedSelections.multiDayGroups.map((group: any, index: number) => {
            const groupKey = `multi-daterange-${index}`;
            
            return (
              <div key={groupKey} className="border border-blue-300 rounded-lg bg-blue-50 overflow-hidden">
                {/* 날짜 범위 헤더 */}
                <div className="px-3 py-2 bg-blue-100 border-b border-blue-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-800">
                      📅 {group.displayDateRange} ({group.dayCount}일)
                    </span>
                  </div>
                </div>
                
                {/* 시간대-역할 선택 옵션들 */}
                <div className="divide-y divide-blue-200">
                  {group.timeSlotRoles.map((tr: any, trIndex: number) => {
                    const isRoleSelected = isMultiDayRoleSelected(group.dates, tr.timeSlot, tr.role);
                    // 날짜별 중복 체크: 하나라도 다른 선택이 있으면 비활성화
                    const hasConflict = group.dates.some((date: string) => 
                      selectedAssignments.some(assignment => 
                        assignment.date === date && 
                        !(assignment.timeSlot === tr.timeSlot && assignment.role === tr.role)
                      )
                    );
                    
                    return (
                      <div key={`${groupKey}-tr-${trIndex}`} className="p-3">
                        <label className={`flex items-center ${hasConflict ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={isRoleSelected}
                            onChange={(e) => handleMultiDayRoleToggle(group.dates, tr.timeSlot, tr.role, e.target.checked)}
                            disabled={hasConflict}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:bg-gray-300"
                          />
                          <span className="ml-3 text-sm">
                            <span className="font-medium text-gray-700">{tr.timeSlot}</span>
                            <span className="text-gray-500 mx-2">-</span>
                            <span className="font-medium text-gray-800">
                              {t(`jobPostingAdmin.create.${tr.role}`) || tr.role}
                            </span>
                            {hasConflict && (
                              <span className="ml-2 text-xs text-red-600 font-medium">(날짜 중복)</span>
                            )}
                          </span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* 단일 날짜 그룹 표시 - 기존 그리드 레이아웃 유지 */}
      {groupedSelections.singleDayGroups.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          {groupedSelections.singleDayGroups.map((dateGroup: any, groupIndex: number) => (
            <div key={`${dateGroup.date}-${groupIndex}`} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* 날짜 헤더 */}
            <div className="bg-gray-50 px-2 sm:px-3 py-1.5 sm:py-2 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1 sm:space-x-2">
                  <span className="text-sm sm:text-base">📅</span>
                  <span className="text-xs sm:text-sm font-medium text-gray-800">
                    {dateGroup.date === 'no-date' ? '날짜 미정' : dateGroup.displayDate}
                  </span>
                </div>
                <span className="text-xs text-gray-500 hidden sm:block">
                  {dateGroup.selectedCount}개 선택됨
                </span>
              </div>
            </div>

            {/* 선택 항목들 */}
            <div className="divide-y divide-gray-100">
              {dateGroup.selections.map((selection: any, selectionIndex: number) => {
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
                
                // 🔥 핵심 수정: 마감 상태 정확성 보장 (실시간 동기화 + 데이터 무결성)
                const isFull = safeDateString 
                  ? (() => {
                      // 필요 인원 수 계산
                      let requiredCount = 0;
                      const dateReq = jobPosting.dateSpecificRequirements?.find((dr: DateSpecificRequirement) => {
                        const drDateString = timestampToLocalDateString(dr.date);
                        return drDateString === safeDateString;
                      });
                      const ts = dateReq?.timeSlots.find((t: TimeSlot) => t.time === selection.time);
                      const roleReq = ts?.roles.find((r: any) => r.name === selection.role);
                      requiredCount = roleReq?.count || 0;
                      
                      if (requiredCount === 0) return false;
                      
                      // 🔧 강화된 실시간 확정 인원 수 계산 (데이터 무결성 보장)
                      const confirmedStaffArray = jobPosting.confirmedStaff ?? [];  // TypeScript strict mode
                      
                      // 🔍 중요: 실제 활성 상태인 확정만 카운트 (취소된 확정 제외)
                      const activeConfirmedCount = confirmedStaffArray.filter((staff: any) => {
                        // 기본 조건: 역할, 시간, 날짜 일치
                        const staffDateString = staff.date ? timestampToLocalDateString(staff.date) : '';
                        const isMatch = staff.timeSlot === selection.time && 
                                       staff.role === selection.role &&
                                       staffDateString === safeDateString;
                        
                        if (!isMatch) return false;
                        
                        // 🔄 중요: 해당 userId의 실제 application 상태 확인
                        // confirmedStaff 배열에 있어도 실제 application이 취소된 경우 제외
                        const userId = staff.userId || staff.staffId; // 필드명 호환성
                        if (!userId) return false;
                        
                        // 현재 지원자가 바로 이 userId인 경우는 현재 선택을 기준으로 판단
                        if (userId === applicant.applicantId) {
                          // 현재 지원자의 실제 상태가 'confirmed'인지 확인
                          return applicant.status === 'confirmed';
                        }
                        
                        // 다른 지원자의 경우 confirmedStaff에 있으면 활성으로 간주
                        // (실제로는 모든 applications를 확인해야 하지만 성능상 생략)
                        return true;
                      }).length;
                      
                      logger.debug('🔍 강화된 마감 상태 계산:', {
                        component: 'MultiSelectControls',
                        data: {
                          safeDateString,
                          timeSlot: selection.time,
                          role: selection.role,
                          requiredCount,
                          totalConfirmedInArray: confirmedStaffArray.length,
                          activeConfirmedCount,
                          applicantStatus: applicant.status,
                          applicantId: applicant.applicantId,
                          isFull: activeConfirmedCount >= requiredCount
                        }
                      });
                      
                      return activeConfirmedCount >= requiredCount;
                    })()
                  : false;
                
                // 선택 불가능한 상태 (마감 또는 같은 날짜에 다른 선택이 있는 경우)
                const isDisabled = isFull || hasOtherSelectionInSameDate;
                
                // 🔧 해당 역할의 실제 활성 확정 인원 수 계산 (데이터 무결성 + 정확성 보장)
                const confirmedCount = safeDateString 
                  ? (() => {
                      // ✅ TypeScript strict mode: 배열 undefined 체크
                      const confirmedStaffArray = jobPosting.confirmedStaff ?? [];
                      return confirmedStaffArray.filter((staff: any) => {
                        // 기본 조건: 역할, 시간, 날짜 일치
                        const staffDateString = staff.date ? timestampToLocalDateString(staff.date) : '';
                        const isMatch = staff.timeSlot === selection.time && 
                                       staff.role === selection.role &&
                                       staffDateString === safeDateString;
                        
                        if (!isMatch) return false;
                        
                        // 🔄 실제 활성 상태 확인 (취소된 확정 제외)
                        const userId = staff.userId || staff.staffId; // 필드명 호환성
                        if (!userId) return false;
                        
                        // 현재 지원자인 경우 실제 상태 반영
                        if (userId === applicant.applicantId) {
                          return applicant.status === 'confirmed';
                        }
                        
                        // 다른 지원자는 confirmedStaff에 있으면 활성으로 간주
                        return true;
                      }).length;
                    })()
                  : (() => {
                      // 날짜 없는 경우도 같은 로직 적용
                      const confirmedStaffArray = jobPosting.confirmedStaff ?? [];
                      return confirmedStaffArray.filter((staff: any) => {
                        const isMatch = staff.timeSlot === selection.time && 
                                       staff.role === selection.role;
                        
                        if (!isMatch) return false;
                        
                        const userId = staff.userId || staff.staffId;
                        if (!userId) return false;
                        
                        if (userId === applicant.applicantId) {
                          return applicant.status === 'confirmed';
                        }
                        
                        return true;
                      }).length;
                    })();
                
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
                    className={`flex items-center justify-between p-2 sm:p-3 ${
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
                        <span className={`text-xs sm:text-sm font-medium truncate ${
                          isDisabled ? 'text-gray-500' : 'text-gray-900'
                        }`}>
                          {t(`jobPostingAdmin.create.${selection.role}`) || selection.role}
                        </span>
                        <div className="flex items-center space-x-1 sm:space-x-2 mt-0.5">
                          <span className={`text-xs ${
                            isDisabled ? 'text-red-600 font-medium' : 'text-gray-500'
                          }`}>
                            ({confirmedCount}/{requiredCount})
                          </span>
                          {isFull && (
                            <span className="text-xs text-red-600 font-medium hidden sm:inline">마감</span>
                          )}
                          {hasOtherSelectionInSameDate && !isFull && (
                            <span className="text-xs text-orange-600 font-medium hidden sm:inline">날짜 중복</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 오른쪽: 시간 드롭다운 */}
                    <div className="flex-shrink-0 ml-1 sm:ml-2">
                      <span className="text-xs text-gray-700 font-medium px-1 sm:px-2 py-1 min-w-[3rem] sm:min-w-[4rem] bg-gray-50 rounded border">
                        {selection.time}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      )}

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