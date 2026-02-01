/**
 * UNIQN Mobile - 회원가입 단계 표시기 컴포넌트
 *
 * @description 4단계 회원가입 플로우의 진행 상태를 시각적으로 표시
 * @version 1.0.0
 */

import React from 'react';
import { View, Text } from 'react-native';

// ============================================================================
// Types
// ============================================================================

export interface StepInfo {
  label: string;
  shortLabel?: string;
}

interface StepIndicatorProps {
  currentStep: number;
  steps: StepInfo[];
  showLabels?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

export const SIGNUP_STEPS: StepInfo[] = [
  { label: '계정 정보', shortLabel: '계정' },
  { label: '본인인증', shortLabel: '인증' },
  { label: '프로필', shortLabel: '프로필' },
  { label: '약관동의', shortLabel: '약관' },
];

// ============================================================================
// Component
// ============================================================================

export function StepIndicator({
  currentStep,
  steps,
  showLabels = true,
}: StepIndicatorProps) {
  return (
    <View className="w-full">
      {/* 스텝 원형 및 연결선 */}
      <View className="flex-row items-center justify-center">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isActive = stepNumber === currentStep;
          const isUpcoming = stepNumber > currentStep;
          const isLast = index === steps.length - 1;

          return (
            <React.Fragment key={index}>
              {/* 스텝 원형 */}
              <View className="items-center">
                <View
                  className={`
                    w-8 h-8 rounded-full items-center justify-center
                    ${isCompleted ? 'bg-success-500 dark:bg-success-600' : ''}
                    ${isActive ? 'bg-primary-600 dark:bg-primary-500' : ''}
                    ${isUpcoming ? 'bg-gray-200 dark:bg-surface' : ''}
                  `}
                >
                  {isCompleted ? (
                    <Text className="text-white text-sm font-bold">✓</Text>
                  ) : (
                    <Text
                      className={`text-sm font-bold ${
                        isActive
                          ? 'text-white'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {stepNumber}
                    </Text>
                  )}
                </View>

                {/* 라벨 */}
                {showLabels && (
                  <Text
                    className={`
                      text-xs mt-1 text-center
                      ${isActive ? 'font-semibold text-primary-600 dark:text-primary-400' : ''}
                      ${isCompleted ? 'text-success-600 dark:text-success-400' : ''}
                      ${isUpcoming ? 'text-gray-400 dark:text-gray-500' : ''}
                    `}
                    numberOfLines={1}
                  >
                    {step.shortLabel || step.label}
                  </Text>
                )}
              </View>

              {/* 연결선 */}
              {!isLast && (
                <View
                  className={`
                    flex-1 h-0.5 mx-2 mb-5
                    ${stepNumber < currentStep
                      ? 'bg-success-500 dark:bg-success-600'
                      : 'bg-gray-200 dark:bg-surface'
                    }
                  `}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>

      {/* 현재 단계 제목 */}
      <View className="mt-4">
        <Text className="text-center text-lg font-bold text-gray-900 dark:text-white">
          {steps[currentStep - 1]?.label}
        </Text>
        <Text className="text-center text-sm text-gray-500 dark:text-gray-400 mt-1">
          {currentStep}/{steps.length} 단계
        </Text>
      </View>
    </View>
  );
}

export default StepIndicator;
