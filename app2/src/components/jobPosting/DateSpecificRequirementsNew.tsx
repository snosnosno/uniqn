import React, { useState } from 'react';
import { DateSpecificRequirement, TimeSlot } from '../../types/jobPosting';
import { useDateUtils } from '../../hooks/useDateUtils';
import { createNewDateSpecificRequirement, PREDEFINED_ROLES, getRoleDisplayName } from '../../utils/jobPosting/jobPostingHelpers';
import { convertToDateString } from '../../utils/jobPosting/dateUtils';
import Button from '../ui/Button';
import DateDropdownSelector from '../time/DateDropdownSelector';
import { Select } from '../common/Select';
import { toast } from '../../utils/toast';

interface DateSpecificRequirementsProps {
  requirements: DateSpecificRequirement[];
  onRequirementsChange: (requirements: DateSpecificRequirement[]) => void;
  onDateSpecificTimeSlotChange: (dateIndex: number, timeSlotIndex: number, value: string) => void;
  onDateSpecificTimeToBeAnnouncedToggle: (dateIndex: number, timeSlotIndex: number, isAnnounced: boolean) => void;
  onDateSpecificTentativeDescriptionChange: (dateIndex: number, timeSlotIndex: number, description: string) => void;
  onDateSpecificRoleChange: (dateIndex: number, timeSlotIndex: number, roleIndex: number, field: 'name' | 'count', value: string | number) => void;
}

/**
 * 개선된 날짜별 요구사항 컴포넌트
 * - startDate/endDate 의존성 제거
 * - 날짜 중복 체크
 * - 시간대별 종료 시간 설정
 * - 다음날 종료 지원
 */
