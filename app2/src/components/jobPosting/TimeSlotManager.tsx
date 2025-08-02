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
  onAddTimeSlot?: () => void;
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {timeSlots.map((timeSlot, timeSlotIndex) => (
          <div key={timeSlotIndex} className="border border-gray-200 rounded-lg p-4">
            {/* 시간 설정 헤더 */}
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
              <div className="flex items-center space-x-3 flex-1">
                <span className="text-sm font-medium text-gray-700 whitespace-nowrap">시간:</span>
                {!timeSlot.isTimeToBeAnnounced ? (
                  <Input
                    type="time"
                    value={timeSlot.time === '미정' ? '' : timeSlot.time}
                    onChange={(e) => onTimeSlotChange(timeSlotIndex, e.target.value)}
                    className="flex-1 max-w-xs"
                    required
                  />
                ) : (
                  <span className="text-sm text-gray-500 bg-yellow-50 px-3 py-1.5 rounded flex-1">미정</span>
                )}
                <div className="flex items-center space-x-2 ml-auto">
                  <input
                    type="checkbox"
                    id={`timeToBeAnnounced-${timeSlotIndex}`}
                    checked={timeSlot.isTimeToBeAnnounced}
                    onChange={(e) => onTimeToBeAnnouncedToggle(timeSlotIndex, e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor={`timeToBeAnnounced-${timeSlotIndex}`} className="text-sm text-gray-600 whitespace-nowrap">
                    미정
                  </label>
                </div>
              </div>
              {showRemoveButton && timeSlots.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemoveTimeSlot(timeSlotIndex)}
                  className="text-red-500 hover:text-red-700 text-lg ml-3"
                  title="시간대 삭제"
                >
                  ✕
                </button>
              )}
            </div>

            {/* 미정 설명 */}
            {timeSlot.isTimeToBeAnnounced && (
              <div className="mb-3">
                <Input
                  type="text"
                  placeholder="미정 관련 설명 (선택사항)"
                  value={timeSlot.tentativeDescription || ''}
                  onChange={(e) => onTentativeDescriptionChange(timeSlotIndex, e.target.value)}
                  className="text-sm"
                />
              </div>
            )}

            {/* 역할 설정 */}
            <div className="space-y-2">
              {timeSlot.roles.map((role, roleIndex) => (
                <div key={roleIndex} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <select
                      value={role.name}
                      onChange={(e) => onRoleChange(timeSlotIndex, roleIndex, 'name', e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">역할 선택</option>
                      {PREDEFINED_ROLES.map(roleName => (
                        <option key={roleName} value={roleName}>
                          {{
                            'dealer': '딜러',
                            'floor': '플로어',
                            'serving': '서빙',
                            'tournament_director': '토너먼트 디렉터',
                            'chip_master': '칩 마스터',
                            'registration': '레지스트레이션',
                            'security': '보안요원',
                            'cashier': '캐셔'
                          }[roleName] || roleName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="number"
                    min="1"
                    value={role.count}
                    onChange={(e) => onRoleChange(timeSlotIndex, roleIndex, 'count', parseInt(e.target.value))}
                    className="w-16 px-2 py-2 text-center border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-sm text-gray-500 whitespace-nowrap">명</span>
                  {timeSlot.roles.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onRemoveRole(timeSlotIndex, roleIndex)}
                      className="text-red-500 hover:text-red-700 text-lg"
                      title="역할 삭제"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              
              <button
                type="button"
                onClick={() => onAddRole(timeSlotIndex)}
                className="w-full text-center text-sm text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 py-1.5 rounded transition-colors"
              >
                + 역할 추가
              </button>
            </div>
        </div>
      ))}
    </div>
  );
};

export default TimeSlotManager;