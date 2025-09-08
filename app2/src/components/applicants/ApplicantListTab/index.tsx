import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../contexts/AuthContext';

// Types
import { Assignment, SelectedAssignments } from './types';

// Hooks
import { useApplicantData } from './hooks/useApplicantData';
import { useApplicantActions } from './hooks/useApplicantActions';

// Components
import ApplicantCard from './ApplicantCard';
import MultiSelectControls from './MultiSelectControls';
import ApplicantActions from './ApplicantActions';

// Utils - hasMultipleSelections 제거 (더 이상 필요 없음)

interface ApplicantListTabProps {
  jobPosting?: any;
}

/**
 * 지원자 목록을 관리하는 메인 탭 컴포넌트
 */
const ApplicantListTab: React.FC<ApplicantListTabProps> = ({ jobPosting }) => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  
  // 지원자 데이터 관리
  const { applicants, loadingApplicants, refreshApplicants } = useApplicantData(jobPosting?.id);
  
  // 선택된 할당 정보 관리
  const [selectedAssignment, setSelectedAssignment] = useState<SelectedAssignments>({});
  
  // 지원자 액션 관리 (확정/취소)
  const {
    canEdit,
    isProcessing,
    handleConfirmApplicant,
    handleCancelConfirmation
  } = useApplicantActions({
    jobPosting,
    currentUser,
    onRefresh: refreshApplicants
  });

  // 초기 할당 상태 설정
  React.useEffect(() => {
    const initialAssignments: SelectedAssignments = {};
    applicants.forEach(applicant => {
      initialAssignments[applicant.id] = [];
    });
    setSelectedAssignment(initialAssignments);
  }, [applicants]);

  /**
   * 다중 선택용 체크박스 토글 함수 (날짜별 중복 방지 강화)
   */
  const handleMultipleAssignmentToggle = useCallback((applicantId: string, value: string, isChecked: boolean) => {
    
    // 날짜별 형식: date__timeSlot__role (3부분) 또는 기존 형식: timeSlot__role (2부분)
    const parts = value.split('__');
    let timeSlot = '', role = '', date = '';
    
    if (parts.length === 3) {
      // 날짜별 요구사항: date__timeSlot__role
      date = parts[0] || '';
      timeSlot = parts[1] || '';
      role = parts[2] || '';
    } else if (parts.length === 2) {
      // 기존 형식: timeSlot__role
      timeSlot = parts[0] || '';
      role = parts[1] || '';
    }
    
    const newAssignment: Assignment = { 
      timeSlot: timeSlot.trim(), 
      role: role.trim(), 
      dates: date.trim() ? [date.trim()] : [],
      isGrouped: false,
      checkMethod: 'individual', // 개별 선택으로 마킹
      duration: {
        type: 'single',
        startDate: date.trim()
      }
    };
    
    setSelectedAssignment(prev => {
      const currentAssignments = prev[applicantId] || [];
      
      if (isChecked) {
        // 체크됨: 같은 날짜에 이미 선택된 항목이 있는지 확인
        const sameDate = newAssignment.dates[0] || '';
        const alreadySelectedInSameDate = currentAssignments.some(assignment => 
          assignment.dates.length > 0 && assignment.dates[0] === sameDate && sameDate.trim() !== ''
        );
        
        if (alreadySelectedInSameDate && sameDate.trim() !== '') {
          // 사용자에게 알림 없이 조용히 차단 (UI에서 이미 시각적으로 표시됨)
          return prev;
        }
        
        // 완전 중복 체크
        const isDuplicate = currentAssignments.some(assignment => 
          assignment.timeSlot === newAssignment.timeSlot && 
          assignment.role === newAssignment.role && 
          assignment.dates.length > 0 && newAssignment.dates.length > 0 &&
          assignment.dates[0] === newAssignment.dates[0]
        );
        
        if (isDuplicate) {
          return prev;
        }
        
        
        return {
          ...prev,
          [applicantId]: [...currentAssignments, newAssignment]
        };
      } else {
        // 체크 해제됨: 배열에서 제거
        const filtered = currentAssignments.filter(assignment => 
          !(assignment.timeSlot === newAssignment.timeSlot && 
            assignment.role === newAssignment.role && 
            assignment.dates.length > 0 && newAssignment.dates.length > 0 &&
            assignment.dates[0] === newAssignment.dates[0])
        );
        
        
        return {
          ...prev,
          [applicantId]: filtered
        };
      }
    });
  }, []);

  // handleSingleAssignmentChange 함수 제거 - 더 이상 사용하지 않음

  // 로딩 중 표시
  if (!jobPosting) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center min-h-96">
          <div className="text-lg text-gray-500">공고 정보를 불러올 수 없습니다.</div>
        </div>
      </div>
    );
  }

  if (loadingApplicants) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center min-h-96">
          <div className="text-lg">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-1 sm:p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base md:text-lg font-medium">
          {loadingApplicants ? (
            <span>지원자 목록 (로딩 중...)</span>
          ) : (
            <span className="hidden sm:inline">지원자 목록 (총 {applicants.length}명)</span>
          )}
          <span className="sm:hidden">지원자 ({applicants.length}명)</span>
        </h3>
        <button
          onClick={refreshApplicants}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          disabled={isProcessing}
        >
          {t('common.refresh')}
        </button>
      </div>

      {applicants.length === 0 ? (
        <div className="bg-gray-50 p-6 rounded-lg text-center">
          <p className="text-gray-600">{t('jobPostingAdmin.applicants.none')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {applicants.map((applicant) => {
            const assignments = selectedAssignment[applicant.id] || [];
            
            return (
              <ApplicantCard key={applicant.id} applicant={applicant} jobPosting={jobPosting}>
                {/* 지원 중 상태에서의 액션 - 체크박스 UI만 사용 */}
                {applicant.status === 'applied' && (
                  <MultiSelectControls
                    applicant={applicant}
                    jobPosting={jobPosting}
                    selectedAssignments={assignments}
                    onAssignmentToggle={(value, isChecked) => 
                      handleMultipleAssignmentToggle(applicant.id, value, isChecked)
                    }
                    onConfirm={() => handleConfirmApplicant(applicant, assignments)}
                    canEdit={canEdit}
                    _onRefresh={refreshApplicants}
                    applications={applicants}  // 전체 지원자 데이터 전달 (카운트 계산용)
                  />
                )}

                {/* 확정된 상태에서의 액션 */}
                {applicant.status === 'confirmed' && (
                  <>
                    {(() => {
                      return null;
                    })()}
                    <ApplicantActions
                      applicant={applicant}
                      jobPosting={jobPosting}
                      selectedAssignment={null}
                      onAssignmentChange={() => {}}
                      onConfirm={() => {}}
                      onCancelConfirmation={() => handleCancelConfirmation(applicant)}
                      canEdit={canEdit}
                    />
                  </>
                )}
              </ApplicantCard>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ApplicantListTab;