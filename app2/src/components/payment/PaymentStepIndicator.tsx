/**
 * 결제 단계 표시 컴포넌트
 *
 * 기능:
 * - 결제 프로세스의 현재 단계를 시각적으로 표시
 * - 완료/진행 중/대기 중 상태 표시
 * - 다크모드 지원
 */

import React from 'react';

export type PaymentStep = 'package' | 'terms' | 'checkout' | 'complete';

interface PaymentStepIndicatorProps {
  currentStep: PaymentStep;
}

interface Step {
  id: PaymentStep;
  label: string;
  description: string;
}

const STEPS: Step[] = [
  {
    id: 'package',
    label: '패키지 선택',
    description: '충전할 칩 패키지를 선택하세요',
  },
  {
    id: 'terms',
    label: '약관 동의',
    description: '결제 약관 및 환불 정책에 동의하세요',
  },
  {
    id: 'checkout',
    label: '결제 정보',
    description: '결제 수단을 선택하고 정보를 입력하세요',
  },
  {
    id: 'complete',
    label: '완료',
    description: '결제가 완료되었습니다',
  },
];

const PaymentStepIndicator: React.FC<PaymentStepIndicatorProps> = ({ currentStep }) => {
  const currentStepIndex = STEPS.findIndex((step) => step.id === currentStep);

  // 단계를 찾지 못한 경우 첫 번째 단계로 기본 설정
  const validStepIndex = currentStepIndex === -1 ? 0 : currentStepIndex;
  const currentStepData: Step = STEPS[validStepIndex] || STEPS[0]!; // 안전한 폴백

  const getStepStatus = (stepIndex: number): 'completed' | 'current' | 'upcoming' => {
    if (stepIndex < validStepIndex) return 'completed';
    if (stepIndex === validStepIndex) return 'current';
    return 'upcoming';
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      {/* 모바일 뷰: 현재 단계만 표시 */}
      <div className="md:hidden">
        <div className="text-center mb-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            단계 {validStepIndex + 1} / {STEPS.length}
          </p>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {currentStepData.label}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {currentStepData.description}
          </p>
        </div>

        {/* 프로그레스 바 */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((validStepIndex + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* 데스크톱 뷰: 전체 단계 표시 */}
      <div className="hidden md:block">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const status = getStepStatus(index);
            const isLast = index === STEPS.length - 1;

            return (
              <React.Fragment key={step.id}>
                {/* 단계 아이템 */}
                <div className="flex flex-col items-center flex-1">
                  {/* 원형 아이콘 */}
                  <div
                    className={`
                      w-12 h-12 rounded-full flex items-center justify-center font-semibold text-lg mb-2 transition-all
                      ${
                        status === 'completed'
                          ? 'bg-blue-600 dark:bg-blue-500 text-white'
                          : status === 'current'
                            ? 'bg-blue-600 dark:bg-blue-500 text-white ring-4 ring-blue-200 dark:ring-blue-800'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                      }
                    `}
                  >
                    {status === 'completed' ? (
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </div>

                  {/* 라벨 */}
                  <p
                    className={`
                      text-sm font-medium text-center mb-1
                      ${
                        status === 'current'
                          ? 'text-blue-600 dark:text-blue-400'
                          : status === 'completed'
                            ? 'text-gray-900 dark:text-white'
                            : 'text-gray-500 dark:text-gray-400'
                      }
                    `}
                  >
                    {step.label}
                  </p>

                  {/* 설명 */}
                  <p className="text-xs text-gray-600 dark:text-gray-400 text-center max-w-[120px]">
                    {step.description}
                  </p>
                </div>

                {/* 연결선 */}
                {!isLast && (
                  <div className="flex-1 h-1 mx-2 mb-16">
                    <div
                      className={`
                        h-full transition-all
                        ${
                          status === 'completed'
                            ? 'bg-blue-600 dark:bg-blue-500'
                            : 'bg-gray-200 dark:bg-gray-700'
                        }
                      `}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PaymentStepIndicator;
