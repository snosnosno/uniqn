import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import type { JobPosting } from '@/types/jobPosting';

// Types
import { Assignment, SelectedAssignments } from './types';

// Hooks
import { useApplicantData } from './hooks/useApplicantData';
import { useApplicantActions } from './hooks/useApplicantActions';

// Components
import ApplicantCard from './ApplicantCard';
import MultiSelectControls from './MultiSelectControls';
import ApplicantActions from './ApplicantActions';
import ConfirmModal from '../../modals/ConfirmModal';

// Utils - hasMultipleSelections 제거 (더 이상 필요 없음)

interface ApplicantListTabProps {
  jobPosting?: JobPosting | null;
}

/**
 * 지원자 목록을 관리하는 메인 탭 컴포넌트
 */
const ApplicantListTab: React.FC<ApplicantListTabProps> = ({ jobPosting }) => {
  const { t } = useTranslation();
  const { currentUser, isAdmin } = useAuth();

  // 지원자 데이터 관리
  const { applicants, loadingApplicants, refreshApplicants } = useApplicantData(jobPosting?.id);

  // 선택된 할당 정보 관리
  const [selectedAssignment, setSelectedAssignment] = useState<SelectedAssignments>({});

  // 지원자 액션 관리 (확정/취소)
  const {
    canEdit,
    isProcessing,
    handleConfirmApplicant,
    handleCancelConfirmation,
    cancelConfirmModal,
    setCancelConfirmModal,
    performCancelConfirmation,
  } = useApplicantActions({
    jobPosting,
    currentUser,
    isAdmin,
    onRefresh: refreshApplicants,
  });

  // 초기 할당 상태 설정
  React.useEffect(() => {
    const initialAssignments: SelectedAssignments = {};
    applicants.forEach((applicant) => {
      initialAssignments[applicant.id] = [];
    });
    setSelectedAssignment(initialAssignments);
  }, [applicants]);

  /**
   * 다중 선택용 체크박스 토글 함수 (그룹/개별 선택 지원)
   */
  const handleMultipleAssignmentToggle = useCallback(
    (applicantId: string, value: string, isChecked: boolean) => {
      // 형식: group__dates__timeSlot__role__groupId (5부분) 또는 date__timeSlot__role (3부분) 또는 timeSlot__role (2부분)
      const parts = value.split('__');
      let timeSlot = '',
        role = '',
        dates: string[] = [],
        isGrouped = false,
        groupId = '',
        checkMethod: 'group' | 'individual' = 'individual';

      if (parts.length === 5 && parts[0] === 'group') {
        // 그룹 선택: group__dates__timeSlot__role__groupId
        const dateString = parts[1] || '';
        dates = dateString.split(',').filter((d) => d.trim() !== '');
        timeSlot = parts[2] || '';
        role = parts[3] || '';
        groupId = parts[4] || '';
        isGrouped = true;
        checkMethod = 'group';
      } else if (parts.length === 3) {
        // 개별 날짜 선택: date__timeSlot__role
        const date = parts[0] || '';
        dates = date.trim() ? [date.trim()] : [];
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
        dates: dates,
        isGrouped: isGrouped,
        checkMethod: checkMethod,
        ...(groupId && { groupId: groupId }),
        duration: {
          type: isGrouped ? 'consecutive' : 'single',
          startDate: dates.length > 0 ? dates[0] || '' : '',
        },
      };

      setSelectedAssignment((prev) => {
        const currentAssignments = prev[applicantId] || [];

        if (isChecked) {
          // 체크됨: 중복 체크 및 충돌 방지
          if (isGrouped) {
            // 그룹 선택: 각 날짜에 다른 선택이 있는지 확인
            const hasConflict = dates.some((date) =>
              currentAssignments.some(
                (assignment) =>
                  assignment.dates.includes(date) &&
                  !(
                    assignment.timeSlot === timeSlot &&
                    assignment.role === role &&
                    assignment.isGrouped === isGrouped
                  )
              )
            );

            if (hasConflict) {
              return prev; // 충돌 시 무시
            }

            // 날짜 세트 중복 체크
            const dateSetKey = dates.sort().join(',');
            const isDuplicate = currentAssignments.some((assignment) => {
              const assignmentDateSet = assignment.dates.sort().join(',');
              return (
                assignment.timeSlot === timeSlot &&
                assignment.role === role &&
                assignmentDateSet === dateSetKey &&
                assignment.isGrouped === isGrouped
              );
            });

            if (isDuplicate) {
              return prev;
            }
          } else {
            // 개별 선택: 같은 날짜에 다른 선택이 있는지 확인
            const targetDate = dates.length > 0 ? dates[0] || '' : '';
            if (targetDate.trim() !== '') {
              const hasConflictInDate = currentAssignments.some(
                (assignment) =>
                  assignment.dates.includes(targetDate) &&
                  !(assignment.timeSlot === timeSlot && assignment.role === role)
              );

              if (hasConflictInDate) {
                return prev; // 충돌 시 무시
              }
            }

            // 완전 중복 체크
            const isDuplicate = currentAssignments.some(
              (assignment) =>
                assignment.timeSlot === timeSlot &&
                assignment.role === role &&
                assignment.dates.length === dates.length &&
                dates.every((date) => assignment.dates.includes(date))
            );

            if (isDuplicate) {
              return prev;
            }
          }

          return {
            ...prev,
            [applicantId]: [...currentAssignments, newAssignment],
          };
        } else {
          // 체크 해제됨: 정확한 매칭으로 제거
          const filtered = currentAssignments.filter((assignment) => {
            if (isGrouped) {
              // 그룹 선택 제거: 날짜 세트와 그룹 정보가 일치하는지 확인
              const assignmentDateSet = assignment.dates.sort().join(',');
              const targetDateSet = dates.sort().join(',');
              return !(
                assignment.timeSlot === timeSlot &&
                assignment.role === role &&
                assignmentDateSet === targetDateSet &&
                assignment.isGrouped === isGrouped
              );
            } else {
              // 개별 선택 제거: 날짜와 역할, 시간이 일치하는지 확인
              return !(
                assignment.timeSlot === timeSlot &&
                assignment.role === role &&
                assignment.dates.length === dates.length &&
                dates.every((date) => assignment.dates.includes(date))
              );
            }
          });

          return {
            ...prev,
            [applicantId]: filtered,
          };
        }
      });
    },
    []
  );

  // handleSingleAssignmentChange 함수 제거 - 더 이상 사용하지 않음

  // 로딩 중 표시
  if (!jobPosting) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center min-h-96">
          <div className="text-lg text-gray-500 dark:text-gray-400">
            공고 정보를 불러올 수 없습니다.
          </div>
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
          className="px-3 py-1.5 text-sm bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600"
          disabled={isProcessing}
        >
          {t('common.refresh')}
        </button>
      </div>

      {applicants.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg text-center">
          <p className="text-gray-600 dark:text-gray-300">{t('jobPostingAdmin.applicants.none')}</p>
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
                    applications={applicants} // 전체 지원자 데이터 전달 (카운트 계산용)
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

      {/* 확정 취소 확인 모달 */}
      <ConfirmModal
        isOpen={cancelConfirmModal.isOpen}
        onClose={() => !isProcessing && setCancelConfirmModal({ isOpen: false, applicant: null })}
        onConfirm={performCancelConfirmation}
        title="확정 취소"
        message={`${cancelConfirmModal.applicant?.applicantName || ''}님의 확정을 취소하시겠습니까?\n\n⚠️ 주의사항:\n• 지원자 상태가 '대기중'으로 변경됩니다\n• 관련된 모든 WorkLog가 삭제됩니다\n• 이 작업은 되돌릴 수 없습니다`}
        confirmText="확정 취소"
        cancelText="돌아가기"
        isDangerous={true}
        isLoading={isProcessing}
      />
    </div>
  );
};

export default ApplicantListTab;
