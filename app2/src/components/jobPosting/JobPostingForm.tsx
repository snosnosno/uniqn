import React, { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useJobPostingForm } from '../../hooks/useJobPostingForm';
import { useDateUtils } from '../../hooks/useDateUtils';
import { useTemplateManager } from '../../hooks/useTemplateManager';
import { LOCATIONS, PREDEFINED_ROLES, getRoleDisplayName } from '../../utils/jobPosting/jobPostingHelpers';
import { JobPosting, JobPostingFormData, DateSpecificRequirement, JobPostingTemplate, PostingType } from '../../types/jobPosting';
import { toast } from '../../utils/toast';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { Select } from '../common/Select';
import DateSpecificRequirementsNew from './DateSpecificRequirementsNew';
import PreQuestionManager from './PreQuestionManager';
import TemplateModal from './modals/TemplateModal';
import LoadTemplateModal from './modals/LoadTemplateModal';
import ConfirmModal from '../modals/ConfirmModal';
import { calculateChipCost, formatChipCost } from '../../utils/jobPosting/chipCalculator';
import { notifyChipDeduction } from '../../utils/jobPosting/chipNotification';

interface JobPostingFormProps {
  onSubmit: (formData: Partial<JobPosting>) => Promise<void>;
  isSubmitting?: boolean;
}

