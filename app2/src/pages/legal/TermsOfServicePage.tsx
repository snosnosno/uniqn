/**
 * 이용약관 페이지
 *
 * @description
 * UNIQN 서비스 이용약관을 표시하는 페이지
 * - 정적 콘텐츠 표시
 * - 버전 정보 포함
 * - 인쇄 가능한 레이아웃
 * - i18n 지원 (한국어/영어)
 *
 * @version 1.0.0
 * @since 2025-10-23
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, PrinterIcon } from '@heroicons/react/24/outline';

/**
 * 이용약관 페이지 컴포넌트
 */
const TermsOfServicePage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const currentLanguage = i18n.language;

  /**
   * 뒤로 가기
   */
  const handleGoBack = () => {
    navigate(-1);
  };

  /**
   * 인쇄하기
   */
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 (인쇄 시 숨김) */}
      <div className="bg-white border-b sticky top-0 z-10 print:hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={handleGoBack}
                className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label={t('common.back')}
              >
                <ArrowLeftIcon className="h-6 w-6" />
              </button>
              <h1 className="text-xl font-semibold">
                {t('legal.termsOfService.title')}
              </h1>
            </div>
            <button
              onClick={handlePrint}
              className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label={t('common.print')}
            >
              <PrinterIcon className="h-5 w-5" />
              <span>{t('common.print')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm p-8 print:shadow-none">
          {/* 헤더 정보 */}
          <div className="border-b pb-6 mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              {t('legal.termsOfService.title')}
            </h1>
            <div className="mt-4 flex items-center space-x-4 text-sm text-gray-600">
              <span>
                {t('legal.version')}: 1.0.0
              </span>
              <span>•</span>
              <span>
                {t('legal.effectiveDate')}: 2025-01-01
              </span>
              <span>•</span>
              <span>
                {t('legal.lastUpdated')}: 2025-01-01
              </span>
            </div>
          </div>

          {/* 콘텐츠 */}
          <div className="prose prose-gray max-w-none">
            {currentLanguage === 'ko' ? (
              <>
                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">제1조 (목적)</h2>
                  <p className="text-gray-700 leading-relaxed">
                    본 약관은 UNIQN(이하 "회사"라 합니다)이 제공하는 토너먼트 운영 플랫폼 서비스(이하 "서비스"라 합니다)의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">제2조 (정의)</h2>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700">
                    <li>
                      "서비스"란 회사가 제공하는 토너먼트 관리, 스태프 관리, 구인구직, 급여 정산 등의 온라인 플랫폼 서비스를 의미합니다.
                    </li>
                    <li>
                      "이용자"란 본 약관에 따라 회사가 제공하는 서비스를 이용하는 회원 및 비회원을 의미합니다.
                    </li>
                    <li>
                      "회원"이란 서비스에 개인정보를 제공하여 회원등록을 한 자로서, 회사의 정보를 지속적으로 제공받으며 서비스를 계속적으로 이용할 수 있는 자를 의미합니다.
                    </li>
                    <li>
                      "비회원"이란 회원가입 없이 회사가 제공하는 서비스를 이용하는 자를 의미합니다.
                    </li>
                  </ol>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">제3조 (약관의 효력 및 변경)</h2>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700">
                    <li>
                      본 약관은 서비스 화면에 게시하거나 기타의 방법으로 회원에게 공지함으로써 효력이 발생합니다.
                    </li>
                    <li>
                      회사는 필요한 경우 관련 법령을 위배하지 않는 범위에서 본 약관을 변경할 수 있으며, 약관을 변경할 경우에는 적용일자 및 변경사유를 명시하여 현행약관과 함께 서비스 초기화면에 그 적용일자 7일 이전부터 공지합니다.
                    </li>
                    <li>
                      이용자가 변경된 약관에 동의하지 않는 경우, 서비스 이용을 중단하고 탈퇴할 수 있습니다. 변경된 약관의 효력 발생일 이후에도 서비스를 계속 이용하는 경우에는 약관 변경에 동의한 것으로 간주됩니다.
                    </li>
                  </ol>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">제4조 (회원가입)</h2>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700">
                    <li>
                      이용자는 회사가 정한 가입 양식에 따라 회원정보를 기입한 후 본 약관과 개인정보처리방침에 동의한다는 의사표시를 함으로써 회원가입을 신청합니다.
                    </li>
                    <li>
                      회사는 제1항과 같이 회원으로 가입할 것을 신청한 이용자 중 다음 각 호에 해당하지 않는 한 회원으로 등록합니다:
                      <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                        <li>가입신청자가 본 약관에 의하여 이전에 회원자격을 상실한 적이 있는 경우</li>
                        <li>실명이 아니거나 타인의 명의를 이용한 경우</li>
                        <li>허위의 정보를 기재하거나 회사가 제시하는 내용을 기재하지 않은 경우</li>
                        <li>만 14세 미만 아동이 법정대리인의 동의를 얻지 아니한 경우</li>
                      </ul>
                    </li>
                    <li>
                      회원가입의 성립시기는 회사의 승낙이 회원에게 도달한 시점으로 합니다.
                    </li>
                  </ol>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">제5조 (회원정보의 변경)</h2>
                  <p className="text-gray-700 leading-relaxed">
                    회원은 개인정보관리화면을 통하여 언제든지 본인의 개인정보를 열람하고 수정할 수 있습니다. 회원은 회원가입신청 시 기재한 사항이 변경되었을 경우 온라인으로 수정을 하거나 기타 방법으로 회사에 대하여 그 변경사항을 알려야 합니다.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">제6조 (서비스의 제공)</h2>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700">
                    <li>
                      회사는 다음과 같은 서비스를 제공합니다:
                      <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                        <li>토너먼트 운영 관리</li>
                        <li>스태프 및 참가자 관리</li>
                        <li>구인구직 매칭 서비스</li>
                        <li>근무 기록 및 급여 정산 시스템</li>
                        <li>실시간 출석 추적</li>
                        <li>기타 회사가 추가 개발하거나 제휴계약 등을 통해 제공하는 일체의 서비스</li>
                      </ul>
                    </li>
                    <li>
                      서비스는 연중무휴, 1일 24시간 제공함을 원칙으로 합니다. 단, 회사는 시스템 정기점검, 서버의 증설 및 교체, 네트워크의 불안정 등의 사유로 서비스 제공을 일시적으로 중단할 수 있습니다.
                    </li>
                  </ol>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">제7조 (서비스의 변경 및 중지)</h2>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700">
                    <li>
                      회사는 상당한 이유가 있는 경우에 운영상, 기술상의 필요에 따라 제공하고 있는 전부 또는 일부 서비스를 변경할 수 있습니다.
                    </li>
                    <li>
                      서비스의 내용, 이용방법, 이용시간에 대하여 변경이 있는 경우에는 변경사유, 변경될 서비스의 내용 및 제공일자 등을 그 변경 전 7일 이상 해당 서비스 초기화면에 게시합니다.
                    </li>
                  </ol>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">제8조 (회원탈퇴 및 자격상실)</h2>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700">
                    <li>
                      회원은 언제든지 서비스 내 계정관리 메뉴를 통하여 이용계약 해지 신청을 할 수 있으며, 회사는 관련법 등이 정하는 바에 따라 이를 즉시 처리하여야 합니다.
                    </li>
                    <li>
                      회원이 계약을 해지할 경우, 관련법 및 개인정보처리방침에 따라 회사가 회원정보를 보유하는 경우를 제외하고는 해지 즉시 회원의 모든 데이터는 소멸됩니다.
                    </li>
                    <li>
                      회사는 회원이 다음 각 호의 사유에 해당하는 경우, 회원자격을 제한 또는 정지시킬 수 있습니다:
                      <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                        <li>가입 신청 시에 허위 내용을 등록한 경우</li>
                        <li>다른 사람의 서비스 이용을 방해하거나 그 정보를 도용하는 등 전자상거래 질서를 위협하는 경우</li>
                        <li>서비스를 이용하여 법령 또는 본 약관이 금지하거나 공서양속에 반하는 행위를 하는 경우</li>
                      </ul>
                    </li>
                  </ol>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">제9조 (개인정보보호)</h2>
                  <p className="text-gray-700 leading-relaxed">
                    회사는 관계법령이 정하는 바에 따라 회원의 개인정보를 보호하기 위해 노력합니다. 개인정보의 보호 및 사용에 대해서는 관련법 및 회사의 개인정보처리방침이 적용됩니다. 다만, 회사의 공식 사이트 이외의 링크된 사이트에서는 회사의 개인정보처리방침이 적용되지 않습니다.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">제10조 (책임제한)</h2>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700">
                    <li>
                      회사는 천재지변 또는 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는 서비스 제공에 관한 책임이 면제됩니다.
                    </li>
                    <li>
                      회사는 회원의 귀책사유로 인한 서비스 이용의 장애에 대하여는 책임을 지지 않습니다.
                    </li>
                    <li>
                      회사는 회원이 서비스를 이용하여 기대하는 수익을 상실한 것에 대하여 책임을 지지 않으며, 그 밖에 서비스를 통하여 얻은 자료로 인한 손해 등에 대하여도 책임을 지지 않습니다.
                    </li>
                  </ol>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">제11조 (준거법 및 재판관할)</h2>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700">
                    <li>
                      본 약관의 해석 및 회사와 이용자 간의 분쟁에 대하여는 대한민국의 법을 적용합니다.
                    </li>
                    <li>
                      서비스 이용으로 발생한 분쟁에 대해 소송이 제기되는 경우 회사의 본사 소재지를 관할하는 법원을 관할 법원으로 합니다.
                    </li>
                  </ol>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">부칙</h2>
                  <p className="text-gray-700 leading-relaxed">
                    본 약관은 2025년 1월 1일부터 시행됩니다.
                  </p>
                </section>
              </>
            ) : (
              <>
                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">Article 1 (Purpose)</h2>
                  <p className="text-gray-700 leading-relaxed">
                    These Terms of Service (hereinafter referred to as "Terms") are intended to define the rights, obligations, responsibilities, and other necessary matters between UNIQN (hereinafter referred to as "Company") and users regarding the use of the poker tournament management platform service (hereinafter referred to as "Service") provided by the Company.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">Article 2 (Definitions)</h2>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700">
                    <li>
                      "Service" means the online platform service provided by the Company, including poker tournament management, staff management, recruitment, payroll settlement, etc.
                    </li>
                    <li>
                      "User" means both members and non-members who use the Service provided by the Company in accordance with these Terms.
                    </li>
                    <li>
                      "Member" means a person who has registered as a member by providing personal information to the Service and can continuously receive information from the Company and use the Service.
                    </li>
                    <li>
                      "Non-member" means a person who uses the Service provided by the Company without membership registration.
                    </li>
                  </ol>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">Article 3 (Effect and Amendment of Terms)</h2>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700">
                    <li>
                      These Terms shall take effect by being posted on the Service screen or notified to members by other means.
                    </li>
                    <li>
                      The Company may amend these Terms within the scope that does not violate relevant laws when necessary. When amending the Terms, the Company shall specify the effective date and reasons for amendment and post them on the Service's initial screen along with the current Terms at least 7 days prior to the effective date.
                    </li>
                    <li>
                      If a user does not agree to the amended Terms, they may discontinue using the Service and withdraw. If the user continues to use the Service after the effective date of the amended Terms, it shall be deemed that the user has agreed to the amendment.
                    </li>
                  </ol>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">Article 4 (Membership Registration)</h2>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700">
                    <li>
                      Users apply for membership registration by filling in member information according to the registration form set by the Company and expressing their intention to agree to these Terms and the Privacy Policy.
                    </li>
                    <li>
                      The Company shall register as a member any user who has applied for membership registration as described in Paragraph 1, unless any of the following applies:
                      <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                        <li>The applicant has previously lost member status under these Terms</li>
                        <li>Not using a real name or using another person's name</li>
                        <li>Providing false information or not filling in the information requested by the Company</li>
                        <li>A child under 14 years of age has not obtained consent from a legal representative</li>
                      </ul>
                    </li>
                    <li>
                      Membership registration shall be established when the Company's acceptance reaches the member.
                    </li>
                  </ol>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">Article 5 (Change of Member Information)</h2>
                  <p className="text-gray-700 leading-relaxed">
                    Members may view and modify their personal information at any time through the personal information management screen. Members must inform the Company of any changes to the information provided during membership registration by making online modifications or through other means.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">Article 6 (Provision of Service)</h2>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700">
                    <li>
                      The Company provides the following services:
                      <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                        <li>Poker tournament management</li>
                        <li>Staff and participant management</li>
                        <li>Job matching service</li>
                        <li>Work record and payroll settlement system</li>
                        <li>Real-time attendance tracking</li>
                        <li>Other services additionally developed by the Company or provided through partnership agreements</li>
                      </ul>
                    </li>
                    <li>
                      The Service shall be provided 24 hours a day, 365 days a year in principle. However, the Company may temporarily suspend the provision of Service due to reasons such as regular system maintenance, server expansion and replacement, and network instability.
                    </li>
                  </ol>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">Article 7 (Change and Suspension of Service)</h2>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700">
                    <li>
                      The Company may change all or part of the Service it provides for operational or technical needs if there are reasonable grounds.
                    </li>
                    <li>
                      If there are changes to the content, usage method, or usage time of the Service, the reasons for the change, the content of the Service to be changed, and the provision date shall be posted on the initial screen of the Service at least 7 days before the change.
                    </li>
                  </ol>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">Article 8 (Member Withdrawal and Disqualification)</h2>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700">
                    <li>
                      Members may apply for termination of the service agreement at any time through the account management menu in the Service, and the Company must process it immediately in accordance with relevant laws.
                    </li>
                    <li>
                      When a member terminates the contract, all data of the member shall be destroyed immediately upon termination, except in cases where the Company retains member information in accordance with relevant laws and the Privacy Policy.
                    </li>
                    <li>
                      The Company may restrict or suspend membership if a member falls under any of the following:
                      <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                        <li>Registering false information during membership application</li>
                        <li>Interfering with other people's use of the Service or stealing their information, thereby threatening e-commerce order</li>
                        <li>Using the Service to engage in acts prohibited by laws or these Terms or contrary to public order and morals</li>
                      </ul>
                    </li>
                  </ol>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">Article 9 (Personal Information Protection)</h2>
                  <p className="text-gray-700 leading-relaxed">
                    The Company strives to protect members' personal information as prescribed by relevant laws. The protection and use of personal information shall be governed by relevant laws and the Company's Privacy Policy. However, the Company's Privacy Policy does not apply to linked sites other than the Company's official site.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">Article 10 (Limitation of Liability)</h2>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700">
                    <li>
                      The Company shall be exempt from liability for providing the Service if it is unable to provide the Service due to force majeure such as natural disasters or equivalent circumstances.
                    </li>
                    <li>
                      The Company shall not be liable for disruptions in the use of the Service caused by reasons attributable to the member.
                    </li>
                    <li>
                      The Company shall not be liable for the loss of profits expected by members through the use of the Service, nor shall it be liable for damages caused by materials obtained through the Service.
                    </li>
                  </ol>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">Article 11 (Governing Law and Jurisdiction)</h2>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700">
                    <li>
                      The laws of the Republic of Korea shall apply to the interpretation of these Terms and disputes between the Company and users.
                    </li>
                    <li>
                      If a lawsuit is filed regarding disputes arising from the use of the Service, the court having jurisdiction over the Company's headquarters location shall have jurisdiction.
                    </li>
                  </ol>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">Addendum</h2>
                  <p className="text-gray-700 leading-relaxed">
                    These Terms shall be effective from January 1, 2025.
                  </p>
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfServicePage;
