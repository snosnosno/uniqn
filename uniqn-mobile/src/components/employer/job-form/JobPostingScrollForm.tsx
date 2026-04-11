import React, { useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView } from 'react-native';
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

  const sectionPositions = useRef<Record<string, number>>({});

  const validateAll = useCallback((): boolean => {
    const newErrors = validateAllSections(data);
    setErrors(newErrors);

    const firstError = getFirstErrorSection(newErrors);
    if (firstError) {
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
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View onLayout={(e) => handleSectionLayout('basicInfo', e.nativeEvent.layout.y)}>
          <SectionCard
            title="기본 정보"
            required
            hasError={getErrorCount(errors.basicInfo) > 0}
            errorCount={getErrorCount(errors.basicInfo)}
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
          >
            <PreQuestionsSection data={data} onUpdate={onUpdate} errors={errors.preQuestions} />
          </SectionCard>
        </View>

        {isTournament && (
          <View className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
            <Text className="mb-1 text-sm font-medium text-amber-800 dark:text-amber-200">
              대회공고 안내
            </Text>
            <Text className="text-xs text-amber-700 dark:text-amber-300">
              대회공고는 관리자 승인 후 게시됩니다.
              {'\n'}
              승인까지 1-2 영업일이 소요될 수 있습니다.
            </Text>
          </View>
        )}
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 border-t border-gray-200 bg-white px-4 py-2 dark:border-surface-overlay dark:bg-surface-dark">
        <View className="flex-row items-center gap-2">
          {onLoadTemplate && (
            <Button variant="ghost" size="sm" onPress={onLoadTemplate}>
              <Text className="text-sm text-primary-600 dark:text-primary-400">불러오기</Text>
            </Button>
          )}
          {onSaveTemplate && (
            <Button variant="ghost" size="sm" onPress={onSaveTemplate} disabled={isSavingTemplate}>
              <Text
                className={`text-sm ${isSavingTemplate ? 'text-gray-400' : 'text-primary-600 dark:text-primary-400'}`}
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
              <Text className="text-sm font-semibold text-white">
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
