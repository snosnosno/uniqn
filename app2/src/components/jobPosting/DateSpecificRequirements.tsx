import React from 'react';
import { DateSpecificRequirement } from '../../types/jobPosting';
import { useDateUtils } from '../../hooks/useDateUtils';
import { createNewDateSpecificRequirement, PREDEFINED_ROLES, getRoleDisplayName } from '../../utils/jobPosting/jobPostingHelpers';
import Button from '../ui/Button';
import DateDropdownSelector from '../time/DateDropdownSelector';
import { Select } from '../common/Select';
import { toast } from '../../utils/toast';

interface DateSpecificRequirementsProps {
  requirements: DateSpecificRequirement[];
  startDate: string;
  endDate: string;
  onRequirementsChange: (requirements: DateSpecificRequirement[]) => void;
  onDateSpecificTimeSlotChange: (dateIndex: number, timeSlotIndex: number, value: string) => void;
  onDateSpecificTimeToBeAnnouncedToggle: (dateIndex: number, timeSlotIndex: number, isAnnounced: boolean) => void;
  onDateSpecificTentativeDescriptionChange: (dateIndex: number, timeSlotIndex: number, description: string) => void;
  onDateSpecificRoleChange: (dateIndex: number, timeSlotIndex: number, roleIndex: number, field: 'name' | 'count', value: string | number) => void;
}

const DateSpecificRequirements: React.FC<DateSpecificRequirementsProps> = ({
  requirements,
  startDate,
  endDate,
  onRequirementsChange,
  onDateSpecificTimeSlotChange,
  onDateSpecificTimeToBeAnnouncedToggle,
  onDateSpecificTentativeDescriptionChange,
  onDateSpecificRoleChange,
}) => {
  const { toDropdownValue, fromDropdownValue, generateDateRange } = useDateUtils();
  const [customRoleNames, setCustomRoleNames] = React.useState<Record<string, string>>({});

  // 날짜 추가
  const addDateRequirement = () => {
    const availableDates = generateDateRange(startDate, endDate);
    const usedDates = requirements.map(req => req.date);
    const unusedDate = availableDates.find(date => !usedDates.includes(date));

    if (unusedDate) {
      const newRequirement = createNewDateSpecificRequirement(unusedDate);
      onRequirementsChange([...requirements, newRequirement]);
    } else {
      toast.warning('시작 날짜와 종료 날짜 범위 내에 추가할 수 있는 날짜가 없습니다.');
    }
  };

  // 날짜 제거
  const removeDateRequirement = (index: number) => {
    const newRequirements = requirements.filter((_, i) => i !== index);
    onRequirementsChange(newRequirements);
  };

  // 날짜 변경
  const handleDateChange = (requirementIndex: number, value: { year?: string; month?: string; day?: string }) => {
    const newDate = fromDropdownValue(value);
    const newRequirements = [...requirements];
    const requirement = newRequirements[requirementIndex];
    if (requirement) {
      requirement.date = newDate;
    }
    onRequirementsChange(newRequirements);
  };

  // 시간대 추가
  const addTimeSlotToDate = (requirementIndex: number) => {
    const newRequirements = [...requirements];
    const requirement = newRequirements[requirementIndex];
    if (requirement) {
      requirement.timeSlots.push({
        time: '09:00',
        roles: [{ name: 'dealer', count: 1 }],
        isTimeToBeAnnounced: false,
        tentativeDescription: ''
      });
    }
    onRequirementsChange(newRequirements);
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
      timeSlot.roles = 
        timeSlot.roles.filter((_, i) => i !== roleIndex);
    }
    onRequirementsChange(newRequirements);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-medium text-gray-700">일자별 인원 요구사항</h4>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={addDateRequirement}
        >
          날짜 추가
        </Button>
      </div>

      {requirements.map((requirement, requirementIndex) => (
        <div key={requirementIndex} className="border border-gray-300 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 flex justify-between items-center border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold text-gray-700">📅</span>
              <DateDropdownSelector
                value={toDropdownValue(typeof requirement.date === 'string' ? requirement.date : '')}
                onChange={(value) => handleDateChange(requirementIndex, value)}
                minDate={startDate}
                maxDate={endDate}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => addTimeSlotToDate(requirementIndex)}
              >
                시간대 추가
              </Button>
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

          <div className="p-4">
            {/* TimeSlot 관리 UI 직접 구현 */}
            <div className="space-y-4">
              {requirement.timeSlots.map((timeSlot, timeSlotIndex) => (
                <div key={timeSlotIndex} className="border border-gray-200 rounded-md p-4 bg-white">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-gray-700">⏰ 시간대 {timeSlotIndex + 1}</span>
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
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">시간 미정</span>
                    </label>
                  </div>

                  {/* 시간 입력 또는 미정 설명 */}
                  {timeSlot.isTimeToBeAnnounced ? (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        미정 시간 설명
                      </label>
                      <input
                        type="text"
                        value={timeSlot.tentativeDescription || ''}
                        onChange={(e) =>
                          onDateSpecificTentativeDescriptionChange(requirementIndex, timeSlotIndex, e.target.value)
                        }
                        placeholder="예: 토너먼트 진행 상황에 따라 결정"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  ) : (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        시간
                      </label>
                      <input
                        type="time"
                        value={timeSlot.time}
                        onChange={(e) =>
                          onDateSpecificTimeSlotChange(requirementIndex, timeSlotIndex, e.target.value)
                        }
                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  )}

                  {/* 역할 관리 */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h5 className="text-sm font-medium text-gray-700">필요 역할</h5>
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
                        <div key={roleIndex} className="flex items-center space-x-2 p-3 bg-gray-50 rounded-md">
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
                                    // 기타가 아닌 경우 커스텀 이름 제거
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
                                    // 실제 역할명을 커스텀 값으로 업데이트
                                    onDateSpecificRoleChange(requirementIndex, timeSlotIndex, roleIndex, 'name', e.target.value || 'other');
                                  }}
                                  placeholder="역할명을 입력하세요"
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                            value={role.count}
                            onChange={(e) =>
                              onDateSpecificRoleChange(requirementIndex, timeSlotIndex, roleIndex, 'count', parseInt(e.target.value) || 1)
                            }
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                <div className="text-center py-6 text-gray-500">
                  <p className="text-sm">시간대를 추가해주세요.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {requirements.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>날짜별 요구사항을 추가해주세요.</p>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={addDateRequirement}
            className="mt-2"
          >
            첫 번째 날짜 추가
          </Button>
        </div>
      )}
    </div>
  );
};

export default DateSpecificRequirements;