/**
 * UNIQN Mobile - 공고 수정 화면 (스크롤 폼)
 *
 * @description 구인자가 기존 공고를 수정하는 한 페이지 스크롤 폼
 * @version 2.0.0 - 스크롤 폼으로 변경 (웹앱과 동일한 UX)
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Loading } from '@/components';
import {
  SectionCard,
  BasicInfoSection,
  ScheduleSection,
  DateRequirementsSection,
  RolesSection,
  SalarySection,
  PreQuestionsSection,
} from '@/components/employer/job-form';
import { useAuth } from '@/hooks/useAuth';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { STAFF_ROLES } from '@/constants';
import { useJobDetail } from '@/hooks/useJobDetail';
import { useUpdateJobPosting } from '@/hooks/useJobManagement';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import type { UpdateJobPostingInput, JobPostingFormData, FormRoleWithCount } from '@/types';
import { INITIAL_JOB_POSTING_FORM_DATA } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface SectionErrors {
  basicInfo: Record<string, string>;
  schedule: Record<string, string>;
  roles: Record<string, string>;
  salary: Record<string, string>;
  preQuestions: Record<string, string>;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * RoleRequirement[] → FormRoleWithCount[] 변환 (급여 포함)
 */
function convertRolesToFormRolesWithSalary(
  roles: {
    role?: string;
    name?: string;
    count: number;
    filled?: number;
    salary?: { type: string; amount: number };
  }[]
): FormRoleWithCount[] {
  const ROLE_LABELS: Record<string, string> = {
    dealer: '딜러',
    floor: '플로어',
    manager: '매니저',
    chiprunner: '칩러너',
    admin: '관리자',
  };

  return roles.map((r) => ({
    name: r.name || ROLE_LABELS[r.role || ''] || r.role || '알 수 없음',
    count: r.count,
    isCustom: !!(r.name && !['딜러', '플로어'].includes(r.name)),
    salary: r.salary
      ? { type: r.salary.type as 'hourly' | 'daily' | 'monthly' | 'other', amount: r.salary.amount }
      : undefined,
  }));
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
  } else if (data.title.trim().length < 2) {
    errors.title = '제목은 최소 2자 이상 입력해주세요';
  }
  if (!data.location) {
    errors.location = '근무지를 선택해주세요';
  }

  return errors;
}

function validateSchedule(data: JobPostingFormData): Record<string, string> {
  const errors: Record<string, string> = {};

  // v2.0: dateSpecificRequirements 기반 검증
  const hasDateRequirements =
    data.dateSpecificRequirements && data.dateSpecificRequirements.length > 0;

  switch (data.postingType) {
    case 'regular':
    case 'urgent':
    case 'tournament':
      // v2.0: dateSpecificRequirements 기반 검증
      if (hasDateRequirements) {
        // 모든 날짜의 타임슬롯에 역할이 있는지 확인
        const hasIncomplete = data.dateSpecificRequirements!.some((req) => {
          return (
            !req.timeSlots ||
            req.timeSlots.length === 0 ||
            req.timeSlots.some((slot) => !slot.roles || slot.roles.length === 0)
          );
        });
        if (hasIncomplete) {
          errors.dateSpecificRequirements = '모든 날짜의 역할과 인원을 입력해주세요';
        }
      } else {
        // 하위호환성: 이전 필드 검증
        if (!data.workDate) {
          errors.workDate = '근무 날짜를 선택해주세요';
        }
        if (!data.startTime) {
          errors.startTime = '출근 시간을 선택해주세요';
        }
      }
      break;
    case 'fixed':
      // daysPerWeek: 0 = 협의, 1-7 = 일수 (모두 유효)
      if (data.daysPerWeek === undefined || data.daysPerWeek < 0 || data.daysPerWeek > 7) {
        errors.daysPerWeek = '주 출근일수를 선택해주세요';
      }
      // 출근 시간: 협의가 아닌 경우에만 필수
      if (!data.isStartTimeNegotiable && !data.startTime) {
        errors.startTime = '출근 시간을 선택해주세요';
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
      const hasEmptyName = data.roles.some((r) => r.isCustom && !r.name.trim());
      if (hasEmptyName) {
        errors.roles = '모든 역할의 이름을 입력해주세요';
      }
    }
  }

  return errors;
}

