import React from 'react';
import { useTranslation } from 'react-i18next';
import { JobPosting, TimeSlot, RoleRequirement, DateSpecificRequirement, JobPostingUtils } from '../../../types/jobPosting';
import { formatDate as formatDateUtil } from '../../../utils/jobPosting/dateUtils';

interface Assignment {
  timeSlot: string;
  role: string;
  date?: string | any;
}

interface ApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobPosting: JobPosting;
  selectedAssignments: Assignment[];
  onAssignmentChange: (assignment: Assignment, isChecked: boolean) => void;
  onApply: () => void;
  isProcessing: boolean;
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
  isProcessing
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  // 선택된 항목인지 확인
  const isAssignmentSelected = (assignment: Assignment): boolean => {
    return selectedAssignments.some(selected => 
      selected.timeSlot === assignment.timeSlot && 
      selected.role === assignment.role &&
      (assignment.date ? selected.date === assignment.date : !selected.date)
    );
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 sm:top-20 mx-auto p-3 sm:p-5 border w-full max-w-[95%] sm:max-w-4xl shadow-lg rounded-md bg-white max-h-[90vh] sm:max-h-[85vh] overflow-y-auto">
        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
          {t('jobBoard.applyModal.title', { postTitle: jobPosting.title })}
        </h3>
        
        {/* 선택된 항목들 미리보기 */}
        {selectedAssignments.length > 0 && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <h4 className="text-sm font-medium text-green-800 mb-2">
              선택된 항목 ({selectedAssignments.length}개):
            </h4>
            <div className="space-y-1">
              {selectedAssignments.map((assignment, index) => (
                <div key={index} className="text-xs text-green-700">
                  {assignment.date ? `📅 ${formatDateUtil(assignment.date)} - ` : ''}
                  ⏰ {assignment.timeSlot} - 👤 {t(`jobPostingAdmin.create.${assignment.role}`, assignment.role)}
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="max-h-64 overflow-y-auto">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            시간대 및 역할 선택 (여러 개 선택 가능)
          </label>
          
          {/* 일자별 다른 인원 요구사항이 있는 경우 */}
          {JobPostingUtils.hasDateSpecificRequirements(jobPosting) ? (
            jobPosting.dateSpecificRequirements?.map((dateReq: DateSpecificRequirement, dateIndex: number) => (
              <div key={dateIndex} className="mb-6 border border-blue-200 rounded-lg p-4 bg-blue-50">
                <h4 className="text-sm font-semibold text-blue-800 mb-3">
                  📅 {formatDateUtil(dateReq.date)}
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
            ))
          ) : (
            /* 기존 방식: 전체 기간 공통 timeSlots */
            jobPosting.timeSlots?.map((ts: TimeSlot, tsIndex: number) => (
              <div key={tsIndex} className="mb-4 border border-gray-200 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-700 mb-3 flex items-center">
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
                    const assignment = { timeSlot: ts.time, role: r.name };
                    const confirmedCount = jobPosting.confirmedStaff?.filter(staff => 
                      staff.timeSlot === ts.time && 
                      staff.role === r.name
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
            ))
          )}
        </div>
        
        <div className="flex justify-end mt-4 space-x-2">
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
            {isProcessing ? t('jobBoard.applying') : `지원하기 (${selectedAssignments.length}개 선택)`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApplyModal;