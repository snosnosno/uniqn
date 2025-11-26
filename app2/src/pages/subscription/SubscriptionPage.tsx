/**
 * 구독 플랜 페이지 (개선 버전)
 *
 * 기능:
 * - 3개 플랜 비교 (Free, Standard, Pro)
 * - 현재 플랜 실시간 표시 (useActiveSubscription)
 * - 플랜 변경/업그레이드
 * - 다크모드 지원
 * - 다국어 지원 (i18n)
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckIcon } from '@heroicons/react/24/solid';
import { useAuth } from '../../contexts/AuthContext';
import { useActiveSubscription } from '../../hooks/useActiveSubscription';
import { useToast } from '../../hooks/useToast';
import type { SubscriptionPlanType } from '../../types/payment/subscription';
import { SUBSCRIPTION_PLANS } from '../../types/payment/subscription';

interface PlanCardProps {
  planType: SubscriptionPlanType;
  isCurrentPlan: boolean;
  onSelect: (planType: SubscriptionPlanType) => void;
}

const PlanCard: React.FC<PlanCardProps> = ({ planType, isCurrentPlan, onSelect }) => {
  const plan = SUBSCRIPTION_PLANS[planType];
  const isPopular = planType === 'standard';

  return (
    <div
      className={`
        relative bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border-2 transition-all
        ${isPopular ? 'border-blue-500 dark:border-blue-400 scale-105' : 'border-gray-200 dark:border-gray-700'}
        ${isCurrentPlan ? 'ring-2 ring-green-500 dark:ring-green-400' : ''}
      `}
    >
      {/* 인기 배지 */}
      {isPopular && (
        <div className="absolute -top-3 -right-3">
          <div className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-blue-600 dark:bg-blue-500 text-white">
            ⭐ POPULAR
          </div>
        </div>
      )}

      {/* 현재 플랜 배지 */}
      {isCurrentPlan && (
        <div className="absolute -top-3 -left-3">
          <div className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-green-600 dark:bg-green-500 text-white">
            ✓ 현재 플랜
          </div>
        </div>
      )}

      {/* 플랜 정보 */}
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{plan.name}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{plan.description}</p>

        {/* 가격 */}
        <div className="mb-4">
          <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
            {plan.price === 0 ? '무료' : `${plan.price.toLocaleString()}원`}
          </div>
          {plan.price > 0 && (
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">/ 월</div>
          )}
        </div>

        {/* 파란칩 개수 */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl">🔵</span>
            <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {plan.monthlyChips}칩
            </span>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">매월 자동 지급</p>
        </div>
      </div>

      {/* 기능 목록 */}
      <div className="space-y-3 mb-6">
        {plan.features.map((feature, index) => (
          <div key={index} className="flex items-start gap-2">
            <CheckIcon className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
          </div>
        ))}
      </div>

      {/* 선택 버튼 */}
      <button
        onClick={() => onSelect(planType)}
        disabled={isCurrentPlan}
        className={`
          w-full py-3 px-4 rounded-md font-semibold transition-colors
          ${
            isCurrentPlan
              ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              : isPopular
                ? 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white'
                : 'bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white'
          }
        `}
      >
        {isCurrentPlan ? '현재 플랜' : plan.price === 0 ? '무료 시작' : '구독하기'}
      </button>
    </div>
  );
};

const SubscriptionPage: React.FC = () => {
  const { t } = useTranslation('payment');
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  // 실시간 활성 구독 조회
  const { subscription: currentSubscription, isLoading } = useActiveSubscription(
    currentUser?.uid || null
  );

  const handleSelectPlan = (planType: SubscriptionPlanType) => {
    const plan = SUBSCRIPTION_PLANS[planType];

    if (plan.price === 0) {
      // Free 플랜은 즉시 적용 (다운그레이드)
      toast.showInfo('무료 플랜으로 변경하려면 현재 구독을 취소해주세요.');
      return;
    }

    // 결제 페이지로 이동 (구독 결제)
    navigate('/subscription/checkout', {
      state: {
        planType,
        planName: plan.name,
        price: plan.price,
        monthlyChips: plan.monthlyChips,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 dark:border-blue-400" />
      </div>
    );
  }

  const currentPlanType: SubscriptionPlanType = currentSubscription?.planType || 'free';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">구독 플랜 선택</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            매월 자동으로 파란칩이 지급됩니다. <br />
            지급된 파란칩은 다음 달 1일까지 사용할 수 있습니다.
          </p>
        </div>

        {/* 플랜 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <PlanCard
            planType="free"
            isCurrentPlan={currentPlanType === 'free'}
            onSelect={handleSelectPlan}
          />
          <PlanCard
            planType="standard"
            isCurrentPlan={currentPlanType === 'standard'}
            onSelect={handleSelectPlan}
          />
          <PlanCard
            planType="pro"
            isCurrentPlan={currentPlanType === 'pro'}
            onSelect={handleSelectPlan}
          />
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
            자주 묻는 질문
          </h2>
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                파란칩은 언제 지급되나요?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                구독 결제 완료 즉시 첫 달 파란칩이 지급됩니다. 이후 매월 1일 자동으로 지급됩니다.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                파란칩 유효기간은 얼마나 되나요?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                파란칩은 발급월 말일까지 사용할 수 있습니다. 예를 들어 1월에 지급된 칩은 1월
                31일까지 사용 가능합니다.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                구독을 취소하면 어떻게 되나요?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                구독 취소 시 현재 결제 기간이 만료될 때까지는 서비스를 계속 이용할 수 있습니다. 남은
                파란칩도 유효기간까지 사용 가능합니다.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                플랜을 변경할 수 있나요?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                언제든지 플랜을 업그레이드하거나 다운그레이드할 수 있습니다. 업그레이드 시 즉시
                적용되며, 다운그레이드 시 다음 결제 기간부터 적용됩니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPage;
