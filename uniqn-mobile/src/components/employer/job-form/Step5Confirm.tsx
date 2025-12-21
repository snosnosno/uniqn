/**
 * UNIQN Mobile - 공고 작성 Step 5: 확인
 *
 * @description 입력 내용 최종 검토 및 등록
 * @version 1.0.0
 */

import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Button, Card, Badge } from '@/components';
import {
  MapPinIcon,
  CalendarIcon,
  ClockIcon,
  UsersIcon,
  CurrencyDollarIcon,
  PhoneIcon,
  CheckCircleIcon,
} from '@/components/icons';
import type { JobPostingFormData, StaffRole, RoleRequirement } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface Step5ConfirmProps {
  data: JobPostingFormData;
  onSubmit: () => void;
  onPrev: () => void;
  isSubmitting: boolean;
  isEditMode?: boolean;
}

// 역할 라벨
const ROLE_LABELS: Record<StaffRole, string> = {
  dealer: '딜러',
  manager: '매니저',
  chiprunner: '칩러너',
  admin: '관리자',
};

// 급여 타입 라벨
const SALARY_TYPE_LABELS = {
  hourly: '시급',
  daily: '일급',
  monthly: '월급',
  other: '기타',
};

// ============================================================================
// Helper Functions
// ============================================================================

const formatCurrency = (value: number): string => {
  return value.toLocaleString('ko-KR');
};

const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const weekday = weekdays[date.getDay()];
  return `${year}년 ${month}월 ${day}일 (${weekday})`;
};

// ============================================================================
// Sub-components
// ============================================================================

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string | React.ReactNode;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <View className="flex-row items-start py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
      <View className="w-8">{icon}</View>
      <View className="flex-1">
        <Text className="text-sm text-gray-500 dark:text-gray-400">{label}</Text>
        {typeof value === 'string' ? (
          <Text className="text-gray-900 dark:text-white font-medium mt-0.5">
            {value}
          </Text>
        ) : (
          value
        )}
      </View>
    </View>
  );
}

// ============================================================================
// Component
// ============================================================================

export function Step5Confirm({ data, onSubmit, onPrev, isSubmitting, isEditMode = false }: Step5ConfirmProps) {
  const totalPositions = data.roles.reduce((sum: number, r: RoleRequirement) => sum + r.count, 0);
  const hasAllowances =
    (data.allowances?.meal ?? 0) > 0 ||
    (data.allowances?.transportation ?? 0) > 0 ||
    (data.allowances?.accommodation ?? 0) > 0;

  return (
    <View className="flex-1">
      <ScrollView className="flex-1 p-4">
        {/* 안내 */}
        <View className="flex-row items-center mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <CheckCircleIcon size={20} color="#10B981" />
          <Text className="ml-2 text-sm text-green-700 dark:text-green-300">
            {isEditMode ? '수정된 내용을 확인해주세요' : '입력하신 내용을 확인해주세요'}
          </Text>
        </View>

        {/* 공고 제목 */}
        <Card variant="elevated" padding="lg" className="mb-4">
          <Text className="text-xl font-bold text-gray-900 dark:text-white">
            {data.title}
          </Text>
          {data.isUrgent && (
            <Badge variant="warning" size="sm" className="mt-2">
              긴급 공고
            </Badge>
          )}
        </Card>

        {/* 기본 정보 */}
        <Card variant="outlined" padding="md" className="mb-4">
          <Text className="font-semibold text-gray-900 dark:text-white mb-2">
            기본 정보
          </Text>

          <InfoRow
            icon={<MapPinIcon size={18} color="#6B7280" />}
            label="근무 장소"
            value={
              <View>
                <Text className="text-gray-900 dark:text-white font-medium mt-0.5">
                  {data.location?.name || '-'}
                </Text>
                {data.detailedAddress && (
                  <Text className="text-sm text-gray-500 dark:text-gray-400">
                    {data.detailedAddress}
                  </Text>
                )}
              </View>
            }
          />

          <InfoRow
            icon={<CalendarIcon size={18} color="#6B7280" />}
            label="근무 날짜"
            value={formatDate(data.workDate)}
          />

          <InfoRow
            icon={<ClockIcon size={18} color="#6B7280" />}
            label="근무 시간"
            value={data.timeSlot}
          />

          {data.contactPhone && (
            <InfoRow
              icon={<PhoneIcon size={18} color="#6B7280" />}
              label="문의 연락처"
              value={data.contactPhone}
            />
          )}
        </Card>

        {/* 모집 정보 */}
        <Card variant="outlined" padding="md" className="mb-4">
          <Text className="font-semibold text-gray-900 dark:text-white mb-2">
            모집 정보
          </Text>

          <InfoRow
            icon={<UsersIcon size={18} color="#6B7280" />}
            label="모집 인원"
            value={
              <View className="mt-1">
                <Text className="text-lg font-bold text-primary-600 dark:text-primary-400">
                  총 {totalPositions}명
                </Text>
                <View className="flex-row flex-wrap gap-2 mt-2">
                  {data.roles.map((role) => (
                    <Badge key={role.role} variant="primary" size="sm">
                      {ROLE_LABELS[role.role]} {role.count}명
                    </Badge>
                  ))}
                </View>
              </View>
            }
          />
        </Card>

        {/* 급여 정보 */}
        <Card variant="outlined" padding="md" className="mb-4">
          <Text className="font-semibold text-gray-900 dark:text-white mb-2">
            급여 정보
          </Text>

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
              </View>
            }
          />

          {hasAllowances && (
            <View className="pt-3 border-t border-gray-100 dark:border-gray-700 mt-3">
              <Text className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                추가 수당
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {data.allowances?.meal && (
                  <Badge variant="default" size="sm">
                    🍱 식대 {formatCurrency(data.allowances.meal)}원
                  </Badge>
                )}
                {data.allowances?.transportation && (
                  <Badge variant="default" size="sm">
                    🚗 교통비 {formatCurrency(data.allowances.transportation)}원
                  </Badge>
                )}
                {data.allowances?.accommodation && (
                  <Badge variant="default" size="sm">
                    🏨 숙박비 {formatCurrency(data.allowances.accommodation)}원
                  </Badge>
                )}
              </View>
            </View>
          )}
        </Card>

        {/* 공고 설명 */}
        {data.description && (
          <Card variant="outlined" padding="md" className="mb-4">
            <Text className="font-semibold text-gray-900 dark:text-white mb-2">
              공고 설명
            </Text>
            <Text className="text-gray-700 dark:text-gray-300">
              {data.description}
            </Text>
          </Card>
        )}

        {/* 주의사항 */}
        <View className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg mb-4">
          <Text className="text-sm text-yellow-700 dark:text-yellow-300">
            {isEditMode
              ? '⚠️ 수정된 내용은 즉시 반영됩니다. 다시 한번 확인해주세요.'
              : '⚠️ 공고 등록 후에는 확정된 지원자가 있을 경우 일정 및 역할을 수정할 수 없습니다. 내용을 다시 한번 확인해주세요.'}
          </Text>
        </View>
      </ScrollView>

      {/* 버튼 영역 */}
      <View className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
        <View className="flex-row gap-3">
          <Button
            variant="outline"
            size="lg"
            onPress={onPrev}
            disabled={isSubmitting}
            className="flex-1"
          >
            이전
          </Button>
          <Button
            variant="primary"
            size="lg"
            onPress={onSubmit}
            loading={isSubmitting}
            className="flex-[2]"
          >
            {isEditMode ? '공고 수정하기' : '공고 등록하기'}
          </Button>
        </View>
      </View>
    </View>
  );
}
