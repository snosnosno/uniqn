import React, { useState, useMemo } from 'react';
import { formatCurrency } from '../i18n-helpers';
import { calculateDailyPay, minutesToHours, calculateWorkMinutes } from '../utils/simplePayrollCalculator';
import { DEFAULT_HOURLY_RATES } from '../types/simplePayroll';

interface SimplePayrollCalculatorProps {
  defaultHourlyRate?: number;
  jobRole?: string;
  onCalculate?: (result: { hours: number; rate: number | undefined; pay: number }) => void;
}

const SimplePayrollCalculator: React.FC<SimplePayrollCalculatorProps> = ({
  defaultHourlyRate,
  jobRole = 'default',
  onCalculate,
}) => {
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  
  // DEFAULT_HOURLY_RATES가 undefined일 수 있으므로 안전한 처리
  const initialRate = defaultHourlyRate ?? 
    DEFAULT_HOURLY_RATES?.[jobRole] ?? 
    DEFAULT_HOURLY_RATES?.['default'] ?? 
    15000;
  
  const [hourlyRate, setHourlyRate] = useState<number>(initialRate);

  // 계산 결과
  const calculationResult = useMemo(() => {
    const workMinutes = calculateWorkMinutes(startTime, endTime);
    const workHours = minutesToHours(workMinutes);
    const rate = hourlyRate || DEFAULT_HOURLY_RATES?.['default'] || 15000;
    const dailyPay = calculateDailyPay(workHours, rate);
    
    const result = {
      minutes: workMinutes,
      hours: workHours,
      rate: rate,
      pay: dailyPay,
      weeklyPay: dailyPay * 5, // 주 5일 기준
      monthlyPay: dailyPay * 22, // 월 22일 기준
    };

    // 콜백 호출
    if (onCalculate) {
      onCalculate({ hours: workHours, rate: rate, pay: dailyPay });
    }

    return result;
  }, [startTime, endTime, hourlyRate, onCalculate]);

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900 mb-4">간단 급여 계산기</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* 출근 시간 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            출근 시간
          </label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* 퇴근 시간 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            퇴근 시간
          </label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* 시급 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            시급 (원)
          </label>
          <input
            type="number"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(Number(e.target.value))}
            min="0"
            step="1000"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* 계산 결과 */}
      <div className="border-t pt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">계산 결과</h4>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-xs text-gray-500">근무 시간</p>
            <p className="text-lg font-semibold text-gray-900">
              {calculationResult.hours.toFixed(2)}시간
            </p>
            <p className="text-xs text-gray-400">({calculationResult.minutes}분)</p>
          </div>

          <div className="bg-blue-50 p-3 rounded">
            <p className="text-xs text-gray-500">일급</p>
            <p className="text-lg font-semibold text-blue-600">
              {formatCurrency(calculationResult.pay, 'KRW', 'ko')}
            </p>
          </div>

          <div className="bg-green-50 p-3 rounded">
            <p className="text-xs text-gray-500">주급 (5일)</p>
            <p className="text-lg font-semibold text-green-600">
              {formatCurrency(calculationResult.weeklyPay, 'KRW', 'ko')}
            </p>
          </div>

          <div className="bg-purple-50 p-3 rounded">
            <p className="text-xs text-gray-500">월급 (22일)</p>
            <p className="text-lg font-semibold text-purple-600">
              {formatCurrency(calculationResult.monthlyPay, 'KRW', 'ko')}
            </p>
          </div>
        </div>
      </div>

      {/* 시급 참고 정보 */}
      <div className="mt-4 p-3 bg-gray-50 rounded text-xs text-gray-600">
        <p className="font-medium mb-1">직무별 기본 시급:</p>
        <div className="grid grid-cols-2 gap-1">
          {DEFAULT_HOURLY_RATES && Object.entries(DEFAULT_HOURLY_RATES)
            .filter(([role]) => role !== 'default')
            .map(([role, rate]) => (
              <span key={role}>
                {role}: {rate?.toLocaleString() ?? '0'}원
              </span>
            ))}
        </div>
      </div>
    </div>
  );
};

export default SimplePayrollCalculator;