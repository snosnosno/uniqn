import React from 'react';
import { ChipPackage } from '../../types/payment/package';
import { CheckIcon } from '@heroicons/react/24/solid';

interface ChipPackageCardProps {
  package: ChipPackage;
  selected?: boolean;
  onSelect: (packageId: string) => void;
}

/**
 * 칩 패키지 카드 컴포넌트
 *
 * 기능:
 * - 패키지 정보 표시 (가격, 칩 개수, 할인율)
 * - 인기/추천/최대할인 배지
 * - 선택 상태 표시
 * - 다크모드 지원
 */
export const ChipPackageCard: React.FC<ChipPackageCardProps> = ({
  package: pkg,
  selected = false,
  onSelect,
}) => {
  const handleClick = () => {
    onSelect(pkg.id);
  };

  // 배지 스타일
  const getBadgeStyle = () => {
    if (pkg.isPopular) {
      return 'bg-blue-500 dark:bg-blue-600 text-white';
    }
    if (pkg.isRecommended) {
      return 'bg-purple-500 dark:bg-purple-600 text-white';
    }
    if (pkg.isBestValue) {
      return 'bg-red-500 dark:bg-red-600 text-white';
    }
    return 'bg-gray-500 dark:bg-gray-600 text-white';
  };

  // 카드 테두리 스타일
  const getBorderStyle = () => {
    if (selected) {
      return 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-500 dark:ring-blue-400';
    }
    if (pkg.isRecommended) {
      return 'border-purple-300 dark:border-purple-700';
    }
    return 'border-gray-200 dark:border-gray-700';
  };

  return (
    <div
      onClick={handleClick}
      className={`
        relative cursor-pointer rounded-xl border-2 p-6 transition-all
        bg-white dark:bg-gray-800
        hover:shadow-lg dark:hover:shadow-gray-900/50
        ${getBorderStyle()}
      `}
    >
      {/* 선택 체크마크 */}
      {selected && (
        <div className="absolute top-4 right-4">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 dark:bg-blue-600">
            <CheckIcon className="h-4 w-4 text-white" />
          </div>
        </div>
      )}

      {/* 배지 */}
      {(pkg.isPopular || pkg.isRecommended || pkg.isBestValue) && (
        <div className="mb-4">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${getBadgeStyle()}`}
          >
            {pkg.badge} {pkg.isPopular && '인기'}
            {pkg.isRecommended && '추천'}
            {pkg.isBestValue && '최대 할인'}
          </span>
        </div>
      )}

      {/* 패키지 이름 */}
      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{pkg.name}</h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{pkg.nameEn}</p>

      {/* 가격 */}
      <div className="mt-4">
        <div className="flex items-baseline">
          <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {pkg.price.toLocaleString()}
          </span>
          <span className="ml-1 text-lg text-gray-600 dark:text-gray-400">원</span>
        </div>

        {/* 할인율 */}
        {pkg.discountRate > 0 && (
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm font-medium text-red-600 dark:text-red-400">
              {pkg.discountRate}% 할인
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {pkg.savings.toLocaleString()}원 절약
            </span>
          </div>
        )}
      </div>

      {/* 칩 개수 */}
      <div className="mt-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">칩 개수</span>
          <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {pkg.chipCount}개
          </span>
        </div>
        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
          칩당 {pkg.pricePerChip.toLocaleString()}원
        </div>
      </div>

      {/* 타겟 고객 */}
      <div className="mt-4 space-y-2">
        <div className="flex items-start">
          <CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500 dark:text-green-400" />
          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
            {pkg.targetCustomer}
          </span>
        </div>
        <div className="flex items-start">
          <CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500 dark:text-green-400" />
          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{pkg.usageDuration}</span>
        </div>
        <div className="flex items-start">
          <CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500 dark:text-green-400" />
          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">1년간 사용 가능</span>
        </div>
      </div>

      {/* 선택 버튼 */}
      <button
        onClick={handleClick}
        className={`
          mt-6 w-full rounded-lg px-4 py-3 text-sm font-semibold
          transition-colors
          ${
            selected
              ? 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600'
          }
        `}
      >
        {selected ? '선택됨 ✓' : '선택하기'}
      </button>
    </div>
  );
};
