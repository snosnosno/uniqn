import React, { useState, useCallback, useEffect } from 'react';
import { JobPosting } from '../../types/jobPosting';

interface TaxSettingsPanelProps {
  jobPosting: JobPosting | null;
  onUpdate: (taxSettings: NonNullable<JobPosting['taxSettings']>) => Promise<void>;
}

const TaxSettingsPanel: React.FC<TaxSettingsPanelProps> = ({ jobPosting, onUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [taxType, setTaxType] = useState<'rate' | 'amount'>('rate');
  const [taxRate, setTaxRate] = useState<number>(3.3);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  // jobPosting에서 초기값 로드
  useEffect(() => {
    if (jobPosting?.taxSettings) {
      setEnabled(jobPosting.taxSettings.enabled || false);

      if (jobPosting.taxSettings.taxRate !== undefined && jobPosting.taxSettings.taxRate > 0) {
        setTaxType('rate');
        setTaxRate(jobPosting.taxSettings.taxRate);
      } else if (jobPosting.taxSettings.taxAmount !== undefined && jobPosting.taxSettings.taxAmount > 0) {
        setTaxType('amount');
        setTaxAmount(jobPosting.taxSettings.taxAmount);
      }
    }
  }, [jobPosting]);

  const handleSave = useCallback(async () => {
    if (!enabled) {
      // 세금 비활성화
      await onUpdate({
        enabled: false
      });
      return;
    }

    setIsSaving(true);
    try {
      const taxSettings: NonNullable<JobPosting['taxSettings']> = {
        enabled: true,
        ...(taxType === 'rate' ? { taxRate } : { taxAmount })
      };

      await onUpdate(taxSettings);
    } finally {
      setIsSaving(false);
    }
  }, [enabled, taxType, taxRate, taxAmount, onUpdate]);

  // 요약 정보 생성
  const getSummary = useCallback(() => {
    if (!enabled) return '비활성화';
    return taxType === 'rate'
      ? `세율: ${taxRate}%`
      : `고정 세금: ${taxAmount.toLocaleString()}원`;
  }, [enabled, taxType, taxRate, taxAmount]);

  return (
    <div className="bg-white rounded-lg shadow">
      {/* 헤더 (클릭 가능) */}
      <div className="px-6 py-4 border-b border-gray-200">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-medium text-gray-900">💸 세금 설정</h3>
            {enabled && (
              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                활성화됨
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isExpanded && (
              <span className="text-sm text-gray-500">
                {getSummary()}
              </span>
            )}
            <svg
              className={`w-5 h-5 transform transition-transform ${
                isExpanded ? 'rotate-180' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m19 9-7 7-7-7" />
            </svg>
          </div>
        </button>
      </div>

      {/* 내용 (접기/펼치기) */}
      {isExpanded && (
        <div className="p-6">
          <div className="space-y-4">
            {/* 세금 적용 토글 */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">세금 적용</span>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">{enabled ? '활성화' : '비활성화'}</span>
              </label>
            </div>

            {enabled && (
              <>
                {/* 세금 유형 선택 */}
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="rate"
                      checked={taxType === 'rate'}
                      onChange={(e) => setTaxType(e.target.value as 'rate' | 'amount')}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    />
                    <span className="text-sm text-gray-700">세율 (%)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="amount"
                      checked={taxType === 'amount'}
                      onChange={(e) => setTaxType(e.target.value as 'rate' | 'amount')}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    />
                    <span className="text-sm text-gray-700">고정 세금 (원)</span>
                  </label>
                </div>

                {/* 세율 입력 */}
                {taxType === 'rate' && (
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-gray-700 w-24">세율:</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={taxRate}
                        onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                        min="0"
                        max="100"
                        step="0.1"
                        className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <span className="text-sm text-gray-500">%</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      (예: 3.3% = 원천징수세)
                    </span>
                  </div>
                )}

                {/* 고정 세금 입력 */}
                {taxType === 'amount' && (
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-gray-700 w-24">고정 세금:</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={taxAmount}
                        onChange={(e) => setTaxAmount(parseInt(e.target.value) || 0)}
                        min="0"
                        step="1000"
                        className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <span className="text-sm text-gray-500">원</span>
                    </div>
                  </div>
                )}
              </>
            )}

            {!enabled && (
              <div className="text-center py-4 text-gray-500 text-sm">
                세금 적용이 비활성화되어 있습니다.
              </div>
            )}

            {/* 저장 버튼 */}
            <div className="flex justify-end pt-4 border-t">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:bg-gray-400"
              >
                {isSaving ? '저장 중...' : '세금 설정 저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaxSettingsPanel;
