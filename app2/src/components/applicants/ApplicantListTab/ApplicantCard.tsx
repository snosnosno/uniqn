import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Applicant } from './types';
import PreQuestionDisplay from './PreQuestionDisplay';
import { getApplicantSelections, formatDateDisplay } from '@/utils/applicants';
import StaffProfileModal from '../../modals/StaffProfileModal';
import { StaffData } from '@/hooks/useStaffManagement';
import { JobPosting } from '@/types/jobPosting';
import { Selection } from '@/types/applicants/selection';

/** 처리된 지원 정보 (그룹화된 선택 표시용) */
interface ProcessedApplication {
  displayDateRange: string;
  dayCount?: number;
  time: string;
  roles: string[];
  isGrouped: boolean;
  checkMethod: 'group' | 'individual';
}

interface ApplicantCardProps {
  applicant: Applicant;
  jobPosting?: JobPosting;
  children?: React.ReactNode;
}

/**
 * 개별 지원자 정보를 표시하는 카드 컴포넌트 (2x2 그리드 레이아웃)
 */
const ApplicantCard: React.FC<ApplicantCardProps> = React.memo(
  ({ applicant, jobPosting, children }) => {
    const { t } = useTranslation();
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    // 지역 표시 함수 (프로필 페이지와 동일한 로직)
    const getRegionDisplay = (region?: string) => {
      if (!region) return t('common.none');
      return t(`locations.${region}`, region);
    };

    // StaffData 형식으로 변환
    const staffData: StaffData | null = applicant
      ? {
          id: applicant.applicantId || applicant.id,
          userId: applicant.applicantId || applicant.id,
          name: applicant.applicantName,
          phone: applicant.phone || '',
          email: applicant.email || '',
          role: (applicant.assignedRole as any) || '',
          notes: applicant.notes || '',
          postingId: applicant.eventId || '',
          postingTitle: '', // 지원자 탭에서는 posting 정보가 없으므로 빈 문자열
          assignedTime: applicant.assignedTime || '',
          region: applicant.region || '',
        }
      : null;

    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1.5 sm:p-2.5">
        {/* 모바일 최적화된 레이아웃 */}
        <div className="space-y-2">
          {/* 상단: 이름, 프로필 보기 버튼, 상태 */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 text-base">
                {applicant.applicantName}
              </h4>
              <button
                onClick={() => setIsProfileModalOpen(true)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-2 py-1 rounded-md transition-colors"
              >
                (프로필 보기)
              </button>
            </div>
            <span
              className={`px-2 py-1 rounded-full text-xs ${
                applicant.status === 'confirmed'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                  : applicant.status === 'cancelled'
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                    : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
              }`}
            >
              {t(`jobPostingAdmin.applicants.status_${applicant.status}`)}
            </span>
          </div>

          {/* 기본 정보: 2x2 컴팩트 그리드 */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-gray-600 dark:text-gray-300">
            <div>
              <span className="font-medium">{t('common.gender')}:</span>
              <span className="ml-1">
                {applicant.gender
                  ? applicant.gender.toLowerCase() === 'male'
                    ? t('common.male')
                    : applicant.gender.toLowerCase() === 'female'
                      ? t('common.female')
                      : applicant.gender
                  : t('common.none')}
              </span>
            </div>

            <div>
              <span className="font-medium">{t('common.age')}:</span>
              <span className="ml-1">{applicant.age || t('common.none')}</span>
            </div>

            <div>
              <span className="font-medium">{t('profile.region')}:</span>
              <span className="ml-1">{getRegionDisplay(applicant.region)}</span>
            </div>

            <div>
              <span className="font-medium">{t('common.experience')}:</span>
              <span className="ml-1">{applicant.experience || t('common.none')}</span>
            </div>
          </div>

          {/* 연락처 정보: 한 줄로 컴팩트하게 */}
          <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
            <div>
              <span className="font-medium">{t('common.email')}:</span>
              <span className="ml-1 text-xs break-all">{applicant.email || t('common.none')}</span>
            </div>
            <div>
              <span className="font-medium">{t('common.phone')}:</span>
              <span className="ml-1">{applicant.phone || t('common.none')}</span>
            </div>
          </div>

          {/* 사전질문 답변: 컴팩트하게 */}
          <div className="border-l-2 border-gray-200 dark:border-gray-700 pl-2">
            <PreQuestionDisplay applicant={applicant} />
          </div>

          {/* 하단: 선택 시간 표시 및 체크박스 영역 */}
          <div>
            {(() => {
              const applicantSelections = getApplicantSelections(applicant, jobPosting);

              // 확정된 상태일 때 지원 정보와 버튼을 모두 표시
              if (applicant.status === 'confirmed') {
                return (
                  <div className="space-y-2">
                    {/* 지원 정보 표시 (applicantSelections가 있는 경우) */}
                    {applicantSelections.length > 0 &&
                      (() => {
                        // 🎯 선택 사항을 그룹과 개별로 분류
                        const processedApplications = new Map<string, ProcessedApplication>();

                        applicantSelections.forEach((selection: Selection) => {
                          // checkMethod가 'group'이고 dates가 여러 개인 경우 그룹으로 처리
                          if (
                            selection.checkMethod === 'group' &&
                            selection.dates &&
                            selection.dates.length > 1
                          ) {
                            const groupKey = `group-${selection.groupId || selection.time}`;

                            if (!processedApplications.has(groupKey)) {
                              // selection.dates.length > 1 체크를 통과했으므로 첫/마지막 요소는 존재함
                              const firstDate = selection.dates[0]!;
                              const lastDate = selection.dates[selection.dates.length - 1]!;
                              processedApplications.set(groupKey, {
                                displayDateRange: `${formatDateDisplay(firstDate)}~${formatDateDisplay(lastDate)}`,
                                dayCount: selection.dates.length,
                                time: selection.time,
                                roles: [],
                                isGrouped: true,
                                checkMethod: 'group',
                              });
                            }

                            const group = processedApplications.get(groupKey)!;
                            if (selection.role && !group.roles.includes(selection.role)) {
                              group.roles.push(selection.role);
                            }
                          } else {
                            // 개별 선택 처리
                            const dateKey = selection.date || selection.dates?.[0] || 'no-date';
                            const individualKey = `individual-${dateKey}-${selection.time}`;

                            if (!processedApplications.has(individualKey)) {
                              processedApplications.set(individualKey, {
                                displayDateRange: formatDateDisplay(dateKey),
                                time: selection.time,
                                roles: [],
                                isGrouped: false,
                                checkMethod: 'individual',
                              });
                            }

                            const individual = processedApplications.get(individualKey)!;
                            if (selection.role && !individual.roles.includes(selection.role)) {
                              individual.roles.push(selection.role);
                            }
                          }
                        });

                        const allApplications = Array.from(processedApplications.values());

                        return (
                          <div className="mt-2 p-2 rounded-lg border bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700">
                            <div className="space-y-1">
                              {allApplications.map((group, groupIndex) => {
                                return (
                                  <div
                                    key={groupIndex}
                                    className="bg-white dark:bg-gray-700 p-2 rounded border dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200"
                                  >
                                    📅 {group.displayDateRange} ⏰ {group.time} 👤{' '}
                                    {group.roles
                                      .filter((role: string) => role)
                                      .map((role: string) => t(`roles.${role}`) || role)
                                      .join(', ')}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                    {/* 기존 단일 선택 지원자 표시 */}
                    {applicantSelections.length === 0 &&
                      (applicant.assignedDate ||
                        applicant.assignedTime ||
                        applicant.assignedRole) && (
                        <div className="mt-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700">
                          <div className="text-sm bg-white dark:bg-gray-700 p-2 rounded border dark:border-gray-600 font-medium text-gray-700 dark:text-gray-200">
                            📅{' '}
                            {applicant.assignedDate
                              ? formatDateDisplay(applicant.assignedDate)
                              : ''}{' '}
                            ⏰ {applicant.assignedTime} 👤{' '}
                            {applicant.assignedRole
                              ? t(`roles.${applicant.assignedRole}`) || applicant.assignedRole
                              : ''}
                          </div>
                        </div>
                      )}

                    {/* 확정취소 버튼 등 children 표시 */}
                    {children && <div>{children}</div>}
                  </div>
                );
              }

              // 확정되지 않은 상태에서는 체크박스만 표시
              return <div>{children}</div>;
            })()}
          </div>
        </div>

        {/* 스태프 프로필 모달 */}
        <StaffProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          staff={staffData}
        />
      </div>
    );
  },
  (prevProps, nextProps) => {
    // 지원자 기본 정보 비교
    const basicMatch =
      prevProps.applicant.id === nextProps.applicant.id &&
      prevProps.applicant.applicantId === nextProps.applicant.applicantId &&
      prevProps.applicant.applicantName === nextProps.applicant.applicantName &&
      prevProps.applicant.status === nextProps.applicant.status &&
      prevProps.applicant.email === nextProps.applicant.email &&
      prevProps.applicant.phone === nextProps.applicant.phone &&
      prevProps.applicant.gender === nextProps.applicant.gender &&
      prevProps.applicant.age === nextProps.applicant.age &&
      prevProps.applicant.experience === nextProps.applicant.experience &&
      prevProps.applicant.assignedRole === nextProps.applicant.assignedRole &&
      prevProps.applicant.assignedDate === nextProps.applicant.assignedDate &&
      prevProps.applicant.assignedTime === nextProps.applicant.assignedTime &&
      prevProps.children === nextProps.children;

    if (!basicMatch) return false;

    // jobPosting 비교: ID 기반 비교 (JSON.stringify 대신 구조적 비교)
    const prevJobPostingId = prevProps.jobPosting?.id;
    const nextJobPostingId = nextProps.jobPosting?.id;
    if (prevJobPostingId !== nextJobPostingId) return false;

    // preQuestionAnswers 비교: 길이 및 내용 비교 (JSON.stringify 대신 구조적 비교)
    const prevAnswers = prevProps.applicant.preQuestionAnswers;
    const nextAnswers = nextProps.applicant.preQuestionAnswers;

    if (prevAnswers === nextAnswers) return true; // 동일 참조
    if (!prevAnswers && !nextAnswers) return true; // 둘 다 없음
    if (!prevAnswers || !nextAnswers) return false; // 하나만 있음
    if (prevAnswers.length !== nextAnswers.length) return false; // 길이 다름

    // 각 답변 내용 비교
    for (let i = 0; i < prevAnswers.length; i++) {
      const prev = prevAnswers[i];
      const next = nextAnswers[i];
      // undefined 체크 추가
      if (!prev || !next) {
        if (prev !== next) return false;
        continue;
      }
      if (prev.questionId !== next.questionId || prev.answer !== next.answer) {
        return false;
      }
    }

    return true;
  }
);

export default ApplicantCard;