const JobPostingForm: React.FC<JobPostingFormProps> = ({
  onSubmit,
  isSubmitting = false
}) => {
  const { toDropdownValue: _toDropdownValue } = useDateUtils();
  const {
    formData,
    handleFormChange,
    handleDateSpecificTimeSlotChange,
    handleDateSpecificTimeToBeAnnouncedToggle,
    handleDateSpecificTentativeDescriptionChange,
    handleDateSpecificRoleChange,
    handlePreQuestionsToggle,
    handlePreQuestionChange,
    handlePreQuestionOptionChange,
    addPreQuestion,
    removePreQuestion,
    addPreQuestionOption,
    removePreQuestionOption,
    handleStartDateChange: _handleStartDateChange,
    handleEndDateChange: _handleEndDateChange,
    resetForm,
    setFormDataFromTemplate,
    setFormData,
    handleDistrictChange,
    handleSalaryTypeChange,
    handleSalaryAmountChange,
    handleBenefitToggle,
    handleBenefitChange,
    handleRoleSalaryToggle,
    handleAddRoleToSalary,
    handleRemoveRoleFromSalary,
    handleRoleChange,
    handleRoleSalaryTypeChange,
    handleRoleSalaryAmountChange,
    handleCustomRoleNameChange
  } = useJobPostingForm();

  const {
    templates,
    templatesLoading,
    isTemplateModalOpen,
    isLoadTemplateModalOpen,
    templateName,
    templateDescription,
    setTemplateName,
    setTemplateDescription,
    handleSaveTemplate,
    handleLoadTemplate,
    handleDeleteTemplateClick,
    handleDeleteTemplateConfirm: _handleDeleteTemplateConfirm,
    deleteConfirmTemplate: _deleteConfirmTemplate,
    setDeleteConfirmTemplate: _setDeleteConfirmTemplate,
    openTemplateModal,
    closeTemplateModal,
    openLoadTemplateModal,
    closeLoadTemplateModal,
  } = useTemplateManager();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await onSubmit(formData);
      resetForm();
    } catch (error) {
      // 에러는 부모 컴포넌트에서 처리
    }
  };

  const handleSaveTemplateWrapper = async () => {
    await handleSaveTemplate(formData);
  };

  const handleLoadTemplateWrapper = async (template: JobPostingTemplate) => {
    const templateFormData = await handleLoadTemplate(template);
    setFormDataFromTemplate(templateFormData);
    return templateFormData;
  };

  const handleDeleteTemplateWrapper = async (templateId: string, templateName: string) => {
    handleDeleteTemplateClick(templateId, templateName);
    return true; // Return true to indicate the modal should wait for confirmation
  };

  const handleDateSpecificRequirementsChange = (requirements: DateSpecificRequirement[]) => {
    setFormData((prev: JobPostingFormData) => ({ ...prev, dateSpecificRequirements: requirements }));
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">공고 작성</h2>
        <div className="flex space-x-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={openLoadTemplateModal}
          >
            템플릿 불러오기
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={openTemplateModal}
          >
            템플릿 저장
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 기본 정보 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              대회명(매장명) <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <Input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleFormChange}
              placeholder="대회명(매장명)"
              maxLength={25}
              required
              disabled={isSubmitting}
            />
          </div>

          {/* 공고 타입 선택 */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              공고 타입 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* 지원 공고 (무료) */}
              <label className={`
                relative flex items-center justify-center p-4 border-2 rounded-lg cursor-pointer transition-all
                ${formData.postingType === 'regular'
                  ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }
                ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
              `}>
                <input
                  type="radio"
                  name="postingType"
                  value="regular"
                  checked={formData.postingType === 'regular'}
                  onChange={handleFormChange}
                  disabled={isSubmitting}
                  className="sr-only"
                />
                <div className="text-center">
                  <div className="text-2xl mb-1">📋</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">지원</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">무료</div>
                </div>
              </label>

              {/* 고정 공고 (유료) */}
              <label className={`
                relative flex items-center justify-center p-4 border-2 rounded-lg cursor-pointer transition-all
                ${formData.postingType === 'fixed'
                  ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }
                ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
              `}>
                <input
                  type="radio"
                  name="postingType"
                  value="fixed"
                  checked={formData.postingType === 'fixed'}
                  onChange={handleFormChange}
                  disabled={isSubmitting}
                  className="sr-only"
                />
                <div className="text-center">
                  <div className="text-2xl mb-1">📌</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">고정</div>
                  <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">유료</div>
                </div>
              </label>

              {/* 대회 공고 (승인 필요) */}
              <label className={`
                relative flex items-center justify-center p-4 border-2 rounded-lg cursor-pointer transition-all
                ${formData.postingType === 'tournament'
                  ? 'border-purple-500 dark:border-purple-400 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }
                ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
              `}>
                <input
                  type="radio"
                  name="postingType"
                  value="tournament"
                  checked={formData.postingType === 'tournament'}
                  onChange={(e) => {
                    const { fixedConfig, urgentConfig, ...rest } = formData;  // 기존 config 제거
                    setFormData({
                      ...rest,
                      postingType: 'tournament',
                      tournamentConfig: {
                        approvalStatus: 'pending' as const,
                        submittedAt: Timestamp.fromDate(new Date())  // ✅ Date → Timestamp 변환
                      }
                    });
                  }}
                  disabled={isSubmitting}
                  className="sr-only"
                />
                <div className="text-center">
                  <div className="text-2xl mb-1">🏆</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">대회</div>
                  <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">승인 필요</div>
                </div>
              </label>

              {/* 긴급 공고 (유료) */}
              <label className={`
                relative flex items-center justify-center p-4 border-2 rounded-lg cursor-pointer transition-all
                ${formData.postingType === 'urgent'
                  ? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }
                ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
              `}>
                <input
                  type="radio"
                  name="postingType"
                  value="urgent"
                  checked={formData.postingType === 'urgent'}
                  onChange={(e) => {
                    const { fixedConfig, tournamentConfig, ...rest } = formData;  // 기존 config 제거
                    setFormData({
                      ...rest,
                      postingType: 'urgent',
                      urgentConfig: {
                        chipCost: 5,  // ✅ UrgentConfig.chipCost는 리터럴 5만 허용
                        priority: 'high' as const,
                        createdAt: Timestamp.fromDate(new Date())  // ✅ Date → Timestamp 변환
                      }
                    });
                  }}
                  disabled={isSubmitting}
                  className="sr-only"
                />
                <div className="text-center">
                  <div className="text-2xl mb-1">🚨</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">긴급</div>
                  <div className="text-xs text-red-600 dark:text-red-400 mt-1">5칩</div>
                </div>
              </label>
            </div>

            {/* 알림 메시지 */}
            {formData.postingType === 'tournament' && (
              <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg">
                <div className="flex items-start">
                  <span className="text-purple-600 dark:text-purple-400 text-sm">
                    ℹ️
                  </span>
                  <div className="ml-2 text-sm text-purple-800 dark:text-purple-300">
                    <span>대회 공고는 관리자 승인 후 게시됩니다. 승인 결과는 알림으로 안내드립니다.</span>
                  </div>
                </div>
              </div>
            )}

            {/* 칩 비용 알림 */}
            {(formData.postingType === 'fixed' || formData.postingType === 'urgent') && (
              <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                <div className="flex items-start">
                  <span className="text-yellow-600 dark:text-yellow-400 text-sm">
                    💰
                  </span>
                  <div className="ml-2 text-sm text-yellow-800 dark:text-yellow-300">
                    {formData.postingType === 'fixed' && (
                      <span>고정 공고는 기간에 따라 3~10칩이 차감됩니다.</span>
                    )}
                    {formData.postingType === 'urgent' && (
                      <span>긴급 공고 생성 시 5칩이 차감됩니다.</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 고정 공고 기간 선택 */}
          {formData.postingType === 'fixed' && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                노출 기간 <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 7일 (3칩) */}
                <label className={`
                  relative flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-all
                  ${formData.fixedConfig?.durationDays === 7
                    ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                  }
                  ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
                `}>
                  <input
                    type="radio"
                    name="fixedDuration"
                    value="7"
                    checked={formData.fixedConfig?.durationDays === 7}
                    onChange={(e) => {
                      const durationDays = 7;
                      const now = new Date();
                      const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
                      setFormData({
                        ...formData,
                        fixedConfig: {
                          durationDays,
                          chipCost: 3,  // ✅ 7일 = 3칩 (리터럴 타입)
                          expiresAt: Timestamp.fromDate(expiresAt),  // ✅ Date → Timestamp 변환
                          createdAt: Timestamp.fromDate(now)  // ✅ Date → Timestamp 변환
                        }
                      });
                    }}
                    disabled={isSubmitting}
                    className="sr-only"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">7일</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">1주일 노출</div>
                  </div>
                  <div className="ml-3 text-right">
                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">3칩</div>
                  </div>
                </label>

                {/* 30일 (5칩) */}
                <label className={`
                  relative flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-all
                  ${formData.fixedConfig?.durationDays === 30
                    ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                  }
                  ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
                `}>
                  <input
                    type="radio"
                    name="fixedDuration"
                    value="30"
                    checked={formData.fixedConfig?.durationDays === 30}
                    onChange={(e) => {
                      const durationDays = 30;
                      const now = new Date();
                      const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
                      setFormData({
                        ...formData,
                        fixedConfig: {
                          durationDays,
                          chipCost: 5,  // ✅ 30일 = 5칩 (리터럴 타입)
                          expiresAt: Timestamp.fromDate(expiresAt),  // ✅ Date → Timestamp 변환
                          createdAt: Timestamp.fromDate(now)  // ✅ Date → Timestamp 변환
                        }
                      });
                    }}
                    disabled={isSubmitting}
                    className="sr-only"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">30일</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">1개월 노출</div>
                  </div>
                  <div className="ml-3 text-right">
                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">5칩</div>
                    <div className="text-xs text-green-600 dark:text-green-400">인기</div>
                  </div>
                </label>

                {/* 90일 (10칩) */}
                <label className={`
                  relative flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-all
                  ${formData.fixedConfig?.durationDays === 90
                    ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                  }
                  ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
                `}>
                  <input
                    type="radio"
                    name="fixedDuration"
                    value="90"
                    checked={formData.fixedConfig?.durationDays === 90}
                    onChange={(e) => {
                      const durationDays = 90;
                      const now = new Date();
                      const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
                      setFormData({
                        ...formData,
                        fixedConfig: {
                          durationDays,
                          chipCost: 10,  // ✅ 90일 = 10칩 (리터럴 타입)
                          expiresAt: Timestamp.fromDate(expiresAt),  // ✅ Date → Timestamp 변환
                          createdAt: Timestamp.fromDate(now)  // ✅ Date → Timestamp 변환
                        }
                      });
                    }}
                    disabled={isSubmitting}
                    className="sr-only"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">90일</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">3개월 노출</div>
                  </div>
                  <div className="ml-3 text-right">
                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">10칩</div>
                    <div className="text-xs text-purple-600 dark:text-purple-400">최장</div>
                  </div>
                </label>
              </div>

              {/* 선택된 기간 정보 */}
              {formData.fixedConfig && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-blue-800 dark:text-blue-300">
                      📅 선택한 기간: <strong>{formData.fixedConfig.durationDays}일</strong>
                    </span>
                    <span className="text-blue-800 dark:text-blue-300 font-medium">
                      차감 예정: <strong>{formatChipCost(formData.fixedConfig.chipCost)}</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                지역 <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <Select
                name="location"
                value={formData.location}
                onChange={(value) => handleFormChange({ target: { name: 'location', value } } as any)}
                options={LOCATIONS.map(location => ({ value: location, label: location }))}
                required
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                시/군/구
              </label>
              <Input
                type="text"
                name="district"
                value={formData.district || ''}
                onChange={(e) => handleDistrictChange(e.target.value)}
                placeholder="시/군/구를 입력하세요"
                maxLength={25}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              상세 주소
            </label>
            <Input
              type="text"
              name="detailedAddress"
              value={formData.detailedAddress}
              onChange={handleFormChange}
              placeholder="상세 주소를 입력하세요"
              maxLength={25}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              문의 연락처 <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              name="contactPhone"
              value={formData.contactPhone || ''}
              onChange={handleFormChange}
              placeholder="010-0000-0000"
              maxLength={25}
              required
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* 급여 정보 */}
        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="useRoleSalary"
              checked={formData.useRoleSalary || false}
              onChange={(e) => handleRoleSalaryToggle(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
              disabled={isSubmitting}
            />
            <label htmlFor="useRoleSalary" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              역할별 급여 설정
            </label>
          </div>

          {formData.useRoleSalary ? (
            <div className="space-y-3 border rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                각 역할별로 급여를 설정하세요. 기본값: 시급 20,000원
              </div>
              
              {/* 역할별 급여 목록 */}
              {Object.entries(formData.roleSalaries || {}).map(([role, salary]: [string, any]) => (
                <div key={role} className="grid grid-cols-12 gap-2 items-center">
                  {/* 역할 선택 - 기타일 때만 특별 처리 */}
                  {role === 'other' ? (
                    <>
                      <div className="col-span-2">
                        <Select
                          value={role}
                          onChange={(value) => handleRoleChange(role, value)}
                          options={PREDEFINED_ROLES.map(r => ({
                            value: r,
                            label: getRoleDisplayName(r)
                          }))}
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="col-span-3">
                        <Input
                          type="text"
                          value={salary.customRoleName || ''}
                          onChange={(e) => handleCustomRoleNameChange(role, e.target.value)}
                          placeholder="역할명을 입력하세요"
                          disabled={isSubmitting}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="col-span-4">
                      <Select
                        value={role}
                        onChange={(value) => handleRoleChange(role, value)}
                        options={PREDEFINED_ROLES.map(r => ({
                            value: r,
                            label: getRoleDisplayName(r)
                        }))}
                        disabled={isSubmitting}
                      />
                    </div>
                  )}

                  {/* 급여 유형 */}
                  <div className={role === 'other' ? "col-span-2" : "col-span-3"}>
                    <Select
                      value={salary.salaryType}
                      onChange={(value) => handleRoleSalaryTypeChange(role, value as 'hourly' | 'daily' | 'monthly' | 'negotiable' | 'other')}
                      options={[
                        { value: 'hourly', label: '시급' },
                        { value: 'daily', label: '일급' },
                        { value: 'monthly', label: '월급' },
                        { value: 'negotiable', label: '협의' },
                        { value: 'other', label: '기타' }
                      ]}
                      disabled={isSubmitting}
                    />
                  </div>

                  {/* 급여 금액 */}
                  <div className="col-span-3">
                    {salary.salaryType === 'negotiable' ? (
                      <div className="text-gray-500 dark:text-gray-400 text-sm py-2">급여 협의</div>
                    ) : (
                      <Input
                        type="text"
                        value={salary.salaryAmount}
                        onChange={(e) => handleRoleSalaryAmountChange(role, e.target.value)}
                        placeholder="급여 금액"
                        disabled={isSubmitting || salary.salaryType === 'negotiable'}
                      />
                    )}
                  </div>

                  {/* 삭제 버튼 */}
                  <div className="col-span-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveRoleFromSalary(role)}
                      disabled={isSubmitting}
                    >
                      삭제
                    </Button>
                  </div>
                </div>
              ))}

              {/* 역할 추가 버튼 */}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddRoleToSalary}
                disabled={isSubmitting}
              >
                + 역할 추가
              </Button>
            </div>
          ) : (
            // 기존 통합 급여 입력
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  급여 유형 <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <Select
                  name="salaryType"
                  value={formData.salaryType || ''}
                  onChange={(value) => handleSalaryTypeChange(value as 'hourly' | 'daily' | 'monthly' | 'negotiable' | 'other')}
                  options={[
                    { value: '', label: '선택하세요' },
                    { value: 'hourly', label: '시급' },
                    { value: 'daily', label: '일급' },
                    { value: 'monthly', label: '월급' },
                    { value: 'negotiable', label: '협의' },
                    { value: 'other', label: '기타' }
                  ]}
                  required={!formData.useRoleSalary}
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  급여 금액 <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                {formData.salaryType === 'negotiable' ? (
                  <div className="text-gray-500 dark:text-gray-400 text-sm py-2">급여 협의</div>
                ) : (
                  <Input
                    type="text"
                    name="salaryAmount"
                    value={formData.salaryAmount || ''}
                    onChange={(e) => handleSalaryAmountChange(e.target.value)}
                    placeholder="급여 금액을 입력하세요"
                    required={!formData.useRoleSalary && (formData.salaryType as 'hourly' | 'daily' | 'monthly' | 'negotiable' | 'other' | undefined) !== 'negotiable'}
                    disabled={isSubmitting || (formData.salaryType as 'hourly' | 'daily' | 'monthly' | 'negotiable' | 'other' | undefined) === 'negotiable'}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* 복리후생 */}
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">복리후생 (제공되는 정보만 입력)</label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 보장시간 */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="benefit-guaranteedHours"
                checked={!!formData.benefits?.guaranteedHours}
                onChange={(e) => handleBenefitToggle('guaranteedHours', e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                disabled={isSubmitting}
              />
              <label htmlFor="benefit-guaranteedHours" className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                보장시간
              </label>
              {formData.benefits?.guaranteedHours !== undefined && (
                <Input
                  type="text"
                  value={formData.benefits.guaranteedHours}
                  onChange={(e) => handleBenefitChange('guaranteedHours', e.target.value)}
                  placeholder="예시: 6시간"
                  maxLength={25}
                  className="flex-1"
                  disabled={isSubmitting}
                />
              )}
            </div>

            {/* 복장 */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="benefit-clothing"
                checked={!!formData.benefits?.clothing}
                onChange={(e) => handleBenefitToggle('clothing', e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                disabled={isSubmitting}
              />
              <label htmlFor="benefit-clothing" className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                복장
              </label>
              {formData.benefits?.clothing !== undefined && (
                <Input
                  type="text"
                  value={formData.benefits.clothing}
                  onChange={(e) => handleBenefitChange('clothing', e.target.value)}
                  placeholder="예시: 검은셔츠,슬랙스,운동화"
                  maxLength={25}
                  className="flex-1"
                  disabled={isSubmitting}
                />
              )}
            </div>

            {/* 식사 */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="benefit-meal"
                checked={!!formData.benefits?.meal}
                onChange={(e) => handleBenefitToggle('meal', e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                disabled={isSubmitting}
              />
              <label htmlFor="benefit-meal" className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                식사
              </label>
              {formData.benefits?.meal !== undefined && (
                <Input
                  type="text"
                  value={formData.benefits.meal}
                  onChange={(e) => handleBenefitChange('meal', e.target.value)}
                  placeholder="식사 정보 입력"
                  maxLength={25}
                  className="flex-1"
                  disabled={isSubmitting}
                />
              )}
            </div>

            {/* 교통비 */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="benefit-transportation"
                checked={!!formData.benefits?.transportation}
                onChange={(e) => handleBenefitToggle('transportation', e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                disabled={isSubmitting}
              />
              <label htmlFor="benefit-transportation" className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                교통비 (일당)
              </label>
              {formData.benefits?.transportation !== undefined && (
                <>
                  <Input
                    type="text"
                    value={formData.benefits.transportation}
                    onChange={(e) => handleBenefitChange('transportation', e.target.value)}
                    placeholder="일당 5,000원"
                    maxLength={25}
                    className="flex-1"
                    disabled={isSubmitting}
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">원/일</span>
                </>
              )}
            </div>

            {/* 식비 */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="benefit-mealAllowance"
                checked={!!formData.benefits?.mealAllowance}
                onChange={(e) => handleBenefitToggle('mealAllowance', e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                disabled={isSubmitting}
              />
              <label htmlFor="benefit-mealAllowance" className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                식비 (일당)
              </label>
              {formData.benefits?.mealAllowance !== undefined && (
                <>
                  <Input
                    type="text"
                    value={formData.benefits.mealAllowance}
                    onChange={(e) => handleBenefitChange('mealAllowance', e.target.value)}
                    placeholder="일당 10,000원"
                    maxLength={25}
                    className="flex-1"
                    disabled={isSubmitting}
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">원/일</span>
                </>
              )}
            </div>

            {/* 숙소 */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="benefit-accommodation"
                checked={!!formData.benefits?.accommodation}
                onChange={(e) => handleBenefitToggle('accommodation', e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                disabled={isSubmitting}
              />
              <label htmlFor="benefit-accommodation" className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                숙소 (일당)
              </label>
              {formData.benefits?.accommodation !== undefined && (
                <>
                  <Input
                    type="text"
                    value={formData.benefits.accommodation}
                    onChange={(e) => handleBenefitChange('accommodation', e.target.value)}
                    placeholder="일당 15,000원"
                    maxLength={25}
                    className="flex-1"
                    disabled={isSubmitting}
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">원/일</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 날짜별 인원 요구사항 설정 */}
        <DateSpecificRequirementsNew
          requirements={formData.dateSpecificRequirements || []}
          onRequirementsChange={handleDateSpecificRequirementsChange}
          onDateSpecificTimeSlotChange={handleDateSpecificTimeSlotChange}
          onDateSpecificTimeToBeAnnouncedToggle={handleDateSpecificTimeToBeAnnouncedToggle}
          onDateSpecificTentativeDescriptionChange={handleDateSpecificTentativeDescriptionChange}
          onDateSpecificRoleChange={handleDateSpecificRoleChange}
        />

        {/* 사전질문 설정 */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="usesPreQuestions"
              checked={'usesPreQuestions' in formData ? formData.usesPreQuestions : false}
              onChange={(e) => handlePreQuestionsToggle(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
              disabled={isSubmitting}
            />
            <label htmlFor="usesPreQuestions" className="text-sm text-gray-700 dark:text-gray-300">
              사전질문 사용(추가 질문)
            </label>
          </div>

          {'usesPreQuestions' in formData && formData.usesPreQuestions && (
            <PreQuestionManager
              preQuestions={formData.preQuestions || []}
              onPreQuestionChange={handlePreQuestionChange}
              onPreQuestionOptionChange={handlePreQuestionOptionChange}
              onAddPreQuestion={addPreQuestion}
              onRemovePreQuestion={removePreQuestion}
              onAddPreQuestionOption={addPreQuestionOption}
              onRemovePreQuestionOption={removePreQuestionOption}
            />
          )}
        </div>

        {/* 상세 설명 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            상세 설명
          </label>
          <textarea
            name="description"
            rows={4}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm placeholder:text-xs"
            value={formData.description}
            onChange={handleFormChange}
            placeholder="추가 설명을 입력하세요&#10;예시 : 경력 1년이상,TDA숙지자 등등"
            disabled={isSubmitting}
          />
        </div>

        {/* 제출 버튼 */}
        <div className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="secondary"
            onClick={resetForm}
            disabled={isSubmitting}
          >
            초기화
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={openTemplateModal}
            disabled={isSubmitting}
          >
            템플릿 저장
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
          >
            {isSubmitting ? '등록 중...' : '공고 등록'}
          </Button>
        </div>
      </form>

      {/* 템플릿 저장 모달 */}
      <TemplateModal
        isOpen={isTemplateModalOpen}
        onClose={closeTemplateModal}
        templateName={templateName}
        templateDescription={templateDescription}
        onTemplateNameChange={setTemplateName}
        onTemplateDescriptionChange={setTemplateDescription}
        onSave={handleSaveTemplateWrapper}
      />

      {/* 템플릿 불러오기 모달 */}
      <LoadTemplateModal
        isOpen={isLoadTemplateModalOpen}
        onClose={closeLoadTemplateModal}
        templates={templates}
        templatesLoading={templatesLoading}
        onLoadTemplate={handleLoadTemplateWrapper}
        onDeleteTemplate={handleDeleteTemplateWrapper}
      />

      {/* 템플릿 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={!!_deleteConfirmTemplate}
        onClose={() => _setDeleteConfirmTemplate(null)}
        onConfirm={async () => {
          const success = await _handleDeleteTemplateConfirm();
          if (success) {
            toast.success(`"${_deleteConfirmTemplate?.name}" 템플릿이 삭제되었습니다.`);
          }
        }}
        title="템플릿 삭제"
        message={`"${_deleteConfirmTemplate?.name}" 템플릿을 삭제하시겠습니까?\n\n⚠️ 주의: 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        cancelText="취소"
        isDangerous={true}
      />
    </div>
  );
};

export default JobPostingForm;