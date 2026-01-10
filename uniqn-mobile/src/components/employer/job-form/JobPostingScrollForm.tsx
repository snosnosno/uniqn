/**
 * UNIQN Mobile - 공고 작성 스크롤 폼
 *
 * @description 한 페이지로 구성된 공고 작성 폼 (웹앱과 동일한 UX)
 * @version 1.0.0
 */

import React, { useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Button } from '@/components';
import {
  SectionCard,
  BasicInfoSection,
  ScheduleSection,
  DateRequirementsSection,
  RolesSection,
  SalarySection,
  PreQuestionsSection,
} from './sections';
import type { JobPostingFormData } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface JobPostingScrollFormProps {
  data: JobPostingFormData;
  onUpdate: (data: Partial<JobPostingFormData>) => void;
  onSubmit: () => void;
  onSaveDraft?: () => void;
  isSubmitting?: boolean;
  isSavingDraft?: boolean;
}

interface SectionErrors {
  basicInfo: Record<string, string>;
  schedule: Record<string, string>;
  roles: Record<string, string>;
  salary: Record<string, string>;
  preQuestions: Record<string, string>;
}

// ============================================================================
// Validation Functions
// ============================================================================

function validateBasicInfo(data: JobPostingFormData): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!data.postingType) {
    errors.postingType = '공고 타입을 선택해주세요';
  }
  if (!data.title?.trim()) {
    errors.title = '제목을 입력해주세요';
  } else if (data.title.length < 5) {
    errors.title = '제목은 최소 5자 이상 입력해주세요';
  }
  if (!data.location) {
    errors.location = '근무지를 선택해주세요';
  }

  return errors;
}

function validateSchedule(data: JobPostingFormData): Record<string, string> {
  const errors: Record<string, string> = {};

  switch (data.postingType) {
    case 'regular':
    case 'urgent':
      if (!data.workDate) {
        errors.workDate = '근무 날짜를 선택해주세요';
      }
      if (!data.startTime) {
        errors.startTime = '출근 시간을 선택해주세요';
      }
      break;
    case 'fixed':
      if (!data.daysPerWeek || data.daysPerWeek < 1 || data.daysPerWeek > 7) {
        errors.daysPerWeek = '주 출근일수를 선택해주세요 (1-7일)';
      }
      if (!data.startTime) {
        errors.startTime = '출근 시간을 선택해주세요';
      }
      break;
    case 'tournament':
      if (!data.tournamentDates || data.tournamentDates.length === 0) {
        errors.tournamentDates = '최소 1일 이상의 대회 일정을 추가해주세요';
      } else {
        const hasIncomplete = data.tournamentDates.some(d => !d.date || !d.startTime);
        if (hasIncomplete) {
          errors.tournamentDates = '모든 대회 일정의 날짜와 시간을 입력해주세요';
        }
      }
      break;
  }

  return errors;
}

function validateRoles(data: JobPostingFormData): Record<string, string> {
  const errors: Record<string, string> = {};

  // fixed 타입만 RolesSection 사용 (다른 타입은 TimeSlot 내 역할 관리)
  if (data.postingType === 'fixed') {
    if (!data.roles || data.roles.length === 0) {
      errors.roles = '최소 1개 이상의 역할을 추가해주세요';
    } else {
      const totalCount = data.roles.reduce((sum, r) => sum + r.count, 0);
      if (totalCount === 0) {
        errors.roles = '모집 인원은 최소 1명 이상이어야 합니다';
      }
      const hasEmptyName = data.roles.some(r => r.isCustom && !r.name.trim());
      if (hasEmptyName) {
        errors.roles = '모든 역할의 이름을 입력해주세요';
      }
    }
  }

  return errors;
}

function validateSalary(data: JobPostingFormData): Record<string, string> {
  const errors: Record<string, string> = {};

  if (data.salary.type !== 'other' && data.salary.amount <= 0) {
    errors.amount = '급여 금액을 입력해주세요';
  }

  if (data.useRoleSalary && data.salary.type !== 'other') {
    const hasZeroSalary = data.roles.some((role) => {
      const roleSalary = data.roleSalaries[role.name];
      return !roleSalary || roleSalary.amount <= 0;
    });
    if (hasZeroSalary) {
      errors.roleSalary = '모든 역할의 급여를 입력해주세요';
    }
  }

  return errors;
}

function validatePreQuestions(data: JobPostingFormData): Record<string, string> {
  const errors: Record<string, string> = {};

  if (data.usesPreQuestions) {
    const hasEmptyQuestion = data.preQuestions.some(q => !q.question.trim());
    if (hasEmptyQuestion) {
      errors.preQuestions = '질문 내용을 입력해주세요';
    }

    const hasEmptyOption = data.preQuestions.some(q =>
      q.type === 'select' && q.options?.some(opt => !opt.trim())
    );
    if (hasEmptyOption) {
      errors.preQuestions = '선택지 내용을 입력해주세요';
    }
  }

  return errors;
}

// ============================================================================
// Component
// ============================================================================

