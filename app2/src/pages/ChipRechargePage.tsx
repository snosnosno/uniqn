import React from 'react';
import { ChipRechargePackages } from '../components/chip';

/**
 * 칩 충전 페이지
 *
 * 경로: /chip/recharge
 */
const ChipRechargePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <ChipRechargePackages />
    </div>
  );
};

export default ChipRechargePage;
