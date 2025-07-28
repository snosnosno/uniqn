import React from 'react';
import { TimeSlot } from '../../types/jobPosting';
import { PREDEFINED_ROLES } from '../../utils/jobPosting/jobPostingHelpers';
import Button from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';

interface TimeSlotManagerProps {
  timeSlots: TimeSlot[];
  onTimeSlotChange: (index: number, value: string) => void;
  onTimeToBeAnnouncedToggle: (index: number, isAnnounced: boolean) => void;
  onTentativeDescriptionChange: (index: number, description: string) => void;
  onRoleChange: (timeSlotIndex: number, roleIndex: number, field: 'name' | 'count', value: string | number) => void;
  onAddRole: (timeSlotIndex: number) => void;
  onRemoveRole: (timeSlotIndex: number, roleIndex: number) => void;
  onAddTimeSlot: () => void;
  onRemoveTimeSlot: (index: number) => void;
  showRemoveButton?: boolean;
}

const TimeSlotManager: React.FC<TimeSlotManagerProps> = ({
  timeSlots,
  onTimeSlotChange,
  onTimeToBeAnnouncedToggle,
  onTentativeDescriptionChange,
  onRoleChange,
  onAddRole,
  onRemoveRole,
  onAddTimeSlot,
  onRemoveTimeSlot,
  showRemoveButton = true
}) => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-medium text-gray-700">시간대 및 역할</h4>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onAddTimeSlot}
        >
          시간대 추가
        </Button>
      </div>

      {timeSlots.map((timeSlot, timeSlotIndex) => (
        <div key={timeSlotIndex} className="border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">
              시간대 {timeSlotIndex + 1}
            </span>
            {showRemoveButton && timeSlots.length > 1 && (
              <Button
                type="button"
                variant="danger"
                size="xs"
                onClick={() => onRemoveTimeSlot(timeSlotIndex)}
              >
                삭제
              </Button>
            )}
          </div>

          {/* 시간 설정 */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={`timeToBeAnnounced-${timeSlotIndex}`}
                checked={timeSlot.isTimeToBeAnnounced}
                onChange={(e) => onTimeToBeAnnouncedToggle(timeSlotIndex, e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor={`timeToBeAnnounced-${timeSlotIndex}`} className="text-sm text-gray-700">
                미정
              </label>
            </div>

            {timeSlot.isTimeToBeAnnounced ? (
              <div className="space-y-2">
                <div className="text-sm text-gray-500 bg-yellow-50 p-2 rounded">
                  시간이 "미정"으로 설정됩니다.
                </div>
                <Input
                  type="text"
                  placeholder="미정 관련 설명 (선택사항)"
                  value={timeSlot.tentativeDescription || ''}
                  onChange={(e) => onTentativeDescriptionChange(timeSlotIndex, e.target.value)}
                />
              </div>
            ) : (
              <Input
                type="time"
                value={timeSlot.time === '미정' ? '' : timeSlot.time}
                onChange={(e) => onTimeSlotChange(timeSlotIndex, e.target.value)}
                required
              />
            )}
          </div>

          {/* 역할 설정 */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">필요 역할</span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => onAddRole(timeSlotIndex)}
              >
                + 역할 추가
              </Button>
            </div>

            {timeSlot.roles.map((role, roleIndex) => (
              <div key={roleIndex} className="flex space-x-2 items-center">
                <Select
                  value={role.name}
                  onChange={(value) => onRoleChange(timeSlotIndex, roleIndex, 'name', value)}
                  className="w-48"
                  options={[
                    { value: '', label: '역할 선택' },
                    ...PREDEFINED_ROLES.map(roleName => ({
                      value: roleName,
                      label: {
                        'dealer': '딜러',
                        'floor': '플로어',
                        'serving': '서빙',
                        'tournament_director': '토너먼트 디렉터',
                        'chip_master': '칩 마스터',
                        'registration': '레지스트레이션',
                        'security': '보안요원',
                        'cashier': '캐셔'
                      }[roleName] || roleName
                    }))
                  ]}
                />
                <Input
                  type="number"
                  min="1"
                  value={role.count}
                  onChange={(e) => onRoleChange(timeSlotIndex, roleIndex, 'count', parseInt(e.target.value))}
                  className="w-20"
                />
                <span className="text-sm text-gray-500">명</span>
                {timeSlot.roles.length > 1 && (
                  <Button
                    type="button"
                    variant="danger"
                    size="xs"
                    onClick={() => onRemoveRole(timeSlotIndex, roleIndex)}
                  >
                    삭제
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TimeSlotManager;