const DateSpecificRequirementsNew: React.FC<DateSpecificRequirementsProps> = ({
  requirements,
  onRequirementsChange,
  onDateSpecificTimeSlotChange,
  onDateSpecificTimeToBeAnnouncedToggle,
  onDateSpecificTentativeDescriptionChange,
  onDateSpecificRoleChange,
}) => {
  const { toDropdownValue, fromDropdownValue } = useDateUtils();
  const [customRoleNames, setCustomRoleNames] = useState<Record<string, string>>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // 오늘 날짜를 기본값으로 설정 (월/일 패딩 추가)
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState({
    year: today.getFullYear().toString(),
    month: (today.getMonth() + 1).toString().padStart(2, '0'),
    day: today.getDate().toString().padStart(2, '0')
  });

  // 날짜를 문자열로 변환
  const getDateString = (date: any): string => {
    return convertToDateString(date);
  };

  // 날짜 추가 (중복 체크 포함)
  const addDateRequirement = () => {
    if (!showDatePicker) {
      setShowDatePicker(true);
      return;
    }

    // 최대 날짜 개수 제한 (30개)
    if (requirements.length >= 30) {
      toast.warning('최대 30개의 날짜까지만 추가할 수 있습니다.');
      return;
    }

    const dateStr = fromDropdownValue(selectedDate);
    const selectedDateObj = new Date(dateStr);
    const today = new Date();
    
    // 오늘 날짜를 기준으로 시간 제거 (날짜만 비교)
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const selectedMidnight = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), selectedDateObj.getDate());
    
    // 과거 날짜 체크 (오늘은 선택 가능)
    if (selectedMidnight < todayMidnight) {
      toast.error('과거 날짜는 선택할 수 없습니다.');
      return;
    }
    
    // 1년 이후 날짜 체크
    const oneYearLater = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
    if (selectedMidnight > oneYearLater) {
      toast.error('1년 이후의 날짜는 선택할 수 없습니다.');
      return;
    }
    
    // 중복 체크
    const isDuplicate = requirements.some(req => 
      getDateString(req.date) === dateStr
    );
    
    if (isDuplicate) {
      toast.warning('이미 추가된 날짜입니다. 다른 날짜를 선택해주세요.');
      return;
    }
    
    const newRequirement = createNewDateSpecificRequirement(dateStr);
    // 기본 종료 시간 추가
    if (newRequirement.timeSlots[0]) {
      newRequirement.timeSlots[0].endTime = '18:00';
      newRequirement.timeSlots[0].duration = { type: 'single' };
    }
    
    // 날짜순 자동 정렬
    const updatedRequirements = [...requirements, newRequirement].sort((a, b) => 
      getDateString(a.date).localeCompare(getDateString(b.date))
    );
    
    onRequirementsChange(updatedRequirements);
    
    // 다음 날짜로 이동
    const nextDate = new Date(dateStr);
    nextDate.setDate(nextDate.getDate() + 1);
    setSelectedDate({
      year: nextDate.getFullYear().toString(),
      month: (nextDate.getMonth() + 1).toString(),
      day: nextDate.getDate().toString()
    });
    setShowDatePicker(false);
  };

  // 날짜 변경 (중복 체크 포함)
  const handleDateChange = (requirementIndex: number, value: { year?: string; month?: string; day?: string }) => {
    const newDate = fromDropdownValue(value);
    const selectedDateObj = new Date(newDate);
    const today = new Date();
    
    // 오늘 날짜를 기준으로 시간 제거 (날짜만 비교)
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const selectedMidnight = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), selectedDateObj.getDate());
    
    // 과거 날짜 체크 (오늘은 선택 가능)
    if (selectedMidnight < todayMidnight) {
      toast.error('과거 날짜는 선택할 수 없습니다.');
      return;
    }
    
    // 1년 이후 날짜 체크
    const oneYearLater = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
    if (selectedMidnight > oneYearLater) {
      toast.error('1년 이후의 날짜는 선택할 수 없습니다.');
      return;
    }
    
    // 다른 요구사항과 중복 체크
    const isDuplicate = requirements.some((req, idx) => 
      idx !== requirementIndex && getDateString(req.date) === newDate
    );
    
    if (isDuplicate) {
      toast.warning('이미 추가된 날짜입니다. 다른 날짜를 선택해주세요.');
      return;
    }
    
    const newRequirements = [...requirements];
    const requirement = newRequirements[requirementIndex];
    if (requirement) {
      requirement.date = newDate;
      // 날짜순 재정렬
      newRequirements.sort((a, b) => 
        getDateString(a.date).localeCompare(getDateString(b.date))
      );
    }
    onRequirementsChange(newRequirements);
  };

  // 날짜 제거
  const removeDateRequirement = (index: number) => {
    if (requirements.length === 1) {
      toast.warning('최소 하나의 날짜는 필요합니다.');
      return;
    }
    
    const newRequirements = requirements.filter((_, i) => i !== index);
    onRequirementsChange(newRequirements);
  };

  // 시간대 추가 (종료 시간 포함)
  const addTimeSlotToDate = (requirementIndex: number) => {
    const newRequirements = [...requirements];
    const requirement = newRequirements[requirementIndex];
    if (requirement) {
      const newTimeSlot: TimeSlot = {
        time: '09:00',
        endTime: '18:00', // 기본 종료 시간
        roles: [{ name: 'dealer', count: 1 }],
        isTimeToBeAnnounced: false,
        tentativeDescription: '',
        duration: { type: 'single' }
      };
      requirement.timeSlots.push(newTimeSlot);
    }
    onRequirementsChange(newRequirements);
  };


  // 날짜별 종료일 설정 - 다중 날짜 선택 시 개별 요구사항 생성
  const handleDurationTypeChange = (requirementIndex: number, type: 'single' | 'multi') => {
    const newRequirements = [...requirements];
    const requirement = newRequirements[requirementIndex];
    
    if (requirement) {
      if (type === 'single') {
        // 단일 날짜: duration 정보만 업데이트
        requirement.timeSlots.forEach(slot => {
          slot.duration = { type: 'single' };
          delete slot.duration?.endDate;
        });
      } else {
        // 다중 날짜: 기본값으로 다음날을 종료일로 설정 (UI 표시용)
        const startDate = new Date(getDateString(requirement.date));
        startDate.setDate(startDate.getDate() + 1);
        const defaultEndDate = convertToDateString(startDate);
        
        requirement.timeSlots.forEach(slot => {
          slot.duration = { 
            type: 'multi',
            endDate: defaultEndDate
          };
        });
      }
    }
    
    onRequirementsChange(newRequirements);
  };
  
  // 날짜별 종료일 변경 - UI 표시용으로만 사용, 자동 날짜 생성하지 않음
  const handleDurationEndDateChange = (requirementIndex: number, endDate: string) => {
    const newRequirements = [...requirements];
    const requirement = newRequirements[requirementIndex];
    
    if (requirement) {
      const startDateStr = getDateString(requirement.date);
      const startDate = new Date(startDateStr);
      const endDateObj = new Date(endDate);
      
      // 종료일 검증
      if (endDateObj <= startDate) {
        toast.error('종료일은 시작일보다 이후여야 합니다.');
        return;
      }
      
      // 날짜 범위 검증 (최대 30일)
      const daysDiff = Math.ceil((endDateObj.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 30) {
        toast.warning('날짜 범위는 최대 30일까지만 선택할 수 있습니다.');
        return;
      }
      
      // duration 정보만 업데이트 (UI 표시용)
      requirement.timeSlots.forEach(slot => {
        if (slot.duration?.type === 'multi') {
          slot.duration.endDate = endDate;
        }
      });
      
      onRequirementsChange(newRequirements);
    }
  };

  // 시간대 제거
  const removeTimeSlotFromDate = (requirementIndex: number, timeSlotIndex: number) => {
    const newRequirements = [...requirements];
    const requirement = newRequirements[requirementIndex];
    if (requirement) {
      requirement.timeSlots = requirement.timeSlots.filter(
        (_, i) => i !== timeSlotIndex
      );
    }
    onRequirementsChange(newRequirements);
  };

  // 역할 추가
  const addRoleToTimeSlot = (requirementIndex: number, timeSlotIndex: number) => {
    const newRequirements = [...requirements];
    const requirement = newRequirements[requirementIndex];
    const timeSlot = requirement?.timeSlots[timeSlotIndex];
    
    if (requirement && timeSlot) {
      // 최대 역할 개수 제한 (10개)
      if (timeSlot.roles.length >= 10) {
        toast.warning('한 시간대에 최대 10개의 역할까지만 추가할 수 있습니다.');
        return;
      }
      
      timeSlot.roles.push({
        name: 'dealer',
        count: 1
      });
    }
    onRequirementsChange(newRequirements);
  };

  // 역할 제거
  const removeRoleFromTimeSlot = (requirementIndex: number, timeSlotIndex: number, roleIndex: number) => {
    const newRequirements = [...requirements];
    const requirement = newRequirements[requirementIndex];
    const timeSlot = requirement?.timeSlots[timeSlotIndex];
    if (requirement && timeSlot) {
      timeSlot.roles = timeSlot.roles.filter((_, i) => i !== roleIndex);
    }
    onRequirementsChange(newRequirements);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200">
          일자별 인원 요구사항
        </h4>
        <div className="flex items-center space-x-2">
          {showDatePicker ? (
            <>
              <DateDropdownSelector
                value={selectedDate}
                onChange={(value) => {
                  setSelectedDate({
                    year: value.year || new Date().getFullYear().toString(),
                    month: value.month || (new Date().getMonth() + 1).toString(),
                    day: value.day || new Date().getDate().toString()
                  });
                }}
              />
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={addDateRequirement}
              >
                선택 완료
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowDatePicker(false)}
              >
                취소
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowDatePicker(true)}
            >
              날짜 추가
            </Button>
          )}
        </div>
      </div>

      {requirements.map((requirement, requirementIndex) => {
        const dateStr = getDateString(requirement.date);
        
        return (
          <div key={`${dateStr}-${requirementIndex}`} className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200"></span>
                  <DateDropdownSelector
                    value={toDropdownValue(dateStr)}
                    onChange={(value) => handleDateChange(requirementIndex, value)}
                  />
                </div>
                {requirements.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeDateRequirement(requirementIndex)}
                    className="text-red-500 hover:text-red-700 text-sm font-medium"
                    title="날짜 삭제"
                  >
                    삭제
                  </button>
                )}
              </div>
              
              {/* 여러 날 선택 시 종료일 표시 */}
              {requirement.timeSlots[0]?.duration?.type === 'multi' && (
                <div className="flex items-center space-x-2 mt-2 ml-6">
                  <span className="text-sm text-gray-600 dark:text-gray-300">~</span>
                  <DateDropdownSelector
                    value={toDropdownValue(requirement.timeSlots[0]?.duration?.endDate || dateStr)}
                    onChange={(value) => handleDurationEndDateChange(requirementIndex, fromDropdownValue(value))}
                  />
                </div>
              )}
              
              {/* 날짜별 기간 설정 및 시간대 추가 버튼 */}
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`single-${requirementIndex}`}
                      name={`duration-${requirementIndex}`}
                      checked={requirement.timeSlots[0]?.duration?.type !== 'multi'}
                      onChange={() => handleDurationTypeChange(requirementIndex, 'single')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor={`single-${requirementIndex}`} className="text-sm text-gray-700 dark:text-gray-200">
                      단일 날짜
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`multi-${requirementIndex}`}
                      name={`duration-${requirementIndex}`}
                      checked={requirement.timeSlots[0]?.duration?.type === 'multi'}
                      onChange={() => handleDurationTypeChange(requirementIndex, 'multi')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor={`multi-${requirementIndex}`} className="text-sm text-gray-700 dark:text-gray-200">
                      여러 날
                    </label>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => addTimeSlotToDate(requirementIndex)}
                >
                  시간추가
                </Button>
              </div>
            </div>

            <div className="p-4">
              <div className="space-y-4">
                {requirement.timeSlots.map((timeSlot, timeSlotIndex) => (
                  <div key={timeSlotIndex} className="border border-gray-200 dark:border-gray-700 rounded-md p-4 bg-white dark:bg-gray-800">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          ⏰ 시간대 {timeSlotIndex + 1}
                        </span>
                        {requirement.timeSlots.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeTimeSlotFromDate(requirementIndex, timeSlotIndex)}
                            className="text-red-500 hover:text-red-700 text-sm font-medium"
                            title="시간대 삭제"
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 시간 미정 토글 */}
                    <div className="mb-3">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={timeSlot.isTimeToBeAnnounced || false}
                          onChange={(e) => 
                            onDateSpecificTimeToBeAnnouncedToggle(requirementIndex, timeSlotIndex, e.target.checked)
                          }
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-200">시간 미정</span>
                      </label>
                    </div>

                    {/* 시간 입력 또는 미정 설명 */}
                    {timeSlot.isTimeToBeAnnounced ? (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                          미정 시간 설명
                        </label>
                        <input
                          type="text"
                          value={timeSlot.tentativeDescription || ''}
                          onChange={(e) =>
                            onDateSpecificTentativeDescriptionChange(requirementIndex, timeSlotIndex, e.target.value)
                          }
                          placeholder="예시 : 추후공지"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-xs"
                        />
                      </div>
                    ) : (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                          시간
                        </label>
                        <input
                          type="time"
                          value={timeSlot.time}
                          onChange={(e) =>
                            onDateSpecificTimeSlotChange(requirementIndex, timeSlotIndex, e.target.value)
                          }
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}

                    {/* 역할 관리 */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-200">필요 역할</h5>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => addRoleToTimeSlot(requirementIndex, timeSlotIndex)}
                        >
                          역할 추가
                        </Button>
                      </div>

                      {timeSlot.roles.map((role, roleIndex) => {
                        const roleKey = `${requirementIndex}-${timeSlotIndex}-${roleIndex}`;
                        const isCustomRole = role.name === 'other' || !PREDEFINED_ROLES.includes(role.name);
                        const displayValue = isCustomRole && !PREDEFINED_ROLES.includes(role.name) ? 'other' : role.name;
                        
                        return (
                          <div key={roleIndex} className="flex items-center space-x-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                역할명
                              </label>
                              <div className="space-y-2">
                                <Select
                                  name={`role-${roleKey}`}
                                  value={displayValue}
                                  onChange={(value) => {
                                    if (value === 'other') {
                                      onDateSpecificRoleChange(requirementIndex, timeSlotIndex, roleIndex, 'name', value);
                                    } else {
                                      onDateSpecificRoleChange(requirementIndex, timeSlotIndex, roleIndex, 'name', value);
                                      const newCustomNames = { ...customRoleNames };
                                      delete newCustomNames[roleKey];
                                      setCustomRoleNames(newCustomNames);
                                    }
                                  }}
                                  options={PREDEFINED_ROLES.map(roleName => ({
                                    value: roleName,
                                    label: roleName === 'other' ? '기타 (직접입력)' : getRoleDisplayName(roleName)
                                  }))}
                                  className="text-sm"
                                />
                                {isCustomRole && (
                                  <input
                                    type="text"
                                    value={customRoleNames[roleKey] || (!PREDEFINED_ROLES.includes(role.name) ? role.name : '')}
                                    onChange={(e) => {
                                      const newCustomNames = { ...customRoleNames };
                                      newCustomNames[roleKey] = e.target.value;
                                      setCustomRoleNames(newCustomNames);
                                      onDateSpecificRoleChange(requirementIndex, timeSlotIndex, roleIndex, 'name', e.target.value || 'other');
                                    }}
                                    placeholder="역할명을 입력하세요"
                                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                )}
                              </div>
                            </div>
                            
                            <div className="w-20">
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                인원
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="200"
                                value={role.count || ''}
                                onFocus={(e) => {
                                  e.target.select();
                                  // 기본값 1인 경우 빈 값으로 만들기
                                  if (role.count === 1) {
                                    e.target.value = '';
                                  }
                                }}
                                onBlur={(e) => {
                                  // 포커스 아웃 시 빈 값이면 기본값 1로 복원
                                  if (e.target.value === '') {
                                    onDateSpecificRoleChange(requirementIndex, timeSlotIndex, roleIndex, 'count', 1);
                                  }
                                }}
                                onChange={(e) => {
                                  const newValue = e.target.value;

                                  // 빈 값은 허용 (입력 중)
                                  if (newValue === '') {
                                    return;
                                  }

                                  const numValue = parseInt(newValue, 10);

                                  // 인원수 범위 검증 (1-200명)
                                  if (isNaN(numValue) || numValue < 1 || numValue > 200) {
                                    toast.error('인원수는 1명에서 200명 사이로 입력해주세요.');
                                    return;
                                  }

                                  onDateSpecificRoleChange(requirementIndex, timeSlotIndex, roleIndex, 'count', numValue);
                                }}
                                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            
                            {timeSlot.roles.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeRoleFromTimeSlot(requirementIndex, timeSlotIndex, roleIndex)}
                                className="text-red-500 hover:text-red-700 text-sm p-1"
                                title="역할 삭제"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {requirement.timeSlots.length === 0 && (
                  <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                    <p className="text-sm">시간대를 추가해주세요.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {requirements.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p>날짜별 요구사항을 추가해주세요.</p>
          <p className="text-xs mt-1">연속되지 않은 날짜도 자유롭게 추가할 수 있습니다.</p>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setShowDatePicker(true)}
            className="mt-3"
          >
            첫 번째 날짜 추가
          </Button>
        </div>
      )}
    </div>
  );
};

export default DateSpecificRequirementsNew;