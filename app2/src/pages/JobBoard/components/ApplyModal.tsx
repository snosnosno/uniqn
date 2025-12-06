import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Timestamp } from 'firebase/firestore';
import { JobPosting, TimeSlot, RoleRequirement, DateSpecificRequirement } from '@/types/jobPosting';
import { formatDate as formatDateUtil, generateDateRange } from '@/utils/jobPosting/dateUtils';
import { logger } from '@/utils/logger';
import { Assignment } from '@/types/application';

/** DateSpecificRequirement.date 필드를 문자열로 변환 */
const dateToString = (dateValue: string | Timestamp | { seconds: number }): string => {
  if (typeof dateValue === 'string') {
    return dateValue;
  }

  try {
    let jsDate: Date;
    if ('toDate' in dateValue && typeof dateValue.toDate === 'function') {
      // Firebase Timestamp
      jsDate = dateValue.toDate();
    } else if ('seconds' in dateValue) {
      // Raw Timestamp 객체
      jsDate = new Date(dateValue.seconds * 1000);
    } else {
      return '';
    }
    return `${jsDate.getFullYear()}-${String(jsDate.getMonth() + 1).padStart(2, '0')}-${String(jsDate.getDate()).padStart(2, '0')}`;
  } catch (error) {
    logger.error('Date conversion error:', error as Error);
    return '';
  }
};

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
  hasPreQuestions,
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
      const hasMultiDuration =
        firstTimeSlot?.duration?.type === 'multi' && firstTimeSlot?.duration?.endDate;

      if (
        hasMultiDuration &&
        firstTimeSlot &&
        firstTimeSlot.duration &&
        firstTimeSlot.duration.endDate
      ) {
        const endDate = firstTimeSlot.duration.endDate;
        const startDate = dateToString(dateReq.date);

        // 날짜 범위 생성 및 자동 선택 (하나의 Assignment로 그룹화)
        if (startDate && endDate) {
          const expandedDates = generateDateRange(startDate, endDate);

          // 각 timeSlot과 role 조합을 하나의 Assignment로 생성 (날짜 배열 포함)
          dateReq.timeSlots.forEach((ts: TimeSlot) => {
            ts.roles.forEach((role: RoleRequirement) => {
              // 모든 날짜에 대해 마감 여부 확인
              const availableDates = expandedDates.filter((date) => {
                const confirmedCount =
                  jobPosting.confirmedStaff?.filter(
                    (staff) =>
                      staff.timeSlot === ts.time && staff.role === role.name && staff.date === date
                  ).length || 0;

                return confirmedCount < role.count;
              });

              if (availableDates.length > 0) {
                const groupId = `${ts.time}_${role.name}_${startDate}_${endDate}`;

                autoSelectedAssignments.push({
                  role: role.name,
                  timeSlot: ts.time,
                  dates: availableDates, // 항상 배열 형태
                  isGrouped: availableDates.length > 1,
                  groupId:
                    availableDates.length > 1
                      ? groupId
                      : `single_${ts.time}_${role.name}_${availableDates[0]}`,
                  checkMethod: availableDates.length > 1 ? 'group' : 'individual',
                  duration:
                    availableDates.length > 1
                      ? {
                          type: 'consecutive' as const,
                          startDate: availableDates[0] || '',
                          endDate: availableDates[availableDates.length - 1] || '',
                        }
                      : {
                          type: 'single' as const,
                          startDate: availableDates[0] || '',
                        },
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

      autoSelectedAssignments.forEach((assignment) => {
        const isAlreadySelected = selectedAssignments.some((selected) => {
          return (
            selected.timeSlot === assignment.timeSlot &&
            selected.role === assignment.role &&
            selected.dates &&
            assignment.dates &&
            JSON.stringify(selected.dates.sort()) === JSON.stringify(assignment.dates.sort())
          );
        });

        if (!isAlreadySelected) {
          onAssignmentChange(assignment, true);
        }
      });
    }
  }, [
    isOpen,
    jobPosting.dateSpecificRequirements,
    jobPosting.confirmedStaff,
    onAssignmentChange,
    selectedAssignments,
  ]);

  // 모달이 닫힐 때 플래그 리셋
  useEffect(() => {
    if (!isOpen) {
      autoSelectionProcessedRef.current = false;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  /** Assignment 선택 여부 확인 */
  const isAssignmentSelected = (assignment: Assignment): boolean => {
    return selectedAssignments.some((selected) => {
      const selectedDates = selected.dates ?? [];
      const assignmentDates = assignment.dates ?? [];
      if (selectedDates.length === 0 || assignmentDates.length === 0) return false;

      return (
        selected.timeSlot === assignment.timeSlot &&
        selected.role === assignment.role &&
        JSON.stringify([...selectedDates].sort()) === JSON.stringify([...assignmentDates].sort())
      );
    });
  };

  /** 그룹(여러 날짜) 전체가 선택되었는지 확인 */
  const isGroupSelected = (timeSlot: string, role: string, dates: string[]): boolean => {
    if (!dates || dates.length === 0) return false;

    return selectedAssignments.some((selected) => {
      const selectedDates = selected.dates ?? [];
      if (selectedDates.length === 0) return false;

      return (
        selected.timeSlot === timeSlot &&
        selected.role === role &&
        JSON.stringify([...selectedDates].sort()) === JSON.stringify([...dates].sort())
      );
    });
  };

  /** 그룹 일괄 선택/해제 처리 */
  const handleGroupAssignmentChange = (
    timeSlot: string,
    role: string,
    dates: string[],
    isChecked: boolean,
    duration?: TimeSlot['duration']
  ) => {
    if (!dates || dates.length === 0) {
      logger.warn('handleGroupAssignmentChange: dates 배열이 비어있음', {
        component: 'ApplyModal',
        data: { timeSlot, role },
      });
      return;
    }

    const firstDate = dates[0] ?? '';
    const lastDate = dates[dates.length - 1] ?? '';

    const groupAssignment: Assignment = {
      role,
      timeSlot,
      dates,
      isGrouped: true,
      groupId: `${timeSlot}_${role}_${firstDate}_${lastDate}`,
      checkMethod: 'group',
      duration:
        duration && dates.length > 1
          ? {
              type: 'consecutive' as const,
              startDate: firstDate,
              endDate: lastDate,
            }
          : {
              type: 'single' as const,
              startDate: firstDate,
            },
    };

    onAssignmentChange(groupAssignment, isChecked);
  };

  return (
    <div
      className="fixed inset-0 bg-gray-600 dark:bg-gray-900 bg-opacity-50 dark:bg-opacity-70 overflow-y-auto h-full w-full z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apply-modal-title"
    >
      <div className="relative top-4 sm:top-10 mx-auto p-3 sm:p-5 border w-full max-w-[95%] sm:max-w-4xl shadow-lg rounded-md bg-white dark:bg-gray-800 h-[95vh] sm:h-[85vh] flex flex-col">
        <h3
          id="apply-modal-title"
          className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 mb-4"
        >
          {t('jobBoard.applyModal.title', { postTitle: jobPosting.title })}
        </h3>

        <div className="flex-1 overflow-y-auto">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {t('jobBoard.applyModal.selectTimeSlotRole', '시간대 및 역할 선택 (여러 개 선택 가능)')}
          </label>

          {/* 일자별 인원 요구사항 표시 */}
          {jobPosting.dateSpecificRequirements && jobPosting.dateSpecificRequirements.length > 0 ? (
            jobPosting.dateSpecificRequirements.map(
              (dateReq: DateSpecificRequirement, dateIndex: number) => {
                // 다중일 체크 - 첫 번째 timeSlot의 duration을 확인 (모든 timeSlot이 동일한 duration을 가짐)
                const firstTimeSlot = dateReq.timeSlots?.[0];
                const hasMultiDuration =
                  firstTimeSlot?.duration?.type === 'multi' && firstTimeSlot?.duration?.endDate;

                let dateDisplay = formatDateUtil(dateReq.date);
                let expandedDates: string[] = [];

                if (
                  hasMultiDuration &&
                  firstTimeSlot &&
                  firstTimeSlot.duration &&
                  firstTimeSlot.duration.endDate
                ) {
                  const endDate = firstTimeSlot.duration.endDate;
                  dateDisplay = `${formatDateUtil(dateReq.date)} ~ ${formatDateUtil(endDate)}`;
                  // 다중 날짜인 경우 날짜 범위를 확장하여 각 날짜별로 선택 가능하게 함
                  const startDate = dateToString(dateReq.date);

                  if (startDate && endDate) {
                    expandedDates = generateDateRange(startDate, endDate);
                  }
                }

                // 다중 날짜인 경우 그룹화하여 표시
                if (expandedDates.length > 0) {
                  return (
                    <div
                      key={dateIndex}
                      className="mb-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 overflow-hidden"
                    >
                      <div className="p-3 bg-gradient-to-r from-blue-100 dark:from-blue-900/40 to-blue-50 dark:to-blue-900/20 border-b border-blue-200 dark:border-blue-800">
                        <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                          📅 {dateDisplay} ({expandedDates.length}일)
                        </h4>
                      </div>
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20">
                        {dateReq.timeSlots.map((ts: TimeSlot, tsIndex: number) => (
                          <div key={tsIndex} className="mb-4">
                            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                              ⏰{' '}
                              {ts.isTimeToBeAnnounced ? (
                                <span className="text-orange-600">
                                  {t('jobBoard.applyModal.timeTBA', '미정')}
                                  {ts.tentativeDescription && (
                                    <span className="text-gray-600 dark:text-gray-400 font-normal ml-2">
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
                                  const count =
                                    jobPosting.confirmedStaff?.filter(
                                      (staff) =>
                                        staff.timeSlot === ts.time &&
                                        staff.role === r.name &&
                                        staff.date === date
                                    ).length || 0;
                                  return sum + count;
                                }, 0);

                                // 일당 평균 확정 인원
                                const confirmedCountPerDay = Math.floor(
                                  totalConfirmedCount / expandedDates.length
                                );
                                const isFull = confirmedCountPerDay >= r.count;
                                const isGroupChecked = isGroupSelected(
                                  ts.time,
                                  r.name,
                                  expandedDates
                                );

                                return (
                                  <label
                                    key={roleIndex}
                                    className={`flex items-center p-2 rounded cursor-pointer ${
                                      isFull
                                        ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed'
                                        : isGroupChecked
                                          ? 'bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700'
                                          : 'bg-white/50 dark:bg-gray-700/50 hover:bg-white dark:hover:bg-gray-700 border border-blue-200 dark:border-blue-600'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isGroupChecked}
                                      disabled={isFull}
                                      onChange={(e) =>
                                        handleGroupAssignmentChange(
                                          ts.time,
                                          r.name,
                                          expandedDates,
                                          e.target.checked,
                                          ts.duration
                                        )
                                      }
                                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded disabled:cursor-not-allowed"
                                    />
                                    <span
                                      className={`ml-3 ${
                                        isFull
                                          ? 'text-gray-400 dark:text-gray-500'
                                          : 'text-gray-700 dark:text-gray-200'
                                      }`}
                                    >
                                      <span className="font-medium">
                                        👤 {t(`roles.${r.name}`, r.name)}: {r.count}명
                                      </span>
                                      <span className="text-sm text-blue-600 ml-2">
                                        ({expandedDates.length}일)
                                      </span>
                                      <span
                                        className={`ml-2 text-xs ${
                                          isFull
                                            ? 'text-red-500 dark:text-red-400 font-medium'
                                            : 'text-gray-500 dark:text-gray-400'
                                        }`}
                                      >
                                        {isFull
                                          ? t('jobBoard.applyModal.closed', '마감')
                                          : `(${confirmedCountPerDay}/${r.count})`}
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
                    <div
                      key={dateIndex}
                      className="mb-6 border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20"
                    >
                      <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-3">
                        📅 {dateDisplay}
                      </h4>
                      {dateReq.timeSlots.map((ts: TimeSlot, tsIndex: number) => (
                        <div key={tsIndex} className="mb-4 pl-4 border-l-2 border-blue-300">
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2 flex items-center">
                            ⏰{' '}
                            {ts.isTimeToBeAnnounced ? (
                              <span className="text-orange-600">
                                {t('jobBoard.applyModal.timeTBA', '미정')}
                                {ts.tentativeDescription && (
                                  <span className="text-gray-600 dark:text-gray-300 font-normal ml-2">
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
                              const dateString = dateToString(dateReq.date);

                              const assignment: Assignment = {
                                timeSlot: ts.time,
                                role: r.name,
                                dates: [dateString],
                                isGrouped: false,
                                duration: {
                                  type: 'single',
                                  startDate: dateString,
                                },
                              };
                              const confirmedCount =
                                jobPosting.confirmedStaff?.filter(
                                  (staff) =>
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
                                    isFull
                                      ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed'
                                      : isSelected
                                        ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700'
                                        : 'bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    disabled={isFull}
                                    onChange={(e) =>
                                      onAssignmentChange(assignment, e.target.checked)
                                    }
                                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 dark:border-gray-600 rounded disabled:cursor-not-allowed"
                                  />
                                  <span
                                    className={`ml-3 text-sm ${
                                      isFull
                                        ? 'text-gray-400 dark:text-gray-500'
                                        : 'text-gray-700 dark:text-gray-200'
                                    }`}
                                  >
                                    👤 {t(`roles.${r.name}`, r.name)}
                                    <span
                                      className={`ml-2 text-xs ${
                                        isFull
                                          ? 'text-red-500 dark:text-red-400 font-medium'
                                          : 'text-gray-500 dark:text-gray-400'
                                      }`}
                                    >
                                      (
                                      {isFull
                                        ? t('jobBoard.applyModal.closed', '마감')
                                        : `${confirmedCount}/${r.count}`}
                                      )
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
              }
            )
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>
                {t('jobBoard.applyModal.noAvailableTimeSlots', '지원 가능한 시간대가 없습니다.')}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-between mt-4">
          <div>
            {hasPreQuestions && onBack && (
              <button
                onClick={onBack}
                className="py-3 px-6 sm:py-2 sm:px-4 bg-blue-500 dark:bg-blue-600 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-500 min-h-[48px] text-sm sm:text-base"
                aria-label={t('jobBoard.applyModal.backToEdit', '뒤로 (수정)')}
              >
                {t('jobBoard.applyModal.backToEdit', '뒤로 (수정)')}
              </button>
            )}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={onClose}
              className="py-3 px-6 sm:py-2 sm:px-4 bg-gray-500 dark:bg-gray-600 text-white rounded hover:bg-gray-700 dark:hover:bg-gray-700 min-h-[48px] text-sm sm:text-base"
              aria-label={t('common.cancel')}
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={onApply}
              disabled={selectedAssignments.length === 0 || isProcessing}
              className="py-3 px-6 sm:py-2 sm:px-4 bg-green-600 dark:bg-green-700 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 disabled:bg-gray-400 dark:disabled:bg-gray-600 min-h-[48px] text-sm sm:text-base"
              aria-label={t('jobBoard.applyModal.applyWithCount', {
                count: selectedAssignments.length,
              })}
              aria-disabled={selectedAssignments.length === 0 || isProcessing}
            >
              {isProcessing
                ? t('jobBoard.applying')
                : t('jobBoard.applyModal.applyWithCount', {
                    count: selectedAssignments.length,
                    defaultValue: `지원하기 (${selectedAssignments.length}개)`,
                  })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApplyModal;
