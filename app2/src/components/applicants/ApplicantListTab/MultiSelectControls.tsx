import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '../../../utils/logger';
import { DateSpecificRequirement } from '../../../types/jobPosting';
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
    
    // Map을 배열로 변환하고 날짜순으로 정렬
    const finalGroupSelections = Array.from(dateRangeGroups.values())
      .map(dateGroup => ({
        ...dateGroup,
        timeSlotGroups: Array.from(dateGroup.timeSlotGroups.values())
      }))
      .sort((a, b) => {
        // 날짜 배열에서 첫 번째 날짜 기준으로 정렬
        const aFirstDate = a.dates && a.dates.length > 0 ? a.dates[0] : '';
        const bFirstDate = b.dates && b.dates.length > 0 ? b.dates[0] : '';
        
        // 날짜 없는 경우는 마지막으로
        if (!aFirstDate && !bFirstDate) return 0;
        if (!aFirstDate) return 1;
        if (!bFirstDate) return -1;
        
        // 날짜순 정렬
        return aFirstDate.localeCompare(bFirstDate);
      });
    
    // 개별 선택: 날짜별로 그룹화하고 날짜순 정렬 보장
    const individualGroups = groupSingleDaySelections(individualSelections)
      .sort((a, b) => {
        // 날짜 없는 경우는 마지막으로
        if (a.date === 'no-date' && b.date === 'no-date') return 0;
        if (a.date === 'no-date') return 1;
        if (b.date === 'no-date') return -1;
        
        // 날짜순 정렬
        return a.date.localeCompare(b.date);
      });
    
    return {
      groupSelections: finalGroupSelections,
      individualGroups: individualGroups
    };
  }, [applicant, jobPosting]);

  // 그룹과 개별 선택을 통합하여 날짜순으로 정렬
  const allSortedCards = useMemo(() => {
    const cards: Array<{
      type: 'group' | 'individual';
      dateGroup: any;
      timeGroup?: any;
      groupKey?: string;
      timeIndex?: number;
      sortDate: string;
    }> = [];
    
    // 그룹 선택 카드들 추가
    groupedSelections.groupSelections.forEach((dateGroup: any, index: number) => {
      dateGroup.timeSlotGroups.forEach((timeGroup: any, timeIndex: number) => {
        cards.push({
          type: 'group',
          dateGroup,
          timeGroup,
          groupKey: `group-selection-${index}`,
          timeIndex,
          sortDate: (dateGroup.dates && dateGroup.dates.length > 0) ? dateGroup.dates[0] : '' // 시작 날짜 기준
        });
      });
    });
    
    // 개별 선택 카드들 추가
    groupedSelections.individualGroups.forEach((dateGroup: any) => {
      cards.push({
        type: 'individual',
        dateGroup,
        sortDate: dateGroup.date || '' // 해당 날짜 기준
      });
    });
    
    // 날짜순 정렬
    return cards.sort((a, b) => {
      // 날짜 없는 경우는 마지막으로
      if (!a.sortDate || a.sortDate === 'no-date') return 1;
      if (!b.sortDate || b.sortDate === 'no-date') return -1;
      
      // 날짜순 정렬 (시작 날짜 기준)
      return a.sortDate.localeCompare(b.sortDate);
    });
  }, [groupedSelections]);
  
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
  
  if (allSortedCards.length === 0) {
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
      
      {/* 통합된 그룹 및 개별 선택 - 날짜순으로 정렬된 2x2 그리드 */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        {allSortedCards.map((card, cardIndex) => {
          if (card.type === 'group') {
            // 그룹 선택 카드 렌더링
            const { dateGroup, timeGroup, groupKey, timeIndex } = card;
            
            return (
              <div key={`${groupKey}-time-${timeIndex}-unified`} className="border border-green-300 rounded-lg overflow-hidden">
                {/* 날짜 범위 헤더 */}
                <div className="bg-green-100 px-2 sm:px-3 py-1.5 sm:py-2 border-b border-green-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <span className="text-sm sm:text-base">📅</span>
                      <div className="text-xs sm:text-sm font-medium text-green-800">
                        {(() => {
                          // 여러 날인 경우 두 줄로 표시
                          if (dateGroup.dayCount > 1) {
                            const dates = dateGroup.dates || [];
                            const firstDate = dates[0];
                            const lastDate = dates[dates.length - 1];
                            
                            if (firstDate && lastDate) {
                              const firstFormatted = formatDateDisplay(firstDate);
                              const lastFormatted = formatDateDisplay(lastDate);
                              return (
                                <div className="leading-tight">
                                  <div>{firstFormatted} ~</div>
                                  <div>{lastFormatted}({dateGroup.dayCount}일)</div>
                                </div>
                              );
                            }
                          }
                          // 단일 날짜인 경우 기존 형식
                          return `${dateGroup.displayDateRange} (${dateGroup.dayCount}일)`;
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* 역할별 체크박스들 */}
                <div className="p-2 sm:p-3">
                  <div className="space-y-2">
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
                        <label key={`${groupKey}-time-${timeIndex}-role-${roleIndex}-unified`} 
                          className={`flex items-center justify-between p-2 rounded border ${
                            isRoleSelected ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                          } ${hasConflict ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={isRoleSelected}
                              onChange={(e) => handleMultiDayRoleToggle(dateGroup.dates, timeGroup.timeSlot, role, e.target.checked)}
                              disabled={!canEdit || hasConflict}
                              className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded disabled:bg-gray-300"
                            />
                            <span className="ml-2 text-xs sm:text-sm">
                              <span className="font-medium text-gray-800">
                                {role ? (t(`roles.${role}`) || role) : ''}
                              </span>
                              {(() => {
                                const counts = getStaffCounts(jobPosting, applications, role, timeGroup.timeSlot);
                                return (
                                  <span className="text-gray-500 ml-1">({counts.confirmed}/{counts.required})</span>
                                );
                              })()}
                              <span className="font-medium text-gray-700 ml-2">{timeGroup.timeSlot}</span>
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          } else {
            // 개별 선택 카드 렌더링
            const { dateGroup } = card;
            
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
              <div key={`${dateGroup.date}-unified-${cardIndex}`} className="border border-green-300 rounded-lg overflow-hidden">
                {/* 날짜 헤더 */}
                <div className="bg-green-100 px-2 sm:px-3 py-1.5 sm:py-2 border-b border-green-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <span className="text-sm sm:text-base">📅</span>
                      <span className="text-xs sm:text-sm font-medium text-green-800">
                        {dateGroup.date === 'no-date' ? '날짜 미정' : dateGroup.displayDate} (1일)
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 hidden sm:block">
                      {dateGroup.selectedCount}개 선택됨
                    </span>
                  </div>
                </div>

                {/* 시간대별로 그룹화된 선택 항목들 */}
                <div className="divide-y divide-green-100">
                  {timeGroups.map((timeGroup, timeGroupIndex: number) => (
                    <div key={`${dateGroup.date}-${timeGroup.time}-unified-${timeGroupIndex}`} className="p-2 sm:p-3">
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
                            <label key={`${timeGroup.time}-${role}-unified-${roleIndex}`} 
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
          }
        })}
      </div>
      
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