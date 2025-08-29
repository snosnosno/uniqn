import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { JobPosting, TimeSlot, RoleRequirement, DateSpecificRequirement } from '../../../types/jobPosting';
import { formatDate as formatDateUtil, generateDateRange, formatDateRangeDisplay } from '../../../utils/jobPosting/dateUtils';
import { logger } from '../../../utils/logger';

interface Assignment {
  timeSlot: string;
  role: string;
  date?: string | any;
  duration?: {
    type: 'single' | 'multi';
    endDate?: string;
  };
}

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
        
        // 날짜 범위 생성 및 자동 선택
        if (startDate && endDate) {
          const expandedDates = generateDateRange(startDate, endDate);
          
          // 각 날짜에 대해 모든 timeSlot과 role을 자동 선택
          expandedDates.forEach(expandedDate => {
            dateReq.timeSlots.forEach((ts: TimeSlot) => {
              ts.roles.forEach((role: RoleRequirement) => {
                // 이미 마감된 항목은 제외
                const confirmedCount = jobPosting.confirmedStaff?.filter(staff => 
                  staff.timeSlot === ts.time && 
                  staff.role === role.name && 
                  staff.date === expandedDate
                ).length || 0;
                
                if (confirmedCount < role.count) {
                  autoSelectedAssignments.push({
                    timeSlot: ts.time,
                    role: role.name,
                    date: expandedDate,
                    ...(ts.duration && { duration: ts.duration })
                  });
                }
              });
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
        // 이미 선택된 항목인지 확인
        const isAlreadySelected = selectedAssignments.some(selected => 
          selected.timeSlot === assignment.timeSlot && 
          selected.role === assignment.role && 
          selected.date === assignment.date
        );
        
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

  // 선택된 항목인지 확인
  const isAssignmentSelected = (assignment: Assignment): boolean => {
    return selectedAssignments.some(selected => 
      selected.timeSlot === assignment.timeSlot && 
      selected.role === assignment.role &&
      (assignment.date ? selected.date === assignment.date : !selected.date)
    );
  };

  // 그룹(여러 날짜) 전체가 선택되었는지 확인
  const isGroupSelected = (timeSlot: string, role: string, dates: string[]): boolean => {
    return dates.every(date => 
      selectedAssignments.some(selected => 
        selected.timeSlot === timeSlot && 
        selected.role === role && 
        selected.date === date
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
    dates.forEach(date => {
      const assignment: Assignment = {
        timeSlot,
        role,
        date,
        ...(duration && { duration })
      };
      
      // 이미 선택된 항목인지 확인
      const isAlreadySelected = selectedAssignments.some(selected => 
        selected.timeSlot === assignment.timeSlot && 
        selected.role === assignment.role && 
        selected.date === assignment.date
      );
      
      // 체크 상태와 현재 선택 상태가 다른 경우에만 변경
      if (isChecked && !isAlreadySelected) {
        onAssignmentChange(assignment, true);
      } else if (!isChecked && isAlreadySelected) {
        onAssignmentChange(assignment, false);
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 sm:top-10 mx-auto p-3 sm:p-5 border w-full max-w-[95%] sm:max-w-4xl shadow-lg rounded-md bg-white h-[95vh] sm:h-[85vh] flex flex-col">
        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
          {t('jobBoard.applyModal.title', { postTitle: jobPosting.title })}
        </h3>
        
        {/* 선택된 항목들 미리보기 - 날짜별로 그룹화 */}
        {selectedAssignments.length > 0 && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <h4 className="text-sm font-medium text-green-800 mb-2">
              선택된 항목 ({selectedAssignments.length}개):
            </h4>
            <div className="space-y-2">
              {(() => {
                // 날짜별로 그룹화
                const groupedByDate = selectedAssignments.reduce((acc, assignment) => {
                  const dateKey = assignment.date || 'no-date';
                  if (!acc[dateKey]) {
                    acc[dateKey] = [];
                  }
                  acc[dateKey]!.push(assignment);
                  return acc;
                }, {} as Record<string, typeof selectedAssignments>);
                
                // 날짜 순서대로 정렬
                const sortedDates = Object.keys(groupedByDate).sort().filter(d => d !== 'no-date');
                
                // 연속된 날짜를 범위로 표시
                const dateRangeDisplay = sortedDates.length > 1 ? 
                  formatDateRangeDisplay(sortedDates) : 
                  (sortedDates[0] ? formatDateUtil(sortedDates[0]) : '');
                
                return (
                  <div className="text-xs text-green-700">
                    {dateRangeDisplay && (
                      <div className="font-medium mb-2 text-sm">
                        📅 {dateRangeDisplay}
                      </div>
                    )}
                    {sortedDates.map(dateKey => (
                      <div key={dateKey} className="mb-2">
                        <div className="font-medium text-green-600 mb-1 pl-3">
                          {formatDateUtil(dateKey)}
                        </div>
                        <div className="ml-6 space-y-0.5">
                          {(() => {
                            // 시간대별로 다시 그룹화
                            const groupedByTime = groupedByDate[dateKey]!.reduce((acc, assignment) => {
                              if (!acc[assignment.timeSlot]) {
                                acc[assignment.timeSlot] = [];
                              }
                              acc[assignment.timeSlot]!.push(assignment);
                              return acc;
                            }, {} as Record<string, typeof selectedAssignments>);
                            
                            return Object.entries(groupedByTime).map(([timeSlot, assignments]) => (
                              <div key={`${dateKey}-${timeSlot}`}>
                                ⏰ {timeSlot} - 
                                {assignments.map((a, idx) => (
                                  <span key={idx}>
                                    {idx > 0 && ', '}
                                    {t(`jobPostingAdmin.create.${a.role}`, a.role)}
                                  </span>
                                ))}
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
        
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
                  <div key={dateIndex} className="mb-6">
                    <div className="mb-3 p-3 bg-gradient-to-r from-blue-100 to-blue-50 rounded-lg border border-blue-200">
                      <h4 className="text-sm font-semibold text-blue-800 mb-1">
                        📅 {dateDisplay} ({expandedDates.length}일간)
                      </h4>
                      <p className="text-xs text-blue-600">
                        한 번의 선택으로 모든 날짜에 지원할 수 있습니다.
                      </p>
                    </div>
                    <div className="pl-4 border-l-4 border-blue-300">
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
                              
                              const totalRequired = r.count * expandedDates.length;
                              const isFull = totalConfirmedCount >= totalRequired;
                              const isGroupChecked = isGroupSelected(ts.time, r.name, expandedDates);
                              
                              return (
                                <label 
                                  key={roleIndex} 
                                  className={`flex items-center p-2 rounded cursor-pointer ${
                                    isFull ? 'bg-gray-100 cursor-not-allowed' : 
                                    isGroupChecked ? 'bg-green-100 border border-green-300' : 'bg-white hover:bg-gray-50'
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
                                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded disabled:cursor-not-allowed"
                                  />
                                  <span className={`ml-3 ${
                                    isFull ? 'text-gray-400' : 'text-gray-700'
                                  }`}>
                                    <span className="font-medium">
                                      👤 {t(`jobPostingAdmin.create.${r.name}`, r.name)}
                                    </span>
                                    <span className="text-sm text-blue-600 ml-2">
                                      ({expandedDates.length}일 전체)
                                    </span>
                                    <span className={`ml-2 text-xs ${
                                      isFull ? 'text-red-500 font-medium' : 'text-gray-500'
                                    }`}>
                                      {isFull ? '마감' : `${totalConfirmedCount}/${totalRequired}명`}
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
                        const assignment = { timeSlot: ts.time, role: r.name, date: dateReq.date };
                        const confirmedCount = jobPosting.confirmedStaff?.filter(staff => 
                          staff.timeSlot === ts.time && 
                          staff.role === r.name && 
                          staff.date === dateReq.date
                        ).length || 0;
                        const isFull = confirmedCount >= r.count;
                        const isSelected = isAssignmentSelected(assignment);
                        
                        return (
                          <label 
                            key={roleIndex} 
                            className={`flex items-center p-2 rounded cursor-pointer ${
                              isFull ? 'bg-gray-100 cursor-not-allowed' : 
                              isSelected ? 'bg-green-100 border border-green-300' : 'bg-white hover:bg-gray-50'
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
                              👤 {t(`jobPostingAdmin.create.${r.name}`, r.name)} 
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
              className="py-3 px-6 sm:py-2 sm:px-4 bg-gray-500 text-white rounded hover:bg-gray-700 min-h-[48px] text-sm sm:text-base"
            >
              {t('jobBoard.applyModal.cancel')}
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