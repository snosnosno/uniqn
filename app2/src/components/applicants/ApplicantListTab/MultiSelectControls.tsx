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
  groupSingleDaySelections,
  formatDateDisplay,
  getStaffCounts
} from './utils/applicantHelpers';

interface MultiSelectControlsProps {
  applicant: Applicant;
  jobPosting: any;
  selectedAssignments: Assignment[];
  onAssignmentToggle: (value: string, isChecked: boolean) => void;
  onConfirm: () => void;
  canEdit: boolean;
  _onRefresh: () => void;
  applications?: any[];  // 전체 지원서 데이터 (카운트 계산용)
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
  _onRefresh,
  applications = []
}) => {
  const { t } = useTranslation();
  
  // 디버깅: applications 배열 확인
  logger.debug('📋 MultiSelectControls applications 데이터', {
    component: 'MultiSelectControls', 
    data: {
      applicationsCount: applications.length,
      confirmedCount: applications.filter(app => app.status === 'confirmed').length,
      applicationsIds: applications.map(app => ({ id: app.id, status: app.status }))
    }
  });
  
  // 🔥 새로운 checkMethod 기반 그룹화 로직 - 날짜 범위 유지
  const groupedSelections = useMemo(() => {
    const allSelections = getApplicantSelections(applicant, jobPosting);
    
    // 디버깅용 로그 추가
    logger.debug('📊 getApplicantSelections 결과:', {
      component: 'MultiSelectControls',
      data: {
        applicantId: applicant.id,
        totalSelections: allSelections.length,
        selectionsWithCheckMethod: allSelections.filter((s: any) => s.checkMethod).length,
        groupSelections: allSelections.filter((s: any) => s.checkMethod === 'group').length,
        individualSelections: allSelections.filter((s: any) => s.checkMethod === 'individual').length,
        firstFewSelections: allSelections.slice(0, 3).map((s: any) => ({
          role: s.role,
          time: s.time,
          dates: s.dates,
          checkMethod: s.checkMethod,
          isGrouped: s.isGrouped
        }))
      }
    });
    
    // checkMethod 기반으로 분류
    const groupSelections: any[] = [];
    const individualSelections: any[] = [];
    
    allSelections.forEach((selection: any) => {
      // checkMethod 또는 isGrouped로 판단
      const isGroup = selection.checkMethod === 'group' || 
                     (selection.isGrouped && selection.dates && selection.dates.length > 1);
      
      
      if (isGroup) {
        groupSelections.push(selection);
      } else {
        individualSelections.push(selection);
      }
    });
    
    // 그룹 선택: 날짜 범위를 유지하면서 시간대별로 그룹화
    const dateRangeGroups = new Map<string, any>();
    
    groupSelections.forEach((selection: any) => {
      // dates 배열이 있으면 날짜 범위로 키 생성
      const dates = selection.dates || [selection.date];
      const sortedDates = [...dates].sort();
      const dateRangeKey = sortedDates.join('|');
      
      if (!dateRangeGroups.has(dateRangeKey)) {
        dateRangeGroups.set(dateRangeKey, {
          dates: sortedDates,
          dayCount: sortedDates.length,
          displayDateRange: sortedDates.length > 1 
            ? `${formatDateDisplay(sortedDates[0])} ~ ${formatDateDisplay(sortedDates[sortedDates.length - 1])}`
            : formatDateDisplay(sortedDates[0] || ''),
          timeSlotGroups: new Map()
        });
      }
      
      const dateGroup = dateRangeGroups.get(dateRangeKey)!;
      
      // 같은 시간대끼리 그룹화
      if (!dateGroup.timeSlotGroups.has(selection.time)) {
        dateGroup.timeSlotGroups.set(selection.time, {
          timeSlot: selection.time,
          roles: []
        });
      }
      
      const timeGroup = dateGroup.timeSlotGroups.get(selection.time)!;
      if (selection.role && !timeGroup.roles.includes(selection.role)) {
        timeGroup.roles.push(selection.role);
      }
    });
    
    // Map을 배열로 변환
    const finalGroupSelections = Array.from(dateRangeGroups.values()).map(dateGroup => ({
      ...dateGroup,
      timeSlotGroups: Array.from(dateGroup.timeSlotGroups.values())
    }));
    
    // 개별 선택: 날짜별로 그룹화
    const individualGroups = groupSingleDaySelections(individualSelections);
    
    return {
      groupSelections: finalGroupSelections,
      individualGroups: individualGroups
    };
  }, [applicant, jobPosting]);
  
  // 날짜별 그룹화된 선택 사항 (메모이제이션) - 기존 코드 호환성 유지
  const dateGroupedSelections = useMemo(() => {
    const groups = getApplicantSelectionsByDate(applicant, jobPosting);
    
    // 각 그룹의 선택된 개수 계산
    return groups.map(group => {
      const stats = getDateSelectionStats(
        group.selections, 
        selectedAssignments.map(assignment => ({
          timeSlot: assignment.timeSlot,
          role: assignment.role || '',
          date: assignment.dates?.[0] || ''
        })), 
        group.date
      );
      return {
        ...group,
        selectedCount: stats.selectedCount
      };
    });
  }, [applicant, selectedAssignments]);
  
  if (groupedSelections.groupSelections.length === 0 && 
      groupedSelections.individualGroups.length === 0) {
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
      (assignment.dates?.[0] || '') === normalizedDate
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
        (assignment.dates?.[0] || '') === date
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
          (assignment.dates?.[0] || '') === date && 
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
      
      {/* 그룹 선택 표시 - checkMethod='group' */}
      {groupedSelections.groupSelections.length > 0 && (
        <div className="space-y-3">
          {groupedSelections.groupSelections.map((dateGroup: any, index: number) => {
            const groupKey = `group-selection-${index}`;
            
            return (
              <div key={groupKey} className="border border-green-300 rounded-lg bg-green-50 overflow-hidden">
                {/* 날짜 범위 헤더 */}
                <div className="px-3 py-2 bg-green-100 border-b border-green-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-green-800">
                      📅 {dateGroup.displayDateRange} ({dateGroup.dayCount}일)
                    </span>
                  </div>
                </div>
                
                {/* 시간대별로 그룹화된 체크박스들 */}
                <div className="divide-y divide-green-200">
                  {dateGroup.timeSlotGroups.map((timeGroup: any, timeIndex: number) => (
                    <div key={`${groupKey}-time-${timeIndex}`} className="p-3">
                      {/* 각 역할별로 체크박스 생성 */}
                      {timeGroup.roles.map((role: string, roleIndex: number) => {
                        const isRoleSelected = isMultiDayRoleSelected(dateGroup.dates, timeGroup.timeSlot, role);
                        // 날짜별 중복 체크: 하나라도 다른 선택이 있으면 비활성화
                        const hasConflict = dateGroup.dates.some((date: string) => 
                          selectedAssignments.some(assignment => 
                            (assignment.dates?.[0] || '') === date && 
                            !(assignment.timeSlot === timeGroup.timeSlot && assignment.role === role)
                          )
                        );
                        
                        return (
                          <label key={`${groupKey}-time-${timeIndex}-role-${roleIndex}`} 
                            className={`flex items-center mb-2 last:mb-0 ${hasConflict ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                            <input
                              type="checkbox"
                              checked={isRoleSelected}
                              onChange={(e) => handleMultiDayRoleToggle(dateGroup.dates, timeGroup.timeSlot, role, e.target.checked)}
                              disabled={!canEdit || hasConflict}
                              className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded disabled:bg-gray-300"
                            />
                            <span className="ml-3 text-sm">
                              <span className="font-medium text-gray-800">
                                {role ? (t(`roles.${role}`) || role) : ''}
                              </span>
                              {(() => {
                                const counts = getStaffCounts(jobPosting, applications, role, timeGroup.timeSlot);
                                return (
                                  <span className="text-gray-500 ml-1">({counts.confirmed}/{counts.required})</span>
                                );
                              })()}
                              <span className="text-gray-500 mx-2">-</span>
                              <span className="font-medium text-gray-700">{timeGroup.timeSlot}</span>
                              {hasConflict && (
                                <span className="ml-2 text-xs text-red-600 font-medium">(날짜 중복)</span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      
      {/* 개별 선택 표시 - checkMethod='individual' */}
      {groupedSelections.individualGroups.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          {groupedSelections.individualGroups.map((dateGroup: any, groupIndex: number) => {
            // 🔥 같은 시간대의 여러 역할 그룹화
            const timeGroupsMap = new Map<string, { time: string; roles: string[]; selections: any[] }>();
            
            dateGroup.selections.forEach((selection: any) => {
              const time = selection.time || '시간 미정';
              if (!timeGroupsMap.has(time)) {
                timeGroupsMap.set(time, {
                  time,
                  roles: [],
                  selections: []
                });
              }
              const timeGroup = timeGroupsMap.get(time)!;
              if (!timeGroup.roles.includes(selection.role)) {
                timeGroup.roles.push(selection.role);
              }
              timeGroup.selections.push(selection);
            });
            
            const timeGroups = Array.from(timeGroupsMap.values());
            
            return (
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

                {/* 시간대별로 그룹화된 선택 항목들 */}
                <div className="divide-y divide-gray-100">
                  {timeGroups.map((timeGroup, timeGroupIndex: number) => (
                    <div key={`${dateGroup.date}-${timeGroup.time}-${timeGroupIndex}`} className="p-2 sm:p-3">
                      <div className="space-y-2">
                        {timeGroup.roles.map((role, roleIndex) => {
                          const selection = timeGroup.selections.find(s => s.role === role);
                          if (!selection) return null;
                          
                          const safeDateString = selection.date || '';
                          const optionValue = safeDateString.trim() !== '' 
                            ? `${safeDateString}__${selection.time}__${selection.role}`
                            : `${selection.time}__${selection.role}`;
                          
                          const isSelected = isAssignmentSelected(selection.time, selection.role, safeDateString);
                          
                          // 같은 날짜에 이미 다른 항목이 선택되었는지 확인
                          const hasOtherSelectionInSameDate = safeDateString.trim() !== '' && 
                            selectedAssignments.some(assignment => 
                              (assignment.dates?.[0] || '') === safeDateString && 
                              !(assignment.timeSlot === selection.time && assignment.role === selection.role)
                            );
                          
                          return (
                            <label key={`${timeGroup.time}-${role}-${roleIndex}`} 
                              className={`flex items-center justify-between p-2 rounded border ${
                                isSelected ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
                              } ${hasOtherSelectionInSameDate ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => onAssignmentToggle(optionValue, e.target.checked)}
                                  disabled={!canEdit || hasOtherSelectionInSameDate}
                                  className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:bg-gray-300"
                                />
                                <span className="ml-2 text-xs sm:text-sm">
                                  <span className="font-medium text-gray-800">
                                    {role ? (t(`roles.${role}`) || role) : ''}
                                  </span>
                                  {role && (() => {
                                    const counts = getStaffCounts(jobPosting, applications, role, timeGroup.time, safeDateString);
                                    return (
                                      <span className="text-gray-500 ml-1">({counts.confirmed}/{counts.required})</span>
                                    );
                                  })()}
                                  <span className="font-medium text-gray-700 ml-2">{timeGroup.time}</span>
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* 확정 버튼 */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <button
          onClick={onConfirm}
          disabled={selectedAssignments.length === 0 || !canEdit}
          className={`w-full flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            selectedAssignments.length > 0 && canEdit
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          ✓ 선택한 시간 확정 ({selectedAssignments.length}개)
        </button>
      </div>
    </div>
  );
};

export default MultiSelectControls;