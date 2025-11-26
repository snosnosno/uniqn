/**
 * 법적 문서 모달 컴포넌트
 *
 * @description
 * 이용약관 및 개인정보처리방침을 전체 화면 모달로 표시
 * - 모바일: 전체 화면
 * - 웹: 대형 모달
 * - 스크롤 가능한 컨텐츠
 * - 뒤로가기 버튼 지원 (Capacitor)
 * - Esc 키로 닫기
 *
 * @version 1.0.0
 * @since 2025-10-23
 */

import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { XMarkIcon, PrinterIcon } from '@heroicons/react/24/outline';

/**
 * 법적 문서 타입
 */
export type LegalDocumentType = 'terms' | 'privacy';

/**
 * Props
 */
interface LegalDocumentModalProps {
  /** 모달 열림 상태 */
  isOpen: boolean;
  /** 모달 닫기 핸들러 */
  onClose: () => void;
  /** 문서 타입 */
  type: LegalDocumentType;
}

/**
 * 법적 문서 모달 컴포넌트
 */
const LegalDocumentModal: React.FC<LegalDocumentModalProps> = ({ isOpen, onClose, type }) => {
  const { t } = useTranslation();

  /**
   * Esc 키로 닫기
   */
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  /**
   * 모바일 뒤로가기 버튼 처리 (Capacitor)
   * 웹 환경에서는 무시됨
   */
  useEffect(() => {
    if (!isOpen) return;

    // Capacitor 동적 import (웹 환경에서는 무시)
    const handleBackButton = async () => {
      try {
        // @ts-ignore - Capacitor는 선택적 의존성
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;

        // @ts-ignore - Capacitor는 선택적 의존성
        const { App: CapacitorApp } = await import('@capacitor/app');
        const backButtonListener = await CapacitorApp.addListener('backButton', () => {
          onClose();
        });

        return backButtonListener;
      } catch (error) {
        // Capacitor가 없는 환경에서는 무시 (웹)
        return undefined;
      }
    };

    let listenerCleanup: (() => void) | undefined;

    handleBackButton()
      .then((listener) => {
        if (listener) {
          listenerCleanup = () => listener.remove();
        }
      })
      .catch(() => {
        // 에러 무시 (웹 환경)
      });

    return () => {
      if (listenerCleanup) {
        listenerCleanup();
      }
    };
  }, [isOpen, onClose]);

  /**
   * Body 스크롤 방지
   */
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  /**
   * 인쇄하기
   */
  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  const title =
    type === 'terms'
      ? t('legal.termsOfService.title', '이용약관')
      : t('legal.privacyPolicy.title', '개인정보 처리방침');

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 모달 */}
      <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-0 sm:p-4">
        <div
          className="bg-white dark:bg-gray-800 w-full h-full sm:max-w-4xl sm:max-h-[90vh] sm:rounded-lg shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-10">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 flex-1 mr-4">
              {title}
            </h2>

            <div className="flex items-center space-x-2">
              {/* 인쇄 버튼 (데스크톱만) */}
              <button
                onClick={handlePrint}
                className="hidden sm:flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                aria-label={t('common.print', '인쇄')}
              >
                <PrinterIcon className="h-5 w-5" />
                <span>{t('common.print', '인쇄')}</span>
              </button>

              {/* 닫기 버튼 */}
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                aria-label={t('common.close', '닫기')}
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* 스크롤 가능한 컨텐츠 */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 sm:px-6 lg:px-8 py-6">
              {type === 'terms' ? <TermsOfServiceContent /> : <PrivacyPolicyContent />}
            </div>
          </div>

          {/* 하단 닫기 버튼 (모바일 편의성) */}
          <div className="border-t dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-4 sm:hidden">
            <button
              onClick={onClose}
              className="w-full px-4 py-3 bg-indigo-600 dark:bg-indigo-700 text-white rounded-lg font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors"
            >
              {t('common.close', '닫기')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

/**
 * 이용약관 컨텐츠 컴포넌트
 */
const TermsOfServiceContent: React.FC = () => {
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.language;

  return (
    <div className="prose prose-sm sm:prose max-w-none">
      {/* 헤더 정보 */}
      <div className="border-b dark:border-gray-700 pb-6 mb-8">
        <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
          <span>{t('legal.version', '버전')}: 1.0.0</span>
          <span>•</span>
          <span>{t('legal.effectiveDate', '시행일')}: 2025년 1월 1일</span>
        </div>
      </div>

      {/* 한국어 내용 */}
      {currentLanguage === 'ko' && (
        <>
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">제1조 (목적)</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              이 약관은 UNIQN(이하 "회사"라 함)이 제공하는 토너먼트 관리 서비스(이하 "서비스"라
              함)의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항, 기타 필요한 사항을
              규정함을 목적으로 합니다.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">제2조 (정의)</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              이 약관에서 사용하는 용어의 정의는 다음과 같습니다:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>
                "서비스"란 회사가 제공하는 토너먼트 관리, 스태프 관리, 구인구직 등의 온라인 서비스를
                말합니다.
              </li>
              <li>"이용자"란 본 약관에 동의하고 서비스를 이용하는 회원 및 비회원을 말합니다.</li>
              <li>
                "회원"이란 서비스에 회원등록을 한 자로서, 계속적으로 서비스를 이용할 수 있는 자를
                말합니다.
              </li>
              <li>"비회원"이란 회원에 가입하지 않고 서비스를 이용하는 자를 말합니다.</li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">제3조 (약관의 명시와 개정)</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>
                회사는 이 약관의 내용을 이용자가 쉽게 알 수 있도록 서비스 초기 화면에 게시합니다.
              </li>
              <li>
                회사는 필요한 경우 관련 법령을 위배하지 않는 범위에서 이 약관을 개정할 수 있습니다.
              </li>
              <li>
                약관이 개정되는 경우 개정내용과 적용일자를 명시하여 적용일자 7일 전부터 공지합니다.
              </li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">제4조 (회원가입)</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>
                이용자는 회사가 정한 가입 양식에 따라 회원정보를 기입한 후 이 약관에 동의한다는
                의사표시를 함으로써 회원가입을 신청합니다.
              </li>
              <li>
                회사는 제1항과 같이 회원으로 가입할 것을 신청한 이용자 중 다음 각 호에 해당하지 않는
                한 회원으로 등록합니다.
              </li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">제5조 (서비스의 제공)</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              회사는 다음과 같은 서비스를 제공합니다:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>토너먼트 생성 및 관리 서비스</li>
              <li>스태프 모집 및 관리 서비스</li>
              <li>구인구직 정보 제공 서비스</li>
              <li>출석 및 급여 관리 서비스</li>
              <li>기타 회사가 추가 개발하거나 제휴계약 등을 통해 제공하는 서비스</li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">제6조 (서비스의 중단)</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>
                회사는 컴퓨터 등 정보통신설비의 보수점검, 교체 및 고장, 통신의 두절 등의 사유가
                발생한 경우 서비스의 제공을 일시적으로 중단할 수 있습니다.
              </li>
              <li>
                사업종목의 전환, 사업의 포기, 업체 간의 통합 등의 이유로 서비스를 제공할 수 없게
                되는 경우 회사는 이용자에게 통지합니다.
              </li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">제7조 (회원탈퇴 및 자격 상실)</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>
                회원은 언제든지 회사에 탈퇴를 요청할 수 있으며, 회사는 즉시 회원탈퇴를 처리합니다.
              </li>
              <li>
                회원이 다음 각 호의 사유에 해당하는 경우, 회사는 회원자격을 제한 및 정지시킬 수
                있습니다.
              </li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">제8조 (개인정보보호)</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              회사는 관련 법령이 정하는 바에 따라 이용자의 개인정보를 보호하기 위해 노력합니다.
              개인정보의 보호 및 사용에 대해서는 관련 법령 및 회사의 개인정보처리방침이 적용됩니다.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">제9조 (회사의 의무)</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>
                회사는 관련 법령과 이 약관이 금지하거나 공서양속에 반하는 행위를 하지 않으며 이
                약관이 정하는 바에 따라 지속적이고 안정적으로 서비스를 제공하는데 최선을 다합니다.
              </li>
              <li>
                회사는 이용자가 안전하게 서비스를 이용할 수 있도록 개인정보(신용정보 포함) 보호를
                위한 보안시스템을 구축합니다.
              </li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">제10조 (이용자의 의무)</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>
                이용자는 다음 행위를 하여서는 안 됩니다:
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                  <li>신청 또는 변경 시 허위내용의 등록</li>
                  <li>타인의 정보 도용</li>
                  <li>회사가 게시한 정보의 변경</li>
                  <li>회사가 정한 정보 이외의 정보(컴퓨터 프로그램 등) 등의 송신 또는 게시</li>
                  <li>회사와 기타 제3자의 저작권 등 지적재산권에 대한 침해</li>
                </ul>
              </li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">제11조 (분쟁해결)</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>
                회사는 이용자가 제기하는 정당한 의견이나 불만을 반영하고 그 피해를 보상처리하기 위해
                노력합니다.
              </li>
              <li>
                서비스 이용과 관련하여 회사와 이용자 사이에 분쟁이 발생한 경우, 쌍방 간에 분쟁의
                해결을 위해 성실히 협의합니다.
              </li>
              <li>본 약관은 대한민국 법률에 따라 규율되고 해석됩니다.</li>
            </ol>
          </section>

          {/* 부칙 */}
          <section className="mt-12 pt-8 border-t dark:border-gray-700">
            <h2 className="text-xl font-bold mb-4">부칙</h2>
            <p className="text-gray-700 dark:text-gray-300">
              본 약관은 2025년 1월 1일부터 시행됩니다.
            </p>
          </section>
        </>
      )}

      {/* 영어 내용 */}
      {currentLanguage === 'en' && (
        <>
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Article 1 (Purpose)</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              These Terms and Conditions govern the rights, obligations, and responsibilities
              between UNIQN (hereinafter "Company") and users regarding the use of tournament
              management services (hereinafter "Services").
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Article 2 (Definitions)</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              The definitions of terms used in these Terms are as follows:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>
                "Services" means online services such as tournament management, staff management,
                and job postings provided by the Company.
              </li>
              <li>
                "User" means a member or non-member who agrees to these Terms and uses the Services.
              </li>
              <li>
                "Member" means a person who has registered as a member and can continuously use the
                Services.
              </li>
              <li>
                "Non-member" means a person who uses the Services without registering as a member.
              </li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">
              Article 3 (Publication and Amendment of Terms)
            </h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>
                The Company shall post the contents of these Terms on the initial screen of the
                Services for easy access by users.
              </li>
              <li>
                The Company may amend these Terms within the scope that does not violate relevant
                laws.
              </li>
              <li>
                When amending the Terms, the Company shall notify the amendments and their effective
                date at least 7 days in advance.
              </li>
            </ol>
          </section>

          {/* 추가 영어 조항들... */}
          <section className="mt-12 pt-8 border-t dark:border-gray-700">
            <h2 className="text-xl font-bold mb-4">Supplementary Provisions</h2>
            <p className="text-gray-700 dark:text-gray-300">
              These Terms shall be effective from January 1, 2025.
            </p>
          </section>
        </>
      )}
    </div>
  );
};

