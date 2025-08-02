import React from 'react';
import { DateSpecificRequirement } from '../../types/jobPosting';
import { useDateUtils } from '../../hooks/useDateUtils';
import { createNewDateSpecificRequirement } from '../../utils/jobPosting/jobPostingHelpers';
import TimeSlotManager from './TimeSlotManager';
import Button from '../common/Button';
import DateDropdownSelector from '../DateDropdownSelector';

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

  // 날짜 추가
  const addDateRequirement = () => {
    const availableDates = generateDateRange(startDate, endDate);
    const usedDates = requirements.map(req => req.date);
    const unusedDate = availableDates.find(date => !usedDates.includes(date));
    
    if (unusedDate) {
      const newRequirement = createNewDateSpecificRequirement(unusedDate);
      onRequirementsChange([...requirements, newRequirement]);
    } else {
      alert('시작 날짜와 종료 날짜 범위 내에 추가할 수 있는 날짜가 없습니다.');
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
                value={toDropdownValue(requirement.date)}
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
            <TimeSlotManager
            timeSlots={requirement.timeSlots}
            onTimeSlotChange={(timeSlotIndex, value) => 
              onDateSpecificTimeSlotChange(requirementIndex, timeSlotIndex, value)
            }
            onTimeToBeAnnouncedToggle={(timeSlotIndex, isAnnounced) => 
              onDateSpecificTimeToBeAnnouncedToggle(requirementIndex, timeSlotIndex, isAnnounced)
            }
            onTentativeDescriptionChange={(timeSlotIndex, description) => 
              onDateSpecificTentativeDescriptionChange(requirementIndex, timeSlotIndex, description)
            }
            onRoleChange={(timeSlotIndex, roleIndex, field, value) => 
              onDateSpecificRoleChange(requirementIndex, timeSlotIndex, roleIndex, field, value)
            }
            onAddRole={(timeSlotIndex) => addRoleToTimeSlot(requirementIndex, timeSlotIndex)}
            onRemoveRole={(timeSlotIndex, roleIndex) => 
              removeRoleFromTimeSlot(requirementIndex, timeSlotIndex, roleIndex)
            }
            onRemoveTimeSlot={(timeSlotIndex) => removeTimeSlotFromDate(requirementIndex, timeSlotIndex)}
          />
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