function validateSalary(data: JobPostingFormData): Record<string, string> {
  const errors: Record<string, string> = {};

  // v2.0: roles[].salary 기반 검증
  // 역할별 급여 검증 (한글 displayName으로 에러 표시)
  const rolesWithoutSalary: string[] = [];

  data.roles.forEach((role) => {
    const staffRole = STAFF_ROLES.find((sr) => sr.name === role.name || sr.key === role.name);
    const displayName = staffRole?.name || role.name;
    const roleSalary = role.salary;

    // 협의(other)가 아닌 경우 금액 필수
    if (roleSalary?.type !== 'other' && (!roleSalary || roleSalary.amount <= 0)) {
      rolesWithoutSalary.push(displayName);
    }
  });

  if (rolesWithoutSalary.length > 0) {
    errors.roleSalary = `${rolesWithoutSalary.join(', ')}의 급여를 입력해주세요`;
  }

  return errors;
}

function validatePreQuestions(data: JobPostingFormData): Record<string, string> {
  const errors: Record<string, string> = {};

  if (data.usesPreQuestions) {
    const hasEmptyQuestion = data.preQuestions.some((q) => !q.question.trim());
    if (hasEmptyQuestion) {
      errors.preQuestions = '질문 내용을 입력해주세요';
    }

    const hasEmptyOption = data.preQuestions.some(
      (q) => q.type === 'select' && q.options?.some((opt) => !opt.trim())
    );
    if (hasEmptyOption) {
      errors.preQuestions = '선택지 내용을 입력해주세요';
    }
  }

  return errors;
}

// ============================================================================
// Main Component
// ============================================================================