/**
 * 개인정보처리방침 컨텐츠 컴포넌트
 */
const PrivacyPolicyContent: React.FC = () => {
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.language;

  return (
    <div className="prose prose-sm sm:prose max-w-none">
      {/* 헤더 정보 */}
      <div className="border-b dark:border-gray-700 pb-6 mb-8">
        <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
          <span>{t('legal.version', '버전')}: 1.0.0</span>
          <span>•</span>
          <span>{t('legal.effectiveDate', '시행일')}: 2025년 1월 1일</span>
        </div>
      </div>

      {/* 한국어 내용 */}
      {currentLanguage === 'ko' && (
        <>
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">제1조 (개인정보의 수집 항목 및 방법)</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              회사는 다음과 같은 개인정보를 수집합니다:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>필수 수집 항목: 이메일 주소, 이름, 비밀번호</li>
              <li>선택 수집 항목: 전화번호, 프로필 사진, 선호하는 근무 시간</li>
              <li>자동 수집 항목: IP 주소, 쿠키, 서비스 이용 기록, 기기 정보</li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">제2조 (개인정보의 수집 및 이용 목적)</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              회사는 수집한 개인정보를 다음의 목적을 위해 활용합니다:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>회원 관리: 회원제 서비스 이용, 개인 식별, 불량회원의 부정 이용 방지</li>
              <li>서비스 제공: 토너먼트 관리, 스태프 모집, 출석 관리, 급여 정산</li>
              <li>마케팅 및 광고: 신규 서비스 개발 및 맞춤 서비스 제공, 이벤트 정보 제공</li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">제3조 (개인정보의 보유 및 이용기간)</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>회원 탈퇴 시까지: 회원가입 정보</li>
              <li>법령에서 정한 기간: 전자상거래법, 통신비밀보호법 등에 따른 보관</li>
              <li>30일: 계정 삭제 요청 후 유예 기간 (취소 가능)</li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">제4조 (개인정보의 파기 절차 및 방법)</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는
              지체 없이 해당 개인정보를 파기합니다. 전자적 파일 형태는 복구 및 재생이 불가능한
              방법으로 삭제하며, 종이 문서는 분쇄하거나 소각합니다.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">제5조 (이용자의 권리)</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>개인정보 열람 요구</li>
              <li>개인정보 정정 요구</li>
              <li>개인정보 삭제 요구</li>
              <li>개인정보 처리 정지 요구</li>
              <li>동의 철회 (마케팅 수신 거부 등)</li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">제6조 (개인정보 보호책임자)</h2>
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <p className="text-gray-700 dark:text-gray-300">
                <strong>담당자:</strong> 개인정보 관리책임자
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                <strong>이메일:</strong> privacy@tholdem.com
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                <strong>전화:</strong> 02-1234-5678
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">제7조 (개인정보의 안전성 확보 조치)</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>관리적 조치: 내부관리계획 수립 및 시행, 정기적 직원 교육</li>
              <li>기술적 조치: 개인정보처리시스템 접근권한 관리, 암호화, 보안프로그램 설치</li>
              <li>물리적 조치: 전산실, 자료보관실 등의 접근통제</li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">제8조 (쿠키의 운용)</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              회사는 이용자에게 개별적인 맞춤서비스를 제공하기 위해 쿠키(cookie)를 사용합니다.
              이용자는 쿠키 설치에 대한 선택권을 가지고 있으며, 웹브라우저 옵션 설정을 통해 쿠키
              허용 여부를 결정할 수 있습니다.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">제9조 (개인정보의 제3자 제공)</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만, 법령에 의하거나
              이용자가 별도로 동의한 경우에는 예외로 합니다.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">제10조 (개인정보처리방침의 변경)</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              이 개인정보처리방침은 법령, 정책 또는 보안기술의 변경에 따라 내용의 추가, 삭제 및
              수정이 있을 시에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">제11조 (GDPR 준수)</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              EU 일반 데이터 보호 규정(GDPR)을 준수하여 EU 이용자의 개인정보를 보호합니다:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>데이터 이동권 보장</li>
              <li>잊혀질 권리 보장 (계정 삭제 30일 유예 기간)</li>
              <li>데이터 처리 동의 명시적 확보</li>
              <li>데이터 침해 통지 (72시간 이내)</li>
            </ol>
          </section>

          {/* 부칙 */}
          <section className="mt-12 pt-8 border-t dark:border-gray-700">
            <h2 className="text-xl font-bold mb-4">부칙</h2>
            <p className="text-gray-700 dark:text-gray-300">
              본 개인정보처리방침은 2025년 1월 1일부터 시행됩니다.
            </p>
          </section>
        </>
      )}

      {/* 영어 내용 */}
      {currentLanguage === 'en' && (
        <>
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">
              Article 1 (Collection of Personal Information)
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              The Company collects the following personal information:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>Required: Email address, name, password</li>
              <li>Optional: Phone number, profile photo, preferred work hours</li>
              <li>Automatic: IP address, cookies, service usage records, device information</li>
            </ol>
          </section>

          {/* 추가 영어 조항들... */}
          <section className="mt-12 pt-8 border-t dark:border-gray-700">
            <h2 className="text-xl font-bold mb-4">Supplementary Provisions</h2>
            <p className="text-gray-700 dark:text-gray-300">
              This Privacy Policy shall be effective from January 1, 2025.
            </p>
          </section>
        </>
      )}
    </div>
  );
};

export default LegalDocumentModal;
