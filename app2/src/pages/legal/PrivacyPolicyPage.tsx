/**
 * 개인정보처리방침 페이지
 *
 * @description
 * UNIQN 서비스 개인정보처리방침을 표시하는 페이지
 * - 정적 콘텐츠 표시
 * - 버전 정보 포함
 * - 인쇄 가능한 레이아웃
 * - i18n 지원 (한국어/영어)
 * - GDPR/CCPA 준수 내용 포함
 *
 * @version 1.0.0
 * @since 2025-10-23
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, PrinterIcon } from '@heroicons/react/24/outline';

/**
 * 개인정보처리방침 페이지 컴포넌트
 */
const PrivacyPolicyPage: React.FC = () => {
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 헤더 (인쇄 시 숨김) */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 sticky top-0 z-10 print:hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={handleGoBack}
                className="mr-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                aria-label={t('common.back')}
              >
                <ArrowLeftIcon className="h-6 w-6 dark:text-gray-200" />
              </button>
              <h1 className="text-xl font-semibold dark:text-gray-100">
                {t('legal.privacyPolicy.title')}
              </h1>
            </div>
            <button
              onClick={handlePrint}
              className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8 print:shadow-none">
          {/* 헤더 정보 */}
          <div className="border-b dark:border-gray-700 pb-6 mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {t('legal.privacyPolicy.title')}
            </h1>
            <div className="mt-4 flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-300">
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
                  <h2 className="text-xl font-semibold mb-4">1. 개인정보의 수집 및 이용 목적</h2>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    UNIQN(이하 "회사")은 다음의 목적을 위하여 개인정보를 수집 및 이용합니다. 수집된 개인정보는 다음의 목적 이외의 용도로는 사용되지 않으며, 이용 목적이 변경될 시에는 사전 동의를 구할 것입니다.
                  </p>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">가. 회원 가입 및 관리</h3>
                      <ul className="list-disc list-inside ml-4 space-y-1 text-gray-700">
                        <li>회원제 서비스 이용에 따른 본인 확인</li>
                        <li>개인 식별 및 부정 이용 방지</li>
                        <li>비인가 사용 방지 및 가입 의사 확인</li>
                        <li>분쟁 조정을 위한 기록 보존</li>
                        <li>불만 처리 등 민원 처리</li>
                        <li>고지사항 전달</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">나. 서비스 제공</h3>
                      <ul className="list-disc list-inside ml-4 space-y-1 text-gray-700">
                        <li>토너먼트 운영 및 관리</li>
                        <li>스태프 및 참가자 관리</li>
                        <li>구인구직 매칭 서비스 제공</li>
                        <li>근무 기록 및 급여 정산</li>
                        <li>출석 관리</li>
                        <li>서비스 이용 내역 관리</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">다. 마케팅 및 광고 활용</h3>
                      <ul className="list-disc list-inside ml-4 space-y-1 text-gray-700">
                        <li>신규 서비스 개발 및 맞춤 서비스 제공</li>
                        <li>이벤트 및 광고성 정보 제공</li>
                        <li>서비스 이용 통계 및 접속 빈도 분석</li>
                      </ul>
                    </div>
                  </div>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">2. 수집하는 개인정보 항목</h2>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">가. 필수 항목</h3>
                      <ul className="list-disc list-inside ml-4 space-y-1 text-gray-700">
                        <li>이메일 주소</li>
                        <li>비밀번호 (암호화 저장)</li>
                        <li>이름</li>
                        <li>휴대전화번호</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">나. 선택 항목</h3>
                      <ul className="list-disc list-inside ml-4 space-y-1 text-gray-700">
                        <li>프로필 사진</li>
                        <li>주소</li>
                        <li>생년월일</li>
                        <li>경력 정보</li>
                        <li>은행 계좌 정보 (급여 지급용)</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">다. 자동 수집 항목</h3>
                      <ul className="list-disc list-inside ml-4 space-y-1 text-gray-700">
                        <li>IP 주소</li>
                        <li>쿠키</li>
                        <li>서비스 이용 기록</li>
                        <li>접속 로그</li>
                        <li>기기 정보 (OS, 브라우저)</li>
                        <li>위치 정보 (동의 시)</li>
                      </ul>
                    </div>
                  </div>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">3. 개인정보의 보유 및 이용 기간</h2>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.
                  </p>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">가. 회원 정보</h3>
                      <p className="text-gray-700 ml-4">
                        회원 탈퇴 시까지 (단, 관계 법령 위반에 따른 수사·조사 등이 진행 중인 경우에는 해당 수사·조사 종료 시까지)
                      </p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">나. 관계 법령에 따른 보존</h3>
                      <ul className="list-disc list-inside ml-4 space-y-2 text-gray-700">
                        <li>
                          계약 또는 청약철회 등에 관한 기록: 5년
                          <br />
                          <span className="text-sm text-gray-600">(전자상거래 등에서의 소비자보호에 관한 법률)</span>
                        </li>
                        <li>
                          대금결제 및 재화 등의 공급에 관한 기록: 5년
                          <br />
                          <span className="text-sm text-gray-600">(전자상거래 등에서의 소비자보호에 관한 법률)</span>
                        </li>
                        <li>
                          소비자의 불만 또는 분쟁 처리에 관한 기록: 3년
                          <br />
                          <span className="text-sm text-gray-600">(전자상거래 등에서의 소비자보호에 관한 법률)</span>
                        </li>
                        <li>
                          로그인 기록: 3개월
                          <br />
                          <span className="text-sm text-gray-600">(통신비밀보호법)</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">4. 개인정보의 제3자 제공</h2>
                  <p className="text-gray-700 leading-relaxed">
                    회사는 원칙적으로 이용자의 개인정보를 제1조(개인정보의 수집 및 이용 목적)에서 명시한 범위 내에서만 처리하며, 이용자의 사전 동의 없이는 본래의 범위를 초과하여 처리하거나 제3자에게 제공하지 않습니다. 다만, 다음의 경우는 예외로 합니다:
                  </p>
                  <ul className="list-disc list-inside ml-4 mt-4 space-y-2 text-gray-700">
                    <li>이용자가 사전에 동의한 경우</li>
                    <li>법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">5. 개인정보 처리의 위탁</h2>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    회사는 서비스 제공을 위해 아래와 같이 개인정보 처리 업무를 외부 전문업체에 위탁하여 운영하고 있습니다.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            수탁업체
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            위탁 업무 내용
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            Google Firebase
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-200">
                            회원 인증, 데이터베이스 관리, 알림 발송
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">6. 개인정보의 파기 절차 및 방법</h2>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">가. 파기 절차</h3>
                      <p className="text-gray-700 ml-4">
                        이용자가 회원가입 등을 위해 입력한 정보는 목적이 달성된 후 별도의 DB로 옮겨져(종이의 경우 별도의 서류함) 내부 방침 및 기타 관련 법령에 의한 정보보호 사유에 따라(보유 및 이용기간 참조) 일정 기간 저장된 후 파기됩니다.
                      </p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">나. 파기 방법</h3>
                      <ul className="list-disc list-inside ml-4 space-y-1 text-gray-700">
                        <li>전자적 파일 형태: 기록을 재생할 수 없는 기술적 방법을 사용하여 삭제</li>
                        <li>종이에 출력된 개인정보: 분쇄기로 분쇄하거나 소각</li>
                      </ul>
                    </div>
                  </div>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">7. 정보주체의 권리·의무 및 행사 방법</h2>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    이용자는 개인정보주체로서 다음과 같은 권리를 행사할 수 있습니다:
                  </p>
                  <ul className="list-disc list-inside ml-4 space-y-2 text-gray-700">
                    <li>개인정보 열람 요구</li>
                    <li>개인정보 정정·삭제 요구</li>
                    <li>개인정보 처리 정지 요구</li>
                    <li>개인정보 수집·이용·제공에 대한 동의 철회</li>
                  </ul>
                  <p className="text-gray-700 leading-relaxed mt-4">
                    권리 행사는 서비스 내 설정 메뉴를 통해 직접 하실 수 있으며, 개인정보보호책임자에게 서면, 전화, 이메일로 연락하시면 지체 없이 조치하겠습니다.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">8. 개인정보 보호책임자</h2>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만 처리 및 피해 구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
                  </p>
                  <div className="bg-gray-50 border rounded-lg p-6">
                    <div className="space-y-2 text-gray-700">
                      <p><strong>개인정보 보호책임자</strong></p>
                      <p>이메일: privacy@tholdem.com</p>
                      <p>전화: 02-1234-5678</p>
                    </div>
                  </div>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">9. 개인정보의 안전성 확보 조치</h2>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다:
                  </p>
                  <ul className="list-disc list-inside ml-4 space-y-2 text-gray-700">
                    <li>관리적 조치: 내부관리계획 수립·시행, 정기적 직원 교육</li>
                    <li>기술적 조치: 개인정보처리시스템 등의 접근권한 관리, 접근통제시스템 설치, 암호화</li>
                    <li>물리적 조치: 전산실, 자료보관실 등의 접근통제</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">10. 개인정보 자동 수집 장치의 설치·운영 및 거부에 관한 사항</h2>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    회사는 이용자에게 개별적인 맞춤 서비스를 제공하기 위해 이용정보를 저장하고 수시로 불러오는 '쿠키(cookie)'를 사용합니다.
                  </p>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">가. 쿠키의 사용 목적</h3>
                      <ul className="list-disc list-inside ml-4 space-y-1 text-gray-700">
                        <li>자동 로그인 기능</li>
                        <li>서비스 이용 빈도 및 패턴 분석</li>
                        <li>맞춤형 서비스 제공</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">나. 쿠키 설정 거부 방법</h3>
                      <p className="text-gray-700 ml-4">
                        이용자는 웹브라우저 상단의 도구 &gt; 인터넷 옵션 &gt; 개인정보 메뉴의 옵션 설정을 통해 쿠키 저장을 거부할 수 있습니다. 다만, 쿠키 설정을 거부할 경우 서비스 이용에 어려움이 있을 수 있습니다.
                      </p>
                    </div>
                  </div>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">11. 개인정보처리방침의 변경</h2>
                  <p className="text-gray-700 leading-relaxed">
                    이 개인정보처리방침은 2025년 1월 1일부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.
                  </p>
                </section>
              </>
            ) : (
              <>
                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">1. Purpose of Collection and Use of Personal Information</h2>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    UNIQN (hereinafter referred to as "Company") collects and uses personal information for the following purposes. The collected personal information will not be used for purposes other than the following, and prior consent will be obtained if the purpose of use changes.
                  </p>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">A. Membership Registration and Management</h3>
                      <ul className="list-disc list-inside ml-4 space-y-1 text-gray-700">
                        <li>Identity verification for membership services</li>
                        <li>Personal identification and prevention of fraudulent use</li>
                        <li>Prevention of unauthorized use and confirmation of intention to join</li>
                        <li>Record preservation for dispute resolution</li>
                        <li>Handling complaints and grievances</li>
                        <li>Delivery of notifications</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">B. Service Provision</h3>
                      <ul className="list-disc list-inside ml-4 space-y-1 text-gray-700">
                        <li>Tournament operation and management</li>
                        <li>Staff and participant management</li>
                        <li>Job matching service provision</li>
                        <li>Work record and payroll settlement</li>
                        <li>Attendance management</li>
                        <li>Service usage history management</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">C. Marketing and Advertising</h3>
                      <ul className="list-disc list-inside ml-4 space-y-1 text-gray-700">
                        <li>New service development and customized service provision</li>
                        <li>Event and promotional information provision</li>
                        <li>Service usage statistics and access frequency analysis</li>
                      </ul>
                    </div>
                  </div>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">2. Personal Information Items Collected</h2>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">A. Required Items</h3>
                      <ul className="list-disc list-inside ml-4 space-y-1 text-gray-700">
                        <li>Email address</li>
                        <li>Password (encrypted storage)</li>
                        <li>Name</li>
                        <li>Mobile phone number</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">B. Optional Items</h3>
                      <ul className="list-disc list-inside ml-4 space-y-1 text-gray-700">
                        <li>Profile photo</li>
                        <li>Address</li>
                        <li>Date of birth</li>
                        <li>Career information</li>
                        <li>Bank account information (for salary payment)</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">C. Automatically Collected Items</h3>
                      <ul className="list-disc list-inside ml-4 space-y-1 text-gray-700">
                        <li>IP address</li>
                        <li>Cookies</li>
                        <li>Service usage records</li>
                        <li>Access logs</li>
                        <li>Device information (OS, browser)</li>
                        <li>Location information (with consent)</li>
                      </ul>
                    </div>
                  </div>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">3. Retention and Use Period of Personal Information</h2>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    The Company processes and retains personal information within the retention and use period prescribed by law or the retention and use period consented to by the data subject when collecting personal information.
                  </p>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">A. Member Information</h3>
                      <p className="text-gray-700 ml-4">
                        Until membership withdrawal (however, if an investigation is in progress due to violation of relevant laws, until the completion of the investigation)
                      </p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">B. Retention in Accordance with Relevant Laws</h3>
                      <ul className="list-disc list-inside ml-4 space-y-2 text-gray-700">
                        <li>
                          Records on contracts or withdrawal of offers: 5 years
                          <br />
                          <span className="text-sm text-gray-600">(Act on Consumer Protection in Electronic Commerce, etc.)</span>
                        </li>
                        <li>
                          Records on payment and supply of goods: 5 years
                          <br />
                          <span className="text-sm text-gray-600">(Act on Consumer Protection in Electronic Commerce, etc.)</span>
                        </li>
                        <li>
                          Records on consumer complaints or dispute resolution: 3 years
                          <br />
                          <span className="text-sm text-gray-600">(Act on Consumer Protection in Electronic Commerce, etc.)</span>
                        </li>
                        <li>
                          Login records: 3 months
                          <br />
                          <span className="text-sm text-gray-600">(Protection of Communications Secrets Act)</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">4. Provision of Personal Information to Third Parties</h2>
                  <p className="text-gray-700 leading-relaxed">
                    In principle, the Company processes users' personal information only within the scope specified in Article 1 (Purpose of Collection and Use of Personal Information) and does not process beyond the original scope or provide it to third parties without the user's prior consent. However, the following cases are exceptions:
                  </p>
                  <ul className="list-disc list-inside ml-4 mt-4 space-y-2 text-gray-700">
                    <li>When the user has consented in advance</li>
                    <li>When there is a request from an investigative agency according to procedures and methods prescribed by law for investigative purposes</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">5. Outsourcing of Personal Information Processing</h2>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    The Company outsources personal information processing tasks to external specialized companies as follows to provide services.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Contractor
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Outsourced Tasks
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            Google Firebase
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            Member authentication, database management, notification delivery
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">6. Procedure and Method for Destruction of Personal Information</h2>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">A. Destruction Procedure</h3>
                      <p className="text-gray-700 ml-4">
                        Information entered by users for membership registration is moved to a separate DB (or separate file cabinet for paper) after the purpose is achieved and stored for a certain period according to internal policies and other relevant laws (refer to retention and use period) before being destroyed.
                      </p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">B. Destruction Method</h3>
                      <ul className="list-disc list-inside ml-4 space-y-1 text-gray-700">
                        <li>Electronic files: Deleted using technical methods that prevent record reproduction</li>
                        <li>Personal information printed on paper: Shredded or incinerated</li>
                      </ul>
                    </div>
                  </div>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">7. Rights and Obligations of Data Subjects and Exercise Methods</h2>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    Users may exercise the following rights as data subjects:
                  </p>
                  <ul className="list-disc list-inside ml-4 space-y-2 text-gray-700">
                    <li>Request to view personal information</li>
                    <li>Request to correct or delete personal information</li>
                    <li>Request to suspend personal information processing</li>
                    <li>Withdraw consent for collection, use, and provision of personal information</li>
                  </ul>
                  <p className="text-gray-700 leading-relaxed mt-4">
                    Rights can be exercised directly through the settings menu in the service, and if you contact the Personal Information Protection Officer in writing, by phone, or by email, we will take action without delay.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">8. Personal Information Protection Officer</h2>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    The Company designates a Personal Information Protection Officer as follows to be in charge of overall personal information processing tasks and to handle complaints and remedy damages related to personal information processing.
                  </p>
                  <div className="bg-gray-50 border rounded-lg p-6">
                    <div className="space-y-2 text-gray-700">
                      <p><strong>Personal Information Protection Officer</strong></p>
                      <p>Email: privacy@tholdem.com</p>
                      <p>Phone: 02-1234-5678</p>
                    </div>
                  </div>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">9. Measures to Ensure Safety of Personal Information</h2>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    The Company takes the following measures to ensure the safety of personal information:
                  </p>
                  <ul className="list-disc list-inside ml-4 space-y-2 text-gray-700">
                    <li>Administrative measures: Establishment and implementation of internal management plan, regular employee training</li>
                    <li>Technical measures: Access authority management for personal information processing systems, installation of access control systems, encryption</li>
                    <li>Physical measures: Access control to computer rooms, data storage rooms, etc.</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">10. Installation, Operation, and Refusal of Automatic Personal Information Collection Devices</h2>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    The Company uses 'cookies' that store usage information and retrieve it from time to time to provide users with individually customized services.
                  </p>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">A. Purpose of Cookie Use</h3>
                      <ul className="list-disc list-inside ml-4 space-y-1 text-gray-700">
                        <li>Automatic login function</li>
                        <li>Service usage frequency and pattern analysis</li>
                        <li>Customized service provision</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">B. Method to Refuse Cookie Settings</h3>
                      <p className="text-gray-700 ml-4">
                        Users can refuse to store cookies through option settings in Tools &gt; Internet Options &gt; Privacy menu at the top of the web browser. However, refusing to set cookies may cause difficulties in using the service.
                      </p>
                    </div>
                  </div>
                </section>

                <section className="mb-8">
                  <h2 className="text-xl font-semibold mb-4">11. Changes to Privacy Policy</h2>
                  <p className="text-gray-700 leading-relaxed">
                    This Privacy Policy is effective from January 1, 2025, and if there are additions, deletions, or corrections to changes in accordance with laws and policies, they will be notified through the notice section at least 7 days prior to the implementation of changes.
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

export default PrivacyPolicyPage;