export function JobPostingScrollForm({
  data,
  onUpdate,
  onSubmit,
  onSaveDraft,
  isSubmitting = false,
  isSavingDraft = false,
}: JobPostingScrollFormProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const [errors, setErrors] = useState<SectionErrors>({
    basicInfo: {},
    schedule: {},
    roles: {},
    salary: {},
    preQuestions: {},
  });

  // 섹션 위치 저장 (스크롤용)
  const sectionPositions = useRef<Record<string, number>>({});

  // 전체 유효성 검증
  const validateAll = useCallback((): boolean => {
    const newErrors: SectionErrors = {
      basicInfo: validateBasicInfo(data),
      schedule: validateSchedule(data),
      roles: validateRoles(data),
      salary: validateSalary(data),
      preQuestions: validatePreQuestions(data),
    };

    setErrors(newErrors);

    // 에러가 있는 첫 번째 섹션으로 스크롤
    const sections = ['basicInfo', 'schedule', 'roles', 'salary', 'preQuestions'] as const;
    for (const section of sections) {
      if (Object.keys(newErrors[section]).length > 0) {
        const position = sectionPositions.current[section];
        if (position !== undefined && scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ y: position - 20, animated: true });
        }
        return false;
      }
    }

    return true;
  }, [data]);

  // 제출 핸들러
  const handleSubmit = useCallback(() => {
    if (validateAll()) {
      onSubmit();
    }
  }, [validateAll, onSubmit]);

  // 섹션 위치 기록
  const handleSectionLayout = useCallback((section: string, y: number) => {
    sectionPositions.current[section] = y;
  }, []);

  // 에러 개수 계산
  const getErrorCount = useCallback((sectionErrors: Record<string, string>): number => {
    return Object.keys(sectionErrors).length;
  }, []);

  // 대회 공고 여부 확인
  const isTournament = data.postingType === 'tournament';

  return (
    <View className="flex-1">
      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 기본 정보 섹션 */}
        <View
          onLayout={(e) => handleSectionLayout('basicInfo', e.nativeEvent.layout.y)}
        >
          <SectionCard
            title="기본 정보"
            required
            hasError={getErrorCount(errors.basicInfo) > 0}
            errorCount={getErrorCount(errors.basicInfo)}
          >
            <BasicInfoSection
              data={data}
              onUpdate={onUpdate}
              errors={errors.basicInfo}
            />
          </SectionCard>
        </View>

        {/* 일정 섹션 */}
        <View
          onLayout={(e) => handleSectionLayout('schedule', e.nativeEvent.layout.y)}
        >
          <SectionCard
            title="일정"
            required
            hasError={getErrorCount(errors.schedule) > 0}
            errorCount={getErrorCount(errors.schedule)}
          >
            {data.postingType === 'fixed' ? (
              <ScheduleSection
                data={data}
                onUpdate={onUpdate}
                errors={errors.schedule}
              />
            ) : (
              <DateRequirementsSection
                data={data}
                onUpdate={onUpdate}
                errors={errors.schedule}
              />
            )}
          </SectionCard>
        </View>

        {/* 역할/인원 섹션 (fixed 타입만 표시) */}
        {/* regular/urgent/tournament는 DateRequirementsSection의 TimeSlot에서 역할 관리 */}
        {data.postingType === 'fixed' && (
          <View
            onLayout={(e) => handleSectionLayout('roles', e.nativeEvent.layout.y)}
          >
            <SectionCard
              title="역할/인원"
              required
              hasError={getErrorCount(errors.roles) > 0}
              errorCount={getErrorCount(errors.roles)}
            >
              <RolesSection
                data={data}
                onUpdate={onUpdate}
                errors={errors.roles}
              />
            </SectionCard>
          </View>
        )}

        {/* 급여 섹션 */}
        <View
          onLayout={(e) => handleSectionLayout('salary', e.nativeEvent.layout.y)}
        >
          <SectionCard
            title="급여"
            required
            hasError={getErrorCount(errors.salary) > 0}
            errorCount={getErrorCount(errors.salary)}
          >
            <SalarySection
              data={data}
              onUpdate={onUpdate}
              errors={errors.salary}
            />
          </SectionCard>
        </View>

        {/* 사전질문 섹션 */}
        <View
          onLayout={(e) => handleSectionLayout('preQuestions', e.nativeEvent.layout.y)}
        >
          <SectionCard
            title="사전질문"
            optional
            hasError={getErrorCount(errors.preQuestions) > 0}
            errorCount={getErrorCount(errors.preQuestions)}
          >
            <PreQuestionsSection
              data={data}
              onUpdate={onUpdate}
              errors={errors.preQuestions}
            />
          </SectionCard>
        </View>

        {/* 대회 공고 안내 */}
        {isTournament && (
          <View className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-700 mb-4">
            <Text className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
              대회 공고 안내
            </Text>
            <Text className="text-xs text-amber-700 dark:text-amber-300">
              대회 공고는 관리자 승인 후 게시됩니다.{'\n'}
              승인까지 1-2 영업일이 소요될 수 있습니다.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* 하단 버튼 영역 (고정) */}
      <View className="absolute bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <View className="flex-row gap-3">
          {onSaveDraft && (
            <View className="flex-1">
              <Button
                variant="outline"
                size="lg"
                onPress={onSaveDraft}
                disabled={isSavingDraft}
                fullWidth
              >
                <Text className="text-gray-700 dark:text-gray-300">
                  {isSavingDraft ? '저장 중...' : '임시저장'}
                </Text>
              </Button>
            </View>
          )}
          <View className={onSaveDraft ? 'flex-1' : 'flex-1'}>
            <Button
              variant="primary"
              size="lg"
              onPress={handleSubmit}
              disabled={isSubmitting}
              fullWidth
            >
              <Text className="text-white font-semibold">
                {isSubmitting ? '등록 중...' : isTournament ? '승인 요청' : '공고 등록'}
              </Text>
            </Button>
          </View>
        </View>
      </View>
    </View>
  );
}

export default JobPostingScrollForm;
