/**
 * 결제 약관 동의 페이지
 *
 * 기능:
 * - 결제 약관 동의
 * - 환불 정책 동의
 * - 개인정보 수집 및 이용 동의
 */

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { logger } from '../../utils/logger';
import { toast } from '../../utils/toast';
import PaymentStepIndicator from '../../components/payment/PaymentStepIndicator';

interface TermsAgreement {
  paymentTerms: boolean;        // 결제 약관 (필수)
  refundPolicy: boolean;         // 환불 정책 (필수)
  privacyPolicy: boolean;        // 개인정보 처리 (필수)
  marketingConsent: boolean;     // 마케팅 수신 (선택)
}

const PaymentTermsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // 이전 페이지에서 전달된 패키지 정보
  const packageInfo = location.state?.packageInfo;

  const [agreement, setAgreement] = useState<TermsAgreement>({
    paymentTerms: false,
    refundPolicy: false,
    privacyPolicy: false,
    marketingConsent: false,
  });

  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // 전체 동의 체크
  const isAllRequiredAgreed =
    agreement.paymentTerms &&
    agreement.refundPolicy &&
    agreement.privacyPolicy;

  const handleAllAgree = () => {
    const newValue = !isAllRequiredAgreed;
    setAgreement({
      paymentTerms: newValue,
      refundPolicy: newValue,
      privacyPolicy: newValue,
      marketingConsent: newValue,
    });
  };

  const handleToggle = (key: keyof TermsAgreement) => {
    setAgreement((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleProceed = () => {
    if (!isAllRequiredAgreed) {
      toast.warning('필수 약관에 모두 동의해주세요.');
      return;
    }

    logger.info('PaymentTermsPage: 약관 동의 완료');

    // 결제 페이지로 이동
    navigate('/payment/checkout', {
      state: {
        packageInfo,
        termsAgreement: agreement,
      },
    });
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      {/* 단계 표시 */}
      <PaymentStepIndicator currentStep="terms" />

      <div className="max-w-3xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            약관 동의
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            결제를 진행하기 위해 아래 약관에 동의해주세요.
          </p>
        </div>

        {/* 전체 동의 */}
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isAllRequiredAgreed && agreement.marketingConsent}
              onChange={handleAllAgree}
              className="w-5 h-5 text-blue-600 dark:text-blue-500 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
            <span className="ml-3 text-lg font-semibold text-gray-900 dark:text-white">
              전체 동의
            </span>
          </label>
          <p className="mt-2 ml-8 text-sm text-gray-600 dark:text-gray-400">
            필수 및 선택 항목 모두 동의합니다.
          </p>
        </div>

        {/* 개별 약관 */}
        <div className="space-y-4">
          {/* 1. 결제 약관 (필수) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <label className="flex items-center cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={agreement.paymentTerms}
                    onChange={() => handleToggle('paymentTerms')}
                    className="w-5 h-5 text-blue-600 dark:text-blue-500 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                  <span className="ml-3 text-gray-900 dark:text-white font-medium">
                    [필수] 결제 서비스 이용약관
                  </span>
                </label>
                <button
                  onClick={() => toggleSection('paymentTerms')}
                  className="ml-4 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm"
                >
                  {expandedSection === 'paymentTerms' ? '접기' : '내용 보기'}
                </button>
              </div>

              {expandedSection === 'paymentTerms' && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded text-sm text-gray-700 dark:text-gray-300 max-h-60 overflow-y-auto">
                  <h3 className="font-semibold mb-2">제1조 (목적)</h3>
                  <p className="mb-4">
                    본 약관은 T-HOLDEM(이하 "회사")이 제공하는 칩 충전 서비스(이하 "서비스")의 이용과 관련하여
                    회사와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.
                  </p>

                  <h3 className="font-semibold mb-2">제2조 (결제 방법)</h3>
                  <p className="mb-4">
                    1. 회사는 토스페이먼츠를 통한 안전한 결제 시스템을 제공합니다.<br />
                    2. 이용자는 신용카드, 계좌이체 등 다양한 결제 수단을 선택할 수 있습니다.<br />
                    3. 결제 완료 시 구매한 칩은 즉시 지급됩니다.
                  </p>

                  <h3 className="font-semibold mb-2">제3조 (칩 유효기간)</h3>
                  <p className="mb-4">
                    1. 빨간칩(충전칩): 구매일로부터 1년<br />
                    2. 파란칩(구독칩): 발급월 말일까지<br />
                    3. 유효기간 만료 시 자동 소멸되며 별도 보상은 제공하지 않습니다.
                  </p>

                  <h3 className="font-semibold mb-2">제4조 (부정 사용 금지)</h3>
                  <p>
                    이용자는 다음 행위를 할 수 없습니다:<br />
                    1. 타인 명의 도용<br />
                    2. 허위 정보 입력<br />
                    3. 결제 시스템 악용<br />
                    4. 기타 불법적인 행위
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 2. 환불 정책 (필수) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <label className="flex items-center cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={agreement.refundPolicy}
                    onChange={() => handleToggle('refundPolicy')}
                    className="w-5 h-5 text-blue-600 dark:text-blue-500 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                  <span className="ml-3 text-gray-900 dark:text-white font-medium">
                    [필수] 환불 정책
                  </span>
                </label>
                <button
                  onClick={() => toggleSection('refundPolicy')}
                  className="ml-4 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm"
                >
                  {expandedSection === 'refundPolicy' ? '접기' : '내용 보기'}
                </button>
              </div>

              {expandedSection === 'refundPolicy' && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded text-sm text-gray-700 dark:text-gray-300 max-h-60 overflow-y-auto">
                  <h3 className="font-semibold mb-2">제1조 (환불 가능 기간)</h3>
                  <p className="mb-4">
                    결제일로부터 7일 이내에 환불을 요청할 수 있습니다.
                  </p>

                  <h3 className="font-semibold mb-2">제2조 (환불 수수료)</h3>
                  <p className="mb-4">
                    1. 미사용 시: 수수료 없음 (100% 환불)<br />
                    2. 부분 사용 시: 20% 수수료 차감<br />
                    3. 환불 금액 = (잔여 칩 / 총 칩) × 결제 금액 × 0.8
                  </p>

                  <h3 className="font-semibold mb-2">제3조 (환불 제한)</h3>
                  <p className="mb-4">
                    1. 월 1회, 연 3회로 환불 횟수가 제한됩니다.<br />
                    2. 환불 악용 시 블랙리스트 등록 및 환불이 영구 제한될 수 있습니다.<br />
                    3. 7일 경과 후에는 환불이 불가능합니다.
                  </p>

                  <h3 className="font-semibold mb-2">제4조 (환불 처리)</h3>
                  <p>
                    1. 환불 요청 후 관리자 승인을 거쳐 처리됩니다.<br />
                    2. 승인 시 3~5 영업일 이내 환불 처리됩니다.<br />
                    3. 환불 금액은 원 결제 수단으로 환불됩니다.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 3. 개인정보 처리 (필수) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <label className="flex items-center cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={agreement.privacyPolicy}
                    onChange={() => handleToggle('privacyPolicy')}
                    className="w-5 h-5 text-blue-600 dark:text-blue-500 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                  <span className="ml-3 text-gray-900 dark:text-white font-medium">
                    [필수] 개인정보 수집 및 이용
                  </span>
                </label>
                <button
                  onClick={() => toggleSection('privacyPolicy')}
                  className="ml-4 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm"
                >
                  {expandedSection === 'privacyPolicy' ? '접기' : '내용 보기'}
                </button>
              </div>

              {expandedSection === 'privacyPolicy' && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded text-sm text-gray-700 dark:text-gray-300 max-h-60 overflow-y-auto">
                  <h3 className="font-semibold mb-2">수집하는 개인정보 항목</h3>
                  <p className="mb-4">
                    - 필수: 이름, 이메일, 결제 정보<br />
                    - 자동 수집: IP 주소, 쿠키, 서비스 이용 기록
                  </p>

                  <h3 className="font-semibold mb-2">개인정보의 수집 및 이용 목적</h3>
                  <p className="mb-4">
                    1. 결제 처리 및 서비스 제공<br />
                    2. 본인 확인 및 부정 사용 방지<br />
                    3. 고객 문의 응대<br />
                    4. 통계 분석 및 서비스 개선
                  </p>

                  <h3 className="font-semibold mb-2">개인정보의 보유 및 이용 기간</h3>
                  <p>
                    1. 회원 탈퇴 시까지 (단, 관련 법령에 따라 일정 기간 보관)<br />
                    2. 전자상거래법: 5년 (계약 및 청약철회 기록)<br />
                    3. 소비자 불만 기록: 3년
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 4. 마케팅 수신 동의 (선택) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <label className="flex items-center cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={agreement.marketingConsent}
                    onChange={() => handleToggle('marketingConsent')}
                    className="w-5 h-5 text-blue-600 dark:text-blue-500 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                  <span className="ml-3 text-gray-900 dark:text-white font-medium">
                    [선택] 마케팅 정보 수신 동의
                  </span>
                </label>
              </div>
              <p className="mt-2 ml-8 text-sm text-gray-600 dark:text-gray-400">
                이벤트, 프로모션, 신규 서비스 등의 마케팅 정보를 이메일로 받습니다.
              </p>
            </div>
          </div>
        </div>

        {/* 버튼 */}
        <div className="mt-8 flex space-x-4">
          <button
            onClick={() => navigate(-1)}
            className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
          >
            이전
          </button>
          <button
            onClick={handleProceed}
            disabled={!isAllRequiredAgreed}
            className={`flex-1 px-6 py-3 rounded-lg font-medium ${
              isAllRequiredAgreed
                ? 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
          >
            다음 단계
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentTermsPage;
