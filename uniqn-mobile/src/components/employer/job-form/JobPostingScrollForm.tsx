import React, { useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Button } from '@/components';
import {
  SectionCard,
  BasicInfoSection,
  DateRequirementsSection,
  RolesSection,
  SalarySection,
  ScheduleSection,
  PreQuestionsSection,
} from './sections';
import type { JobPostingFormData } from '@/types';
import {
  type SectionErrors,
  validateAllSections,
  getFirstErrorSection,
} from '@/utils/job-posting/validation';

type SectionKey = 'basicInfo' | 'schedule' | 'roles' | 'salary' | 'preQuestions';

type CollapsedState = Record<SectionKey, boolean>;

const INITIAL_COLLAPSED: CollapsedState = {
  basicInfo: false,
  schedule: false,
  roles: false,
  salary: false,
  preQuestions: false,
};

interface JobPostingScrollFormProps {
  data: JobPostingFormData;
  onUpdate: (data: Partial<JobPostingFormData>) => void;
  onSubmit: () => void;
  onSaveTemplate?: () => void;
  onLoadTemplate?: () => void;
  isSubmitting?: boolean;
  isSavingTemplate?: boolean;
}

export function JobPostingScrollForm({
  data,
  onUpdate,
  onSubmit,
  onSaveTemplate,
  onLoadTemplate,
  isSubmitting = false,
  isSavingTemplate = false,
}: JobPostingScrollFormProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const [errors, setErrors] = useState<SectionErrors>({
    basicInfo: {},
    schedule: {},
    roles: {},
    salary: {},
    preQuestions: {},
  });
  const [collapsed, setCollapsed] = useState<CollapsedState>(INITIAL_COLLAPSED);

  const sectionPositions = useRef<Record<string, number>>({});

  const handleToggleSection = useCallback((section: SectionKey) => {
    setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const isAllExpanded = useMemo(() => Object.values(collapsed).every((c) => !c), [collapsed]);

  const handleToggleAll = useCallback(() => {
    setCollapsed((prev) => {
      const allExpanded = Object.values(prev).every((c) => !c);
      const nextCollapsed = allExpanded;
      return {
        basicInfo: nextCollapsed,
        schedule: nextCollapsed,
        roles: nextCollapsed,
        salary: nextCollapsed,
        preQuestions: nextCollapsed,
      };
    });
  }, []);

  const validateAll = useCallback((): boolean => {
    const newErrors = validateAllSections(data);
    setErrors(newErrors);

    const firstError = getFirstErrorSection(newErrors);
    if (firstError) {
      setCollapsed((prev) => {
        const next = { ...prev };
        (Object.keys(newErrors) as SectionKey[]).forEach((key) => {
          if (Object.keys(newErrors[key]).length > 0) {
            next[key] = false;
          }
        });
        return next;
      });
      const position = sectionPositions.current[firstError];
      if (position !== undefined && scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: position - 20, animated: true });
      }
      return false;
    }

    return true;
  }, [data]);

  const handleSubmit = useCallback(() => {
    if (validateAll()) {
      onSubmit();
    }
  }, [validateAll, onSubmit]);

  const handleSectionLayout = useCallback((section: string, y: number) => {
    sectionPositions.current[section] = y;
  }, []);

  const getErrorCount = useCallback((sectionErrors: Record<string, string>): number => {
    return Object.keys(sectionErrors).length;
  }, []);

  const isTournament = data.postingType === 'tournament';
  const isFixed = data.postingType === 'fixed';

  return (
    <View className="flex-1">
      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 0, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-1.5 flex-row justify-end">
          <Pressable
            onPress={handleToggleAll}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={isAllExpanded ? '모든 섹션 접기' : '모든 섹션 펼치기'}
            className="rounded-full border border-secondary-200 bg-secondary-100 px-3 py-1.5 dark:border-surface-overlay dark:bg-surface-overlay"
          >
            <Text className="text-xs text-content-secondary font-sans">
              {isAllExpanded ? '모두 접기' : '모두 펼치기'}
            </Text>
          </Pressable>
        </View>

        <View onLayout={(e) => handleSectionLayout('basicInfo', e.nativeEvent.layout.y)}>
          <SectionCard
            title="기본 정보"
            required
            hasError={getErrorCount(errors.basicInfo) > 0}
            errorCount={getErrorCount(errors.basicInfo)}
            collapsible
            collapsed={collapsed.basicInfo}
            onToggle={() => handleToggleSection('basicInfo')}
          >
            <BasicInfoSection data={data} onUpdate={onUpdate} errors={errors.basicInfo} />
          </SectionCard>
        </View>

        <View onLayout={(e) => handleSectionLayout('schedule', e.nativeEvent.layout.y)}>
          <SectionCard
            title="일정"
            required
            hasError={getErrorCount(errors.schedule) > 0}
            errorCount={getErrorCount(errors.schedule)}
            collapsible
            collapsed={collapsed.schedule}
            onToggle={() => handleToggleSection('schedule')}
          >
            {isFixed ? (
              <ScheduleSection data={data} onUpdate={onUpdate} errors={errors.schedule} />
            ) : (
              <DateRequirementsSection data={data} onUpdate={onUpdate} errors={errors.schedule} />
            )}
          </SectionCard>
        </View>

        {isFixed && (
          <View onLayout={(e) => handleSectionLayout('roles', e.nativeEvent.layout.y)}>
            <SectionCard
              title="모집 역할"
              required
              hasError={getErrorCount(errors.roles) > 0}
              errorCount={getErrorCount(errors.roles)}
              collapsible
              collapsed={collapsed.roles}
              onToggle={() => handleToggleSection('roles')}
            >
              <RolesSection data={data} onUpdate={onUpdate} errors={errors.roles} />
            </SectionCard>
          </View>
        )}

        <View onLayout={(e) => handleSectionLayout('salary', e.nativeEvent.layout.y)}>
          <SectionCard
            title="급여"
            required
            hasError={getErrorCount(errors.salary) > 0}
            errorCount={getErrorCount(errors.salary)}
            collapsible
            collapsed={collapsed.salary}
            onToggle={() => handleToggleSection('salary')}
          >
            <SalarySection data={data} onUpdate={onUpdate} errors={errors.salary} />
          </SectionCard>
        </View>

        <View onLayout={(e) => handleSectionLayout('preQuestions', e.nativeEvent.layout.y)}>
          <SectionCard
            title="사전질문"
            optional
            hasError={getErrorCount(errors.preQuestions) > 0}
            errorCount={getErrorCount(errors.preQuestions)}
            collapsible
            collapsed={collapsed.preQuestions}
            onToggle={() => handleToggleSection('preQuestions')}
          >
            <PreQuestionsSection data={data} onUpdate={onUpdate} errors={errors.preQuestions} />
          </SectionCard>
        </View>

        {isTournament && (
          <View className="mb-4 rounded-md border border-amber-200 bg-warning-50 p-4 dark:border-amber-700 dark:bg-warning-900/20">
            <Text className="mb-1 text-sm font-sans-medium text-warning-800 dark:text-warning-200">
              대회공고 안내
            </Text>
            <Text className="text-xs text-warning-700 dark:text-warning-300 font-sans">
              대회공고는 관리자 승인 후 게시됩니다.
              {'\n'}
              승인까지 1-2 영업일이 소요될 수 있습니다.
            </Text>
          </View>
        )}
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 border-t border-secondary-200 bg-white px-4 py-2 dark:border-surface-overlay dark:bg-surface-dark">
        <View className="flex-row items-center gap-2">
          {onLoadTemplate && (
            <Button variant="ghost" size="sm" onPress={onLoadTemplate}>
              <Text className="text-sm text-primary-600 dark:text-primary-400 font-sans">
                불러오기
              </Text>
            </Button>
          )}
          {onSaveTemplate && (
            <Button variant="ghost" size="sm" onPress={onSaveTemplate} disabled={isSavingTemplate}>
              <Text
                className={`text-sm ${isSavingTemplate ? 'text-secondary-400' : 'text-primary-600 dark:text-primary-400'} font-sans`}
              >
                {isSavingTemplate ? '저장 중...' : '저장'}
              </Text>
            </Button>
          )}
          <View className="flex-1">
            <Button
              variant="primary"
              size="sm"
              onPress={handleSubmit}
              disabled={isSubmitting}
              fullWidth
              accessibilityLabel={isTournament ? '승인 요청' : '공고 등록'}
              testID="job-posting-create-submit"
            >
              <Text className="text-sm font-sans-semibold text-surface-dark">
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
