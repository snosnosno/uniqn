import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { JobPosting, TimeSlot, RoleRequirement, DateSpecificRequirement } from '../../../types/jobPosting';
import { formatDate as formatDateUtil, generateDateRange } from '../../../utils/jobPosting/dateUtils';
// formatDateRangeDisplay - 향후 사용 예정
import { logger } from '../../../utils/logger';
import { Assignment } from '../../../types/application';

interface ApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobPosting: JobPosting;
  selectedAssignments: Assignment[];
  onAssignmentChange: (assignment: Assignment, isChecked: boolean) => void;
  onApply: () => void;
  isProcessing: boolean;
  onBack?: () => void;
  hasPreQuestions?: boolean;
}

/**
 * 구인공고 지원 모달 컴포넌트
 */
const ApplyModal: React.FC<ApplyModalProps> = ({
  isOpen,
  onClose,
  jobPosting,
  selectedAssignments,
  onAssignmentChange,
  onApply,
  isProcessing,
  onBack,
  hasPreQuestions
}) => {
  const { t } = useTranslation();
  const autoSelectionProcessedRef = useRef(false);

  // 모달이 열릴 때 다중 날짜 자동 선택
  useEffect(() => {
    if (!isOpen || !jobPosting.dateSpecificRequirements) return;
    
    // 이미 처리되었으면 스킵
    if (autoSelectionProcessedRef.current) return;
    
    const autoSelectedAssignments: Assignment[] = [];
    
    jobPosting.dateSpecificRequirements.forEach((dateReq: DateSpecificRequirement) => {
      // 첫 번째 timeSlot의 duration을 확인 (모든 timeSlot이 동일한 duration을 가짐)
      const firstTimeSlot = dateReq.timeSlots?.[0];
      const hasMultiDuration = firstTimeSlot?.duration?.type === 'multi' && firstTimeSlot?.duration?.endDate;
      
      if (hasMultiDuration && firstTimeSlot && firstTimeSlot.duration && firstTimeSlot.duration.endDate) {
        const endDate = firstTimeSlot.duration.endDate;
        let startDate = '';
        
        // 날짜 문자열 추출
        if (typeof dateReq.date === 'string') {
          startDate = dateReq.date;
        } else if (dateReq.date) {
          try {
            if ((dateReq.date as any).toDate) {
              const date = (dateReq.date as any).toDate();
              startDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            } else if ((dateReq.date as any).seconds) {
              const date = new Date((dateReq.date as any).seconds * 1000);
              startDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            }
          } catch (error) {
            logger.error('Date conversion error:', error as Error);
          }
        }
        
        // 날짜 범위 생성 및 자동 선택 (하나의 Assignment로 그룹화)
        if (startDate && endDate) {
          const expandedDates = generateDateRange(startDate, endDate);
          
          // 각 timeSlot과 role 조합을 하나의 Assignment로 생성 (날짜 배열 포함)
          dateReq.timeSlots.forEach((ts: TimeSlot) => {
            ts.roles.forEach((role: RoleRequirement) => {
              // 모든 날짜에 대해 마감 여부 확인
              const availableDates = expandedDates.filter(date => {
                const confirmedCount = jobPosting.confirmedStaff?.filter(staff => 
                  staff.timeSlot === ts.time && 
                  staff.role === role.name && 
                  staff.date === date
                ).length || 0;
                
                return confirmedCount < role.count;
              });
              
              // 🎯 v2.0: 사용 가능한 날짜가 있으면 새 구조로 Assignment 생성
              if (availableDates.length > 0) {
                const groupId = `${ts.time}_${role.name}_${startDate}_${endDate}`;
                
                autoSelectedAssignments.push({
                  role: role.name,
                  timeSlot: ts.time,
                  dates: availableDates,  // 항상 배열 형태
                  isGrouped: availableDates.length > 1,
                  groupId: availableDates.length > 1 ? groupId : `single_${ts.time}_${role.name}_${availableDates[0]}`,
                  checkMethod: availableDates.length > 1 ? 'group' : 'individual',  // 🎯 체크 방식 구분
                  duration: availableDates.length > 1 ? {
                    type: 'consecutive' as const,
                    startDate: availableDates[0] || '',
                    endDate: availableDates[availableDates.length - 1] || ''
                  } : {
                    type: 'single' as const,
                    startDate: availableDates[0] || ''
                  }
                });
              }
            });
          });
        }
      }
    });
    
    // 자동 선택된 항목이 있으면 설정
    if (autoSelectedAssignments.length > 0) {
      // 처리 완료 표시
      autoSelectionProcessedRef.current = true;
      
      // 각 항목을 개별적으로 추가 (이미 선택된 항목은 체크)
      autoSelectedAssignments.forEach(assignment => {
        // 🎯 v2.0: 새 구조 기반 중복 확인
        const isAlreadySelected = selectedAssignments.some(selected => {
          return selected.timeSlot === assignment.timeSlot && 
                 selected.role === assignment.role &&
                 selected.dates && assignment.dates &&
                 JSON.stringify(selected.dates.sort()) === JSON.stringify(assignment.dates.sort());
        });
        
        if (!isAlreadySelected) {
          onAssignmentChange(assignment, true);
        }
      });
    }
  }, [isOpen, jobPosting.dateSpecificRequirements, jobPosting.confirmedStaff, onAssignmentChange, selectedAssignments]);
  
  // 모달이 닫힐 때 플래그 리셋
  useEffect(() => {
    if (!isOpen) {
      autoSelectionProcessedRef.current = false;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 선택된 항목인지 확인 (dates 배열 고려)
  // 🎯 v2.0: Assignment 선택 여부 확인 (새 구조 기반)
  const isAssignmentSelected = (assignment: Assignment): boolean => {
    return selectedAssignments.some(selected => {
      return selected.timeSlot === assignment.timeSlot && 
             selected.role === assignment.role &&
             selected.dates && assignment.dates &&
             JSON.stringify(selected.dates.sort()) === JSON.stringify(assignment.dates.sort());
    });
  };

  // 그룹(여러 날짜) 전체가 선택되었는지 확인
  const isGroupSelected = (timeSlot: string, role: string, dates: string[]): boolean => {
    // 1. dates 배열을 포함한 Assignment가 있는지 확인
    const hasGroupAssignment = selectedAssignments.some(selected => 
      selected.timeSlot === timeSlot && 
      selected.role === role &&
      selected.dates &&
      JSON.stringify(selected.dates.sort()) === JSON.stringify(dates.sort())
    );

    if (hasGroupAssignment) {
      return true;
    }

    // 2. 개별 Assignment들이 모두 선택되어 있는지 확인 (하위호환성)
    return dates.every(date => 
      selectedAssignments.some(selected => 
        selected.timeSlot === timeSlot && 
        selected.role === role && 
        selected.dates && selected.dates.includes(date)
      )
    );
  };

  // 그룹 일괄 선택/해제 처리
  const handleGroupAssignmentChange = (
    timeSlot: string, 
    role: string, 
    dates: string[], 
    isChecked: boolean,
    duration?: any
  ) => {
    // 🎯 v2.0: 새로운 통합 구조에 맞게 Assignment 생성
    const groupAssignment: Assignment = {
      role,
      timeSlot,
      dates, // 항상 배열 형태 (단일 날짜도 배열)
      isGrouped: true,
      groupId: `${timeSlot}_${role}_${dates[0]}_${dates[dates.length - 1]}`,
      checkMethod: 'group', // 🎯 그룹 체크 방식 명시
      duration: duration ? (dates.length > 1 ? {
        type: 'consecutive' as const,
        startDate: dates[0] || '',
        endDate: dates[dates.length - 1] || ''
      } : {
        type: 'single' as const,
        startDate: dates[0] || ''
      }) : {
        type: 'single' as const,
        startDate: dates[0] || ''
      }
    };
    
    if (isChecked) {
      // 선택: dates 배열을 포함한 Assignment 추가
      onAssignmentChange(groupAssignment, true);
    } else {
      // 해제: 같은 timeSlot과 role을 가진 Assignment 제거
      // 🎯 v2.0: 날짜별로 개별 Assignment도 생성 (하위 호환성)
      dates.forEach(date => {
        const singleAssignment: Assignment = {
          role,
          timeSlot,
          dates: [date], // 단일 날짜도 배열 형태
          isGrouped: false,
          groupId: `single_${timeSlot}_${role}_${date}`,
          checkMethod: 'individual', // 🎯 개별 체크 방식 명시
          duration: {
            type: 'single',
            startDate: date || ''
          }
        };
        onAssignmentChange(singleAssignment, false);
      });
      
      // dates 배열을 포함한 Assignment도 제거
      onAssignmentChange(groupAssignment, false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 sm:top-10 mx-auto p-3 sm:p-5 border w-full max-w-[95%] sm:max-w-4xl shadow-lg rounded-md bg-white dark:bg-gray-800 h-[95vh] sm:h-[85vh] flex flex-col">
        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
          {t('jobBoard.applyModal.title', { postTitle: jobPosting.title })}
        </h3>
        
        
        <div className="flex-1 overflow-y-auto">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            시간대 및 역할 선택 (여러 개 선택 가능)
          </label>
          
          {/* 일자별 인원 요구사항 표시 */}
          {jobPosting.dateSpecificRequirements && jobPosting.dateSpecificRequirements.length > 0 ? (
            jobPosting.dateSpecificRequirements.map((dateReq: DateSpecificRequirement, dateIndex: number) => {
              // 다중일 체크 - 첫 번째 timeSlot의 duration을 확인 (모든 timeSlot이 동일한 duration을 가짐)
              const firstTimeSlot = dateReq.timeSlots?.[0];
              const hasMultiDuration = firstTimeSlot?.duration?.type === 'multi' && firstTimeSlot?.duration?.endDate;
              
              let dateDisplay = formatDateUtil(dateReq.date);
              let expandedDates: string[] = [];
              
              if (hasMultiDuration && firstTimeSlot && firstTimeSlot.duration && firstTimeSlot.duration.endDate) {
                const endDate = firstTimeSlot.duration.endDate;
                dateDisplay = `${formatDateUtil(dateReq.date)} ~ ${formatDateUtil(endDate)}`;
                // 다중 날짜인 경우 날짜 범위를 확장하여 각 날짜별로 선택 가능하게 함
                let startDate = '';
                
                if (typeof dateReq.date === 'string') {
                  startDate = dateReq.date;
                } else if (dateReq.date) {
                  try {
                    // Timestamp 객체 처리
                    if ((dateReq.date as any).toDate) {
                      const date = (dateReq.date as any).toDate();
                      startDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                    } else if ((dateReq.date as any).seconds) {
                      const date = new Date((dateReq.date as any).seconds * 1000);
                      startDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                    }
                  } catch (error) {
                    logger.error('Date conversion error:', error as Error);
                  }
                }
                
                if (startDate && endDate) {
                  expandedDates = generateDateRange(startDate, endDate);
                }
              }
              
              // 다중 날짜인 경우 그룹화하여 표시
              if (expandedDates.length > 0) {
                return (
                  <div key={dateIndex} className="mb-6 bg-blue-50 rounded-lg border border-blue-200 overflow-hidden">
                    <div className="p-3 bg-gradient-to-r from-blue-100 to-blue-50 border-b border-blue-200">
                      <h4 className="text-sm font-semibold text-blue-800 mb-1">
                        📅 {dateDisplay} ({expandedDates.length}일)
                      </h4>
                    </div>
                    <div className="p-4 bg-blue-50">
                      {dateReq.timeSlots.map((ts: TimeSlot, tsIndex: number) => (
                        <div key={tsIndex} className="mb-4">
                          <div className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                            ⏰ {ts.isTimeToBeAnnounced ? (
                              <span className="text-orange-600">
                                미정
                                {ts.tentativeDescription && (
                                  <span className="text-gray-600 font-normal ml-2">
                                    ({ts.tentativeDescription})
                                  </span>
                                )}
                              </span>
                            ) : (
                              ts.time
                            )}
                          </div>
                          <div className="space-y-2 pl-3">
                            {ts.roles.map((r: RoleRequirement, roleIndex: number) => {
                              // 전체 날짜에 대한 확정 인원 계산
                              const totalConfirmedCount = expandedDates.reduce((sum, date) => {
                                const count = jobPosting.confirmedStaff?.filter(staff => 
                                  staff.timeSlot === ts.time && 
                                  staff.role === r.name && 
                                  staff.date === date
                                ).length || 0;
                                return sum + count;
                              }, 0);
                              
                              // 일당 평균 확정 인원
                              const confirmedCountPerDay = Math.floor(totalConfirmedCount / expandedDates.length);
                              const isFull = confirmedCountPerDay >= r.count;
                              const isGroupChecked = isGroupSelected(ts.time, r.name, expandedDates);
                              
                              return (
                                <label 
                                  key={roleIndex} 
                                  className={`flex items-center p-2 rounded cursor-pointer ${
                                    isFull ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' :
                                    isGroupChecked ? 'bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700' : 'bg-white/50 dark:bg-gray-700/50 hover:bg-white dark:hover:bg-gray-700 border border-blue-200 dark:border-blue-600'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isGroupChecked}
                                    disabled={isFull}
                                    onChange={(e) => handleGroupAssignmentChange(
                                      ts.time, 
                                      r.name, 
                                      expandedDates, 
                                      e.target.checked,
                                      ts.duration
                                    )}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:cursor-not-allowed"
                                  />
                                  <span className={`ml-3 ${
                                    isFull ? 'text-gray-400' : 'text-gray-700'
                                  }`}>
                                    <span className="font-medium">
                                      👤 {t(`roles.${r.name}`, r.name)}: {r.count}명
                                    </span>
                                    <span className="text-sm text-blue-600 ml-2">
                                      ({expandedDates.length}일)
                                    </span>
                                    <span className={`ml-2 text-xs ${
                                      isFull ? 'text-red-500 font-medium' : 'text-gray-500'
                                    }`}>
                                      {isFull ? '마감' : `(${confirmedCountPerDay}/${r.count})`}
                                    </span>
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              } else {
                // 단일 날짜인 경우 기존 로직 유지
                return (
                <div key={dateIndex} className="mb-6 border border-blue-200 rounded-lg p-4 bg-blue-50">
                  <h4 className="text-sm font-semibold text-blue-800 mb-3">
                    📅 {dateDisplay}
                  </h4>
                {dateReq.timeSlots.map((ts: TimeSlot, tsIndex: number) => (
                  <div key={tsIndex} className="mb-4 pl-4 border-l-2 border-blue-300">
                    <div className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                      ⏰ {ts.isTimeToBeAnnounced ? (
                        <span className="text-orange-600">
                          미정
                          {ts.tentativeDescription && (
                            <span className="text-gray-600 font-normal ml-2">
                              ({ts.tentativeDescription})
                            </span>
                          )}
                        </span>
                      ) : (
                        ts.time
                      )}
                    </div>
                    <div className="space-y-2">
                      {ts.roles.map((r: RoleRequirement, roleIndex: number) => {
                        // 날짜 문자열 변환 (타임스탬프 → 문자열)
                        let dateString = '';
                        if (typeof dateReq.date === 'string') {
                          dateString = dateReq.date;
                        } else if (dateReq.date) {
                          try {
                            if ((dateReq.date as any).toDate) {
                              const date = (dateReq.date as any).toDate();
                              dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                            } else if ((dateReq.date as any).seconds) {
                              const date = new Date((dateReq.date as any).seconds * 1000);
                              dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                            }
                          } catch (error) {
                            logger.error('Date conversion error in single date:', error as Error);
                            dateString = String(dateReq.date);
                          }
                        }
                        
                        const assignment: Assignment = {
                          timeSlot: ts.time,
                          role: r.name,
                          dates: [dateString],
                          isGrouped: false,
                          duration: {
                            type: 'single',
                            startDate: dateString
                          }
                        };
                        const confirmedCount = jobPosting.confirmedStaff?.filter(staff => 
                          staff.timeSlot === ts.time && 
                          staff.role === r.name && 
                          staff.date === dateString
                        ).length || 0;
                        const isFull = confirmedCount >= r.count;
                        const isSelected = isAssignmentSelected(assignment);
                        
                        return (
                          <label 
                            key={roleIndex} 
                            className={`flex items-center p-2 rounded cursor-pointer ${
                              isFull ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' :
                              isSelected ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700' : 'bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isFull}
                              onChange={(e) => onAssignmentChange(assignment, e.target.checked)}
                              className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded disabled:cursor-not-allowed"
                            />
                            <span className={`ml-3 text-sm ${
                              isFull ? 'text-gray-400' : 'text-gray-700'
                            }`}>
                              👤 {t(`roles.${r.name}`, r.name)} 
                              <span className={`ml-2 text-xs ${
                                isFull ? 'text-red-500 font-medium' : 'text-gray-500'
                              }`}>
                                ({isFull ? '마감' : `${confirmedCount}/${r.count}`})
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
                </div>
              );
              }
            })
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>지원 가능한 시간대가 없습니다.</p>
            </div>
          )}
        </div>
        
        <div className="flex justify-between mt-4">
          <div>
            {hasPreQuestions && onBack && (
              <button 
                onClick={onBack} 
                className="py-3 px-6 sm:py-2 sm:px-4 bg-blue-500 text-white rounded hover:bg-blue-700 min-h-[48px] text-sm sm:text-base"
              >
                뒤로 (수정)
              </button>
            )}
          </div>
          <div className="flex space-x-2">
            <button 
              onClick={onClose} 
              className="py-3 px-6 sm:py-2 sm:px-4 bg-gray-500 dark:bg-gray-600 text-white rounded hover:bg-gray-700 dark:hover:bg-gray-700 min-h-[48px] text-sm sm:text-base"
            >
              {t('common.cancel')}
            </button>
            <button 
              onClick={onApply} 
              disabled={selectedAssignments.length === 0 || isProcessing} 
              className="py-3 px-6 sm:py-2 sm:px-4 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 min-h-[48px] text-sm sm:text-base"
            >
              {isProcessing ? t('jobBoard.applying') : `지원하기 (${selectedAssignments.length}개)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApplyModal;