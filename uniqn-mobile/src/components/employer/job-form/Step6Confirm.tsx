/**
 * UNIQN Mobile - 공고 작성 Step 6: 최종 확인
 *
 * @description 입력 내용 최종 검토 및 등록 (4가지 타입 지원)
 * @version 2.0.0 - 타입별 요약 표시 지원
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Button, Card, Badge } from '@/components';
import {
  MapPinIcon,
  CalendarIcon,
  ClockIcon,
  UsersIcon,
  CurrencyDollarIcon,
  PhoneIcon,
  CheckCircleIcon,
  EditIcon,
  InformationCircleIcon,
  CalendarDaysIcon,
  StarIcon,
} from '@/components/icons';
import type { JobPostingFormData } from '@/types';
import { POSTING_TYPE_INFO, validateForm } from '@/types/jobPostingForm';
import { PRE_QUESTION_TYPE_LABELS } from '@/types';
import { SALARY_TYPE_LABELS } from '@/constants';

// ============================================================================
// Types
// ============================================================================

interface Step6ConfirmProps {
  data: JobPostingFormData;
  onSubmit: () => void;
  onBack: () => void;
  onEditStep: (step: number) => void;
  isSubmitting: boolean;
  isEditMode?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

const formatCurrency = (value: number): string => {
  return value.toLocaleString('ko-KR');
};

const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const weekday = weekdays[date.getDay()];
  return `${year}년 ${month}월 ${day}일 (${weekday})`;
};

const formatDateShort = (dateString: string): string => {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  return `${month}/${day} (${weekdays[date.getDay()]})`;
};

// ============================================================================
// Sub-components
// ============================================================================

interface SectionHeaderProps {
  title: string;
  stepNumber: number;
  onEdit: () => void;
}

function SectionHeader({ title, stepNumber, onEdit }: SectionHeaderProps) {
  return (
    <View className="flex-row items-center justify-between mb-2">
      <View className="flex-row items-center">
        <View className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 items-center justify-center mr-2">
          <Text className="text-primary-700 dark:text-primary-300 font-bold text-xs">
            {stepNumber}
          </Text>
        </View>
        <Text className="font-semibold text-gray-900 dark:text-white">
          {title}
        </Text>
      </View>
      <Pressable
        onPress={onEdit}
        className="flex-row items-center px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700"
        accessibilityRole="button"
        accessibilityLabel={`${title} 수정`}
      >
        <EditIcon size={14} color="#6B7280" />
        <Text className="ml-1 text-xs text-gray-600 dark:text-gray-400">
          수정
        </Text>
      </Pressable>
    </View>
  );
}

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string | React.ReactNode;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <View className="flex-row items-start py-2">
      <View className="w-8">{icon}</View>
      <View className="flex-1">
        <Text className="text-sm text-gray-500 dark:text-gray-400">{label}</Text>
        {typeof value === 'string' ? (
          <Text className="text-gray-900 dark:text-white font-medium mt-0.5">
            {value || '-'}
          </Text>
        ) : (
          value
        )}
      </View>
    </View>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function Step6Confirm({
  data,
  onSubmit,
  onBack,
  onEditStep,
  isSubmitting,
  isEditMode = false,
}: Step6ConfirmProps) {
  // 총 인원 계산
  const totalPositions = useMemo(
    () => data.roles.reduce((sum, r) => sum + r.count, 0),
    [data.roles]
  );

  // 수당 유무 확인
  const hasAllowances = useMemo(
    () =>
      (data.allowances?.meal ?? 0) > 0 ||
      (data.allowances?.transportation ?? 0) > 0 ||
      (data.allowances?.accommodation ?? 0) > 0,
    [data.allowances]
  );

  // 전체 검증
  const validation = useMemo(() => validateForm(data), [data]);

  // 타입 정보
  const typeInfo = POSTING_TYPE_INFO[data.postingType];

  // 일정 렌더링 (타입별)
  const renderScheduleInfo = useCallback(() => {
    switch (data.postingType) {
      case 'regular':
      case 'urgent':
        return (
          <>
            <InfoRow
              icon={<CalendarIcon size={18} color="#6B7280" />}
              label="근무 날짜"
              value={formatDate(data.workDate)}
            />
            <InfoRow
              icon={<ClockIcon size={18} color="#6B7280" />}
              label="출근 시간"
              value={data.startTime || '-'}
            />
          </>
        );

      case 'fixed':
        return (
          <>
            <InfoRow
              icon={<CalendarDaysIcon size={18} color="#6B7280" />}
              label="근무 일수"
              value={`주 ${data.daysPerWeek}일`}
            />
            {data.workDays && data.workDays.length > 0 && (
              <InfoRow
                icon={<CalendarIcon size={18} color="#6B7280" />}
                label="근무 요일"
                value={data.workDays.join(', ')}
              />
            )}
            <InfoRow
              icon={<ClockIcon size={18} color="#6B7280" />}
              label="출근 시간"
              value={data.startTime || '-'}
            />
          </>
        );

      case 'tournament':
        return (
          <InfoRow
            icon={<StarIcon size={18} color="#F59E0B" />}
            label="대회 일정"
            value={
              <View className="mt-1">
                {data.tournamentDates.map((day) => (
                  <View key={day.day} className="flex-row items-center mb-1">
                    <Badge variant="warning" size="sm" className="mr-2">
                      Day {day.day}
                    </Badge>
                    <Text className="text-gray-900 dark:text-white">
                      {formatDateShort(day.date)} {day.startTime}
                    </Text>
                  </View>
                ))}
              </View>
            }
          />
        );

      default:
        return null;
    }
  }, [data.postingType, data.workDate, data.startTime, data.daysPerWeek, data.workDays, data.tournamentDates]);

  return (
    <View className="flex-1">
      <ScrollView className="flex-1 p-4">
        {/* 안내 메시지 */}
        <View className="flex-row items-center mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <CheckCircleIcon size={20} color="#10B981" />
          <Text className="ml-2 text-sm text-green-700 dark:text-green-300">
            {isEditMode ? '수정된 내용을 확인해주세요' : '입력하신 내용을 확인해주세요'}
          </Text>
        </View>

        {/* 검증 오류 */}
        {!validation.isValid && (
          <View className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <Text className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">
              입력 내용을 확인해주세요
            </Text>
            {Object.entries(validation.errors).map(([step, errors]) => (
              <View key={step} className="mb-1">
                {errors.map((error, idx) => (
                  <Text key={idx} className="text-xs text-red-600 dark:text-red-400">
                    • {error}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* 공고 타입 + 제목 */}
        <Card variant="elevated" padding="lg" className="mb-4">
          <View className="flex-row items-center mb-2">
            <Text className="text-xl mr-2">{typeInfo.icon}</Text>
            <Badge
              variant={data.postingType === 'urgent' ? 'warning' : 'primary'}
              size="sm"
            >
              {typeInfo.label}
            </Badge>
            {data.postingType === 'tournament' && (
              <Badge variant="default" size="sm" className="ml-2">
                승인 필요
              </Badge>
            )}
          </View>
          <Text className="text-xl font-bold text-gray-900 dark:text-white">
            {data.title || '(제목 없음)'}
          </Text>
        </Card>

        {/* Step 1: 기본 정보 */}
        <Card variant="outlined" padding="md" className="mb-4">
          <SectionHeader
            title="기본 정보"
            stepNumber={1}
            onEdit={() => onEditStep(1)}
          />

          <InfoRow
            icon={<MapPinIcon size={18} color="#6B7280" />}
            label="근무 장소"
            value={
              <View>
                <Text className="text-gray-900 dark:text-white font-medium mt-0.5">
                  {data.location?.name || '-'}
                </Text>
                {data.location?.address && (
                  <Text className="text-sm text-gray-500 dark:text-gray-400">
                    {data.location.address}
                  </Text>
                )}
                {data.detailedAddress && (
                  <Text className="text-sm text-gray-500 dark:text-gray-400">
                    {data.detailedAddress}
                  </Text>
                )}
              </View>
            }
          />

          <InfoRow
            icon={<PhoneIcon size={18} color="#6B7280" />}
            label="연락처"
            value={data.contactPhone}
          />

          {data.description && (
            <View className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <Text className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                공고 설명
              </Text>
              <Text className="text-gray-700 dark:text-gray-300 text-sm">
                {data.description}
              </Text>
            </View>
          )}
        </Card>

        {/* Step 2: 일정 */}
        <Card variant="outlined" padding="md" className="mb-4">
          <SectionHeader
            title="일정"
            stepNumber={2}
            onEdit={() => onEditStep(2)}
          />
          {renderScheduleInfo()}
        </Card>

        {/* Step 3: 역할/인원 */}
        <Card variant="outlined" padding="md" className="mb-4">
          <SectionHeader
            title="역할/인원"
            stepNumber={3}
            onEdit={() => onEditStep(3)}
          />

          <InfoRow
            icon={<UsersIcon size={18} color="#6B7280" />}
            label="모집 인원"
            value={
              <View className="mt-1">
                <Text className="text-lg font-bold text-primary-600 dark:text-primary-400">
                  총 {totalPositions}명
                </Text>
                <View className="flex-row flex-wrap gap-2 mt-2">
                  {data.roles.map((role, idx) => (
                    <Badge key={idx} variant="primary" size="sm">
                      {role.name} {role.count}명
                    </Badge>
                  ))}
                </View>
              </View>
            }
          />
        </Card>

        {/* Step 4: 급여 */}
        <Card variant="outlined" padding="md" className="mb-4">
          <SectionHeader
            title="급여"
            stepNumber={4}
            onEdit={() => onEditStep(4)}
          />

          <InfoRow
            icon={<CurrencyDollarIcon size={18} color="#6B7280" />}
            label="급여"
            value={
              <View className="mt-1">
                <Text className="text-lg font-bold text-gray-900 dark:text-white">
                  {data.salary.type === 'other'
                    ? '협의'
                    : `${formatCurrency(data.salary.amount)}원`}
                </Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400">
                  {SALARY_TYPE_LABELS[data.salary.type]}
                </Text>

                {/* 역할별 급여 */}
                {data.useRoleSalary && Object.keys(data.roleSalaries).length > 0 && (
                  <View className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      역할별 급여
                    </Text>
                    {data.roles.map((role, idx) => {
                      const roleSalary = data.roleSalaries[role.name];
                      return (
                        <Text key={idx} className="text-sm text-gray-700 dark:text-gray-300">
                          {role.name}: {roleSalary ? formatCurrency(roleSalary.amount) : '-'}원
                        </Text>
                      );
                    })}
                  </View>
                )}
              </View>
            }
          />

          {hasAllowances && (
            <View className="pt-2 mt-2 border-t border-gray-100 dark:border-gray-700">
              <Text className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                추가 수당
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {data.allowances?.meal && (
                  <Badge variant="default" size="sm">
                    식대 {formatCurrency(data.allowances.meal)}원
                  </Badge>
                )}
                {data.allowances?.transportation && (
                  <Badge variant="default" size="sm">
                    교통비 {formatCurrency(data.allowances.transportation)}원
                  </Badge>
                )}
                {data.allowances?.accommodation && (
                  <Badge variant="default" size="sm">
                    숙박비 {formatCurrency(data.allowances.accommodation)}원
                  </Badge>
                )}
              </View>
            </View>
          )}
        </Card>

        {/* Step 5: 사전질문 (선택) */}
        {data.usesPreQuestions && data.preQuestions.length > 0 && (
          <Card variant="outlined" padding="md" className="mb-4">
            <SectionHeader
              title="사전질문"
              stepNumber={5}
              onEdit={() => onEditStep(5)}
            />

            <View>
              {data.preQuestions.map((q, idx) => (
                <View
                  key={q.id}
                  className={`py-2 ${idx < data.preQuestions.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}
                >
                  <View className="flex-row items-start">
                    <InformationCircleIcon size={16} color="#6B7280" />
                    <View className="ml-2 flex-1">
                      <Text className="text-gray-900 dark:text-white font-medium">
                        {q.question || '(질문 없음)'}
                      </Text>
                      <View className="flex-row items-center mt-1">
                        <Badge variant="default" size="sm">
                          {PRE_QUESTION_TYPE_LABELS[q.type]}
                        </Badge>
                        {q.required && (
                          <Badge variant="warning" size="sm" className="ml-1">
                            필수
                          </Badge>
                        )}
                      </View>
                      {q.type === 'select' && q.options && q.options.length > 0 && (
                        <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          선택지: {q.options.filter(Boolean).join(', ')}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* 주의사항 */}
        <View className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg mb-4">
          <Text className="text-sm text-yellow-700 dark:text-yellow-300">
            {data.postingType === 'tournament'
              ? '대회 공고는 관리자 승인 후 게시됩니다.'
              : isEditMode
                ? '수정된 내용은 즉시 반영됩니다. 다시 한번 확인해주세요.'
                : '공고 등록 후에는 확정된 지원자가 있을 경우 일정 및 역할을 수정할 수 없습니다.'}
          </Text>
        </View>
      </ScrollView>

      {/* 버튼 그룹 (고정) */}
      <View className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button
              variant="outline"
              size="lg"
              onPress={onBack}
              disabled={isSubmitting}
              fullWidth
            >
              이전
            </Button>
          </View>
          <View className="flex-[2]">
            <Button
              variant="primary"
              size="lg"
              onPress={onSubmit}
              loading={isSubmitting}
              disabled={!validation.isValid}
              fullWidth
            >
              {isEditMode ? '공고 수정하기' : '공고 등록하기'}
            </Button>
          </View>
        </View>
      </View>
    </View>
  );
}

export default Step6Confirm;