export default function EditJobPostingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { addToast } = useToastStore();

  // 기존 공고 데이터 불러오기
  const { job: existingJob, isLoading: isJobLoading, error: jobError } = useJobDetail(id || '');

  // Form State
  const scrollViewRef = useRef<ScrollView>(null);
  const [formData, setFormData] = useState<JobPostingFormData | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [hasConfirmedApplicants, setHasConfirmedApplicants] = useState(false);

  // 미저장 변경사항 가드
  useUnsavedChangesGuard(isDirty);
  const [errors, setErrors] = useState<SectionErrors>({
    basicInfo: {},
    schedule: {},
    roles: {},
    salary: {},
    preQuestions: {},
  });

  // 섹션 위치 저장 (스크롤용)
  const sectionPositions = useRef<Record<string, number>>({});

  // Mutations
  const updateJobPosting = useUpdateJobPosting();

  // 기존 데이터로 폼 초기화
  useEffect(() => {
    if (existingJob && !formData) {
      // 기존 타임슬롯에서 출근 시간 추출 ("18:00 - 02:00" → "18:00")
      const extractStartTime = (timeSlot: string | undefined): string => {
        if (!timeSlot) return '';
        const match = timeSlot.match(/^(\d{2}:\d{2})/);
        return match ? match[1] : '';
      };

      setFormData({
        ...INITIAL_JOB_POSTING_FORM_DATA,
        // 기본 정보
        postingType: existingJob.postingType || (existingJob.isUrgent ? 'urgent' : 'regular'),
        title: existingJob.title || '',
        location: existingJob.location || null,
        detailedAddress: existingJob.detailedAddress || '',
        contactPhone: existingJob.contactPhone || '',
        description: existingJob.description || '',
        // 일정
        workDate: existingJob.workDate || '',
        startTime: extractStartTime(existingJob.timeSlot),
        dateSpecificRequirements: existingJob.dateSpecificRequirements || [],
        daysPerWeek: existingJob.daysPerWeek ?? 5,
        isStartTimeNegotiable: existingJob.isStartTimeNegotiable ?? false,
        // 역할 (급여 정보 포함)
        roles: existingJob.roles
          ? convertRolesToFormRolesWithSalary(
              existingJob.roles as {
                role?: string;
                name?: string;
                count: number;
                filled?: number;
                salary?: { type: string; amount: number };
              }[]
            )
          : [...INITIAL_JOB_POSTING_FORM_DATA.roles],
        // 급여
        defaultSalary: existingJob.defaultSalary,
        allowances: existingJob.allowances || {},
        taxSettings: existingJob.taxSettings, // undefined면 SalarySection에서 DEFAULT_TAX_SETTINGS 사용
        useSameSalary: existingJob.useSameSalary ?? false,
        // 사전질문
        usesPreQuestions: existingJob.usesPreQuestions || false,
        preQuestions: existingJob.preQuestions || [],
        // 기타
        tags: existingJob.tags || [],
      });

      // 확정된 지원자가 있는지 확인
      const confirmedCount = existingJob.filledPositions ?? 0;
      setHasConfirmedApplicants(confirmedCount > 0);

      if (confirmedCount > 0) {
        addToast({
          type: 'warning',
          message: '확정된 지원자가 있어 일정/역할 수정이 제한됩니다',
        });
      }
    }
  }, [existingJob, formData, addToast]);

  // 폼 데이터 업데이트
  const updateFormData = useCallback((data: Partial<JobPostingFormData>) => {
    setIsDirty(true);
    setFormData((prev) => (prev ? { ...prev, ...data } : null));
  }, []);

  // 전체 유효성 검증
  const validateAll = useCallback((): boolean => {
    if (!formData) return false;

    const newErrors: SectionErrors = {
      basicInfo: validateBasicInfo(formData),
      // 확정된 지원자가 있으면 일정/역할 검증 스킵
      schedule: hasConfirmedApplicants ? {} : validateSchedule(formData),
      roles: hasConfirmedApplicants ? {} : validateRoles(formData),
      salary: validateSalary(formData),
      preQuestions: validatePreQuestions(formData),
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
  }, [formData, hasConfirmedApplicants]);

  // 공고 수정 제출
  const handleSubmit = useCallback(async () => {
    if (!user?.uid || !formData?.location || !id) {
      addToast({ type: 'error', message: '필수 정보가 누락되었습니다' });
      return;
    }

    if (!validateAll()) {
      addToast({ type: 'error', message: '입력 정보를 확인해주세요' });
      return;
    }

    try {
      const input: UpdateJobPostingInput = {
        postingType: formData.postingType,
        title: formData.title,
        description: formData.description || undefined,
        location: formData.location,
        detailedAddress: formData.detailedAddress || undefined,
        contactPhone: formData.contactPhone || undefined,
        // 확정된 지원자가 있으면 일정/역할 수정 불가
        ...(hasConfirmedApplicants
          ? {}
          : {
              workDate: formData.workDate,
              startTime: formData.startTime,
              daysPerWeek: formData.daysPerWeek,
              isStartTimeNegotiable: formData.isStartTimeNegotiable,
              roles: formData.roles,
            }),
        defaultSalary: formData.defaultSalary,
        useSameSalary: formData.useSameSalary,
        allowances: formData.allowances,
        // 세금 설정 (항상 포함하여 기존 값 덮어쓰기 보장)
        taxSettings:
          formData.taxSettings?.type !== 'none'
            ? formData.taxSettings
            : { type: 'none' as const, value: 0 },
        tags: formData.tags,
      };

      await updateJobPosting.mutateAsync({ jobPostingId: id, input });
      setIsDirty(false);

      addToast({ type: 'success', message: '공고가 수정되었습니다' });
      router.back();
    } catch (error) {
      logger.error('공고 수정 실패', error as Error, { jobPostingId: id });
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '공고 수정에 실패했습니다',
      });
    }
  }, [user, formData, hasConfirmedApplicants, id, validateAll, updateJobPosting, addToast, router]);

  // 섹션 위치 기록
  const handleSectionLayout = useCallback((section: string, y: number) => {
    sectionPositions.current[section] = y;
  }, []);

  // 에러 개수 계산
  const getErrorCount = useCallback((sectionErrors: Record<string, string>): number => {
    return Object.keys(sectionErrors).length;
  }, []);

  // 로딩 상태
  if (isJobLoading || !formData) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['bottom']}>
        <View className="flex-1 items-center justify-center">
          <Loading size="large" />
          <Text className="mt-4 text-gray-500 dark:text-gray-400">공고 정보를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 에러 상태
  if (jobError || !existingJob) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['bottom']}>
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            공고를 불러올 수 없습니다
          </Text>
          <Text className="text-gray-500 dark:text-gray-400 text-center mb-4">
            {jobError?.message || '공고 정보를 찾을 수 없습니다.'}
          </Text>
          <Button variant="primary" onPress={() => router.back()}>
            <Text className="text-white font-semibold">돌아가기</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          ref={scrollViewRef}
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 확정된 지원자 경고 */}
          {hasConfirmedApplicants && (
            <View className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <Text className="text-sm text-amber-700 dark:text-amber-300">
                확정된 지원자가 있어 일정과 역할 정보는 수정할 수 없습니다.
              </Text>
            </View>
          )}

          {/* 기본 정보 섹션 */}
          <View onLayout={(e) => handleSectionLayout('basicInfo', e.nativeEvent.layout.y)}>
            <SectionCard
              title="기본 정보"
              required
              hasError={getErrorCount(errors.basicInfo) > 0}
              errorCount={getErrorCount(errors.basicInfo)}
            >
              <BasicInfoSection
                data={formData}
                onUpdate={updateFormData}
                errors={errors.basicInfo}
              />
            </SectionCard>
          </View>

          {/* 일정 섹션 */}
          <View onLayout={(e) => handleSectionLayout('schedule', e.nativeEvent.layout.y)}>
            <SectionCard
              title="일정"
              required
              hasError={getErrorCount(errors.schedule) > 0}
              errorCount={getErrorCount(errors.schedule)}
            >
              {hasConfirmedApplicants ? (
                <View className="p-4 bg-gray-100 dark:bg-surface rounded-lg">
                  <Text className="text-gray-500 dark:text-gray-400 text-center">
                    확정된 지원자가 있어 일정을 수정할 수 없습니다.
                  </Text>
                </View>
              ) : formData.postingType === 'fixed' ? (
                <ScheduleSection
                  data={formData}
                  onUpdate={updateFormData}
                  errors={errors.schedule}
                />
              ) : (
                <DateRequirementsSection
                  data={formData}
                  onUpdate={updateFormData}
                  errors={errors.schedule}
                />
              )}
            </SectionCard>
          </View>

          {/* 역할/인원 섹션 - fixed 타입만 표시 (다른 타입은 DateRequirements 내 역할 관리) */}
          {formData.postingType === 'fixed' && (
            <View onLayout={(e) => handleSectionLayout('roles', e.nativeEvent.layout.y)}>
              <SectionCard
                title="역할/인원"
                required
                hasError={getErrorCount(errors.roles) > 0}
                errorCount={getErrorCount(errors.roles)}
              >
                {hasConfirmedApplicants ? (
                  <View className="p-4 bg-gray-100 dark:bg-surface rounded-lg">
                    <Text className="text-gray-500 dark:text-gray-400 text-center">
                      확정된 지원자가 있어 역할을 수정할 수 없습니다.
                    </Text>
                  </View>
                ) : (
                  <RolesSection data={formData} onUpdate={updateFormData} errors={errors.roles} />
                )}
              </SectionCard>
            </View>
          )}

          {/* 급여 섹션 */}
          <View onLayout={(e) => handleSectionLayout('salary', e.nativeEvent.layout.y)}>
            <SectionCard
              title="급여"
              required
              hasError={getErrorCount(errors.salary) > 0}
              errorCount={getErrorCount(errors.salary)}
            >
              <SalarySection data={formData} onUpdate={updateFormData} errors={errors.salary} />
            </SectionCard>
          </View>

          {/* 사전질문 섹션 */}
          <View onLayout={(e) => handleSectionLayout('preQuestions', e.nativeEvent.layout.y)}>
            <SectionCard
              title="사전질문"
              optional
              hasError={getErrorCount(errors.preQuestions) > 0}
              errorCount={getErrorCount(errors.preQuestions)}
            >
              <PreQuestionsSection
                data={formData}
                onUpdate={updateFormData}
                errors={errors.preQuestions}
              />
            </SectionCard>
          </View>
        </ScrollView>

        {/* 하단 버튼 영역 (고정) */}
        <View className="absolute bottom-0 left-0 right-0 p-4 bg-white dark:bg-surface-dark border-t border-gray-200 dark:border-surface-overlay">
          <Button
            variant="primary"
            size="lg"
            onPress={handleSubmit}
            disabled={updateJobPosting.isPending}
            fullWidth
          >
            <Text className="text-white font-semibold">
              {updateJobPosting.isPending ? '수정 중...' : '공고 수정'}
            </Text>
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
