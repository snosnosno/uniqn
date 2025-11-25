import React from 'react';
import { useTranslation } from 'react-i18next';
import { SparklesIcon, FireIcon, TrophyIcon } from '@heroicons/react/24/solid';
import { useTossPayment } from '../../hooks/useTossPayment';
import { getAllChipPackages } from '../../config/chipPricing';
import type { ChipPackage, ChipPackageId } from '../../types/payment';
import PaymentStepIndicator from '../payment/PaymentStepIndicator';

/**
 * 칩 충전 패키지 카드 컴포넌트
 */
interface ChipPackageCardProps {
  package: ChipPackage;
  onPurchase: (packageId: ChipPackageId) => void;
  isLoading: boolean;
}

const ChipPackageCard: React.FC<ChipPackageCardProps> = ({
  package: pkg,
  onPurchase,
  isLoading,
}) => {
  const { t } = useTranslation('payment');

  const getBadgeIcon = () => {
    if (pkg.isPopular) return <SparklesIcon className="h-5 w-5" />;
    if (pkg.isRecommended) return <TrophyIcon className="h-5 w-5" />;
    if (pkg.isBestValue) return <FireIcon className="h-5 w-5" />;
    return null;
  };

  const getBadgeColor = () => {
    if (pkg.isPopular) return 'bg-yellow-500 text-white';
    if (pkg.isRecommended) return 'bg-blue-600 text-white';
    if (pkg.isBestValue) return 'bg-red-600 text-white';
    return 'bg-gray-500 text-white';
  };

  const getBadgeLabel = () => {
    if (pkg.isPopular) return 'BEST';
    if (pkg.isRecommended) return 'RECOMMENDED';
    if (pkg.isBestValue) return 'BEST VALUE';
    return null;
  };

  return (
    <div
      className={`
        relative bg-white dark:bg-gray-800 rounded-lg shadow-md p-6
        border-2 transition-all duration-200 hover:shadow-lg
        ${pkg.isRecommended ? 'border-blue-500 dark:border-blue-400 scale-105' : 'border-gray-200 dark:border-gray-700'}
      `}
    >
      {/* 배지 */}
      {getBadgeLabel() && (
        <div className="absolute -top-3 -right-3">
          <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${getBadgeColor()}`}>
            {getBadgeIcon()}
            {getBadgeLabel()}
          </div>
        </div>
      )}

      {/* 패키지 정보 */}
      <div className="text-center">
        <div className="text-4xl mb-2">{pkg.badge}</div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {pkg.name}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {pkg.targetCustomer}
        </p>

        {/* 칩 개수 */}
        <div className="mb-4">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-3xl">🔴</span>
            <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {t('chipRecharge.package.chips', { amount: pkg.chipCount })}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {pkg.usageDuration}
          </p>
        </div>

        {/* 가격 */}
        <div className="mb-4">
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">
            {t('chipRecharge.package.price', { price: pkg.price.toLocaleString() })}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            ({pkg.pricePerChip.toLocaleString()}{t('common.currency.krw')}/칩)
          </div>
        </div>

        {/* 할인 정보 */}
        {pkg.discountRate > 0 && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-sm font-semibold text-green-700 dark:text-green-400 mb-1">
              💰 {t('chipRecharge.package.bonus', { bonus: pkg.discountRate })}
            </div>
            <div className="text-xs text-green-600 dark:text-green-500">
              {pkg.savings.toLocaleString()}{t('common.currency.krw')} 절약
            </div>
          </div>
        )}

        {/* 구매 버튼 */}
        <button
          onClick={() => onPurchase(pkg.id)}
          disabled={isLoading}
          className={`
            w-full py-3 px-4 rounded-md font-semibold transition-colors
            ${pkg.isRecommended
              ? 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white'
              : 'bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white'
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {isLoading ? t('common.loading') : t('chipRecharge.button.charge')}
        </button>
      </div>
    </div>
  );
};

/**
 * 칩 충전 패키지 목록 컴포넌트
 */
export const ChipRechargePackages: React.FC = () => {
  const { t } = useTranslation('payment');
  const { requestChipPayment, isLoading } = useTossPayment();
  const packages = getAllChipPackages();

  const handlePurchase = (packageId: ChipPackageId) => {
    requestChipPayment(packageId);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 단계 표시 */}
      <PaymentStepIndicator currentStep="package" />

      {/* 헤더 */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          🔴 {t('chipRecharge.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          {t('chipRecharge.selectPackage')}
        </p>
      </div>

      {/* 패키지 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
        {packages.map((pkg) => (
          <ChipPackageCard
            key={pkg.id}
            package={pkg}
            onPurchase={handlePurchase}
            isLoading={isLoading}
          />
        ))}
      </div>

      {/* 안내사항 */}
      <div className="mt-12 max-w-4xl mx-auto bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
          💡 안내사항
        </h3>
        <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
          <li>• 빨간칩은 구매일로부터 1년 후 자동 소멸됩니다.</li>
          <li>• 파란칩을 먼저 사용하고, 빨간칩을 나중에 사용합니다.</li>
          <li>• 구매 후 7일 이내 미사용 시 100% 환불 가능합니다.</li>
          <li>• 부분 사용 시 미사용분의 80% 환불 가능합니다 (수수료 20%).</li>
          <li>• 만료 30일 전부터 알림을 드립니다.</li>
        </ul>
      </div>
    </div>
  );
};
