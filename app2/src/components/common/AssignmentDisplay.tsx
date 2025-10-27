import React from 'react';
import { useTranslation } from 'react-i18next';
import { Assignment } from '../../types/application'; // 실제 사용 중
import { formatDate as formatDateUtil } from '../../utils/jobPosting/dateUtils';

interface FirebaseTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate?: () => Date;
}

type DateValue = string | Date | FirebaseTimestamp;

// Note: formatDateTimeValue 함수는 필요시 추가 가능

const formatDateOnly = (value: DateValue): string => {
  return value ? formatDateUtil(value) : '날짜 미정';
};

interface AssignmentDisplayProps {
  assignments: Assignment[];
  status: string;
}

/**
 * 🎯 통합 assignments 표시 컴포넌트
 * MyApplicationsTab과 ApplicantCard에서 공통으로 사용
 * 날짜별 그룹화 및 그룹선택/개별선택 구분 표시
 */
const AssignmentDisplay: React.FC<AssignmentDisplayProps> = ({ assignments, status }) => {
  const { t } = useTranslation();
  
  // assignments를 처리 방식에 따라 분류 및 날짜별 그룹화
  const processAssignments = () => {
    const dateGroups: Array<{
      dateKey: string;
      dateDisplay: string;
      checkMethod: 'group' | 'individual';
      isGroupSelection: boolean;
      timeSlots: Array<{
        timeSlot: string;
        roles: string[];
      }>;
    }> = [];

    assignments.forEach((assignment) => {
      // checkMethod가 없는 경우 기본값 처리
      const checkMethod = assignment.checkMethod || 
        (assignment.dates && assignment.dates.length > 1 && assignment.isGrouped ? 'group' : 'individual');
      
      // 그룹 선택과 개별 선택 구분 표시
      const isGroupSelection: boolean = checkMethod === 'group' || Boolean(assignment.roles && assignment.roles.length > 0);
      
      if (!assignment.dates || assignment.dates.length === 0) return;

      if (checkMethod === 'group') {
        // 그룹선택: 날짜 범위로 표시
        const sortedDates = [...assignment.dates].sort();
        const dateDisplay = sortedDates.length > 1 ? 
          `${formatDateOnly(sortedDates[0] || '')} ~ ${formatDateOnly(sortedDates[sortedDates.length - 1] || '')}` :
          formatDateOnly(sortedDates[0] || '');
        
        const dateKey = `group-${sortedDates.join('-')}-${assignment.timeSlot}`;
        
        // 그룹선택의 역할들 수집
        const roles: string[] = [];
        if (assignment.roles && assignment.roles.length > 0) {
          roles.push(...assignment.roles);
        } else if (assignment.role) {
          roles.push(assignment.role);
        }

        // 같은 날짜 범위와 시간대의 기존 그룹 찾기
        let existingGroup = dateGroups.find(group => 
          group.dateKey === dateKey && group.checkMethod === 'group'
        );

        if (!existingGroup) {
          // 새로운 그룹선택 그룹 생성
          existingGroup = {
            dateKey,
            dateDisplay,
            checkMethod,
            isGroupSelection,
            timeSlots: [{
              timeSlot: assignment.timeSlot,
              roles: []
            }]
          };
          dateGroups.push(existingGroup);
        }

        // 기존 시간대 슬롯에 역할 추가
        const timeSlot = existingGroup.timeSlots[0];
        if (timeSlot) {
          roles.forEach(role => {
            if (!timeSlot.roles.includes(role)) {
              timeSlot.roles.push(role);
            }
          });
        }

      } else {
        // 개별선택: 각 날짜별로 분리하여 표시
        assignment.dates.forEach((date: DateValue) => {
          const dateDisplay = formatDateOnly(date || '');
          const dateKey = `individual-${date}`;
          
          // 같은 날짜의 기존 그룹 찾기
          let existingGroup = dateGroups.find(group => 
            group.dateKey === dateKey && group.checkMethod === 'individual'
          );
          
          if (!existingGroup) {
            // 새로운 날짜 그룹 생성
            const newGroup = {
              dateKey,
              dateDisplay,
              checkMethod,
              isGroupSelection,
              timeSlots: [] as Array<{
                timeSlot: string;
                roles: string[];
              }>
            };
            dateGroups.push(newGroup);
            existingGroup = newGroup;
          }
          
          // 같은 시간대의 기존 슬롯 찾기
          let existingTimeSlot = existingGroup.timeSlots.find(slot => 
            slot.timeSlot === assignment.timeSlot
          );
          
          if (!existingTimeSlot) {
            // 새로운 시간대 슬롯 생성
            existingTimeSlot = {
              timeSlot: assignment.timeSlot,
              roles: []
            };
            existingGroup.timeSlots.push(existingTimeSlot);
          }
          
          // 역할 추가
          const rolesToAdd: string[] = [];
          if (assignment.roles && assignment.roles.length > 0) {
            rolesToAdd.push(...assignment.roles);
          } else if (assignment.role) {
            rolesToAdd.push(assignment.role);
          }
          
          rolesToAdd.forEach(role => {
            if (!existingTimeSlot!.roles.includes(role)) {
              existingTimeSlot!.roles.push(role);
            }
          });
        });
      }
    });

    return dateGroups;
  };

  const dateGroups = processAssignments();

  return (
    <div className="space-y-2">
      {dateGroups.map((group) => (
        <div key={group.dateKey} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
          {/* 시간대별 역할 표시 - 확정 상태에서는 간소화 */}
          <div className="space-y-1">
            {group.timeSlots.map((timeSlot, slotIndex) => (
              <div key={slotIndex}>
                {status === 'confirmed' ? (
                  // 확정 상태: 날짜 시간 역할 순서로 한 줄 표시
                  <div className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                    📅 {group.dateDisplay} ⏰ {timeSlot.timeSlot} 👤 {timeSlot.roles.filter(role => role).map(role => t(`roles.${role}`) || role).join(', ')}
                  </div>
                ) : (
                  // 대기/확정되지 않은 상태: 기존 표시 방식 유지
                  <>
                    {/* 날짜 헤더 */}
                    <div className="text-blue-600 dark:text-blue-400 font-medium mb-2 flex items-center space-x-2">
                      <span>📅 {group.dateDisplay}</span>
                    </div>
                    <div className="ml-4 flex items-center space-x-2 text-gray-700 dark:text-gray-300">
                      <span>⏰ {timeSlot.timeSlot}</span>
                      <span>-</span>
                      <div className="font-medium">
                        {group.isGroupSelection ? (
                          // 그룹 선택: 여러 역할을 배지로 표시
                          <div className="flex flex-wrap gap-1">
                            {timeSlot.roles.filter(role => role).map((role, roleIndex) => (
                              <span key={roleIndex} className="bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded text-sm">
                                {t(`roles.${role}`) || role}
                              </span>
                            ))}
                          </div>
                        ) : (
                          // 개별 선택: 역할들을 쉼표로 구분하여 표시
                          <span>
                            {timeSlot.roles.filter(role => role).map(role => t(`roles.${role}`) || role).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AssignmentDisplay;