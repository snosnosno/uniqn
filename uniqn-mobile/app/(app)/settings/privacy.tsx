/**
 * UNIQN Mobile - Privacy Policy Screen
 * 개인정보처리방침 화면
 * 한국 개인정보보호법 제30조 준수
 */

import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '@/components/ui';

export default function PrivacyScreen() {
  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['bottom']}>
      <ScrollView className="flex-1" contentContainerClassName="p-4">
        <Card className="mb-4">
          <Text className="mb-4 text-lg font-bold text-gray-900 dark:text-gray-100">
            개인정보처리방침
          </Text>

          <Text className="mb-6 text-sm leading-6 text-gray-600 dark:text-gray-400">
            스노스튜디오(이하 "회사")는 개인정보보호법에 따라 이용자의 개인정보 보호 및 권익을
            보호하고 개인정보와 관련한 이용자의 고충을 원활하게 처리할 수 있도록 다음과 같은
            처리방침을 두고 있습니다.
          </Text>

          {/* 제1조: 개인정보 수집 항목 */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제1조 (개인정보의 수집 항목)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              회사는 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다.{'\n\n'}
              1. 필수 수집 항목{'\n'}- 회원가입: 이메일, 이름, 휴대폰 번호, 생년월일{'\n'}-
              본인인증: CI/DI (암호화 저장){'\n\n'}
              2. 선택 수집 항목{'\n'}- 프로필 사진, 경력 정보, 자기소개{'\n\n'}
              3. 자동 수집 항목{'\n'}- 접속 IP, 접속 일시, 서비스 이용 기록, 기기 정보, 앱 버전
            </Text>
          </View>

          {/* 제2조: 수집 및 이용 목적 */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제2조 (개인정보의 수집 및 이용 목적)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              1. 회원 가입 및 관리{'\n'}- 회원제 서비스 제공, 본인 확인, 연령 확인(만 19세 이상)
              {'\n'}- 서비스 부정 이용 방지, 각종 고지/통지{'\n\n'}
              2. 서비스 제공{'\n'}- 구인구직 매칭, 일정 관리, 출퇴근 관리, 정산 처리{'\n'}-
              구인자-구직자 간 연락 정보 전달{'\n\n'}
              3. 고객 지원{'\n'}- 문의 응대, 불만 처리, 공지사항 전달{'\n\n'}
              4. 서비스 개선{'\n'}- 접속 빈도 파악, 통계 분석, 맞춤형 서비스 제공
            </Text>
          </View>

          {/* 제3조: 보유 및 이용 기간 */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제3조 (개인정보의 보유 및 이용 기간)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              1. 원칙: 회원 탈퇴 시 지체없이 파기{'\n\n'}
              2. 관련 법령에 따른 보존{'\n'}- 계약 또는 청약철회 기록: 5년 (전자상거래법){'\n'}-
              대금결제 및 재화 공급 기록: 5년 (전자상거래법){'\n'}- 소비자 불만 또는 분쟁처리 기록:
              3년 (전자상거래법){'\n'}- 접속 기록: 3개월 (통신비밀보호법){'\n\n'}
              3. 휴면계정{'\n'}- 1년간 미이용 시 별도 분리 보관
            </Text>
          </View>

          {/* 제4조: 제3자 제공 */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제4조 (개인정보의 제3자 제공)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              회사는 원칙적으로 회원의 개인정보를 제3자에게 제공하지 않습니다. 다만, 다음의 경우에는
              예외로 합니다.{'\n\n'}
              1. 회원이 사전에 동의한 경우{'\n\n'}
              2. 서비스 이용을 위해 필요한 경우{'\n'}- 제공받는 자: 구인자 또는 구직자 (매칭 상대방)
              {'\n'}- 제공 항목: 이름, 연락처, 프로필 정보{'\n'}- 제공 목적: 구인구직 매칭, 근무
              일정 조율{'\n'}- 보유 기간: 매칭 종료 후 3개월{'\n\n'}
              3. 법령의 규정에 의한 경우{'\n'}- 수사기관의 적법한 요청, 법원의 판결/명령
            </Text>
          </View>

          {/* 제5조: 안전성 확보 조치 */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제5조 (개인정보의 안전성 확보 조치)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.{'\n\n'}
              1. 관리적 조치{'\n'}- 개인정보 취급 직원의 최소화{'\n'}- 정기적 직원 교육{'\n\n'}
              2. 기술적 조치{'\n'}- 개인정보 암호화 (SSL/TLS){'\n'}- 해킹 등에 대비한 보안 시스템
              {'\n'}- 접근권한 관리 및 접근통제{'\n\n'}
              3. 물리적 조치{'\n'}- 클라우드 서버 보안 (Google Cloud Platform)
            </Text>
          </View>

          {/* 제6조: 정보주체의 권리 */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제6조 (정보주체의 권리·의무 및 행사방법)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              회원은 언제든지 다음의 권리를 행사할 수 있습니다.{'\n\n'}
              1. 개인정보 열람 요구{'\n'}
              2. 개인정보 정정·삭제 요구{'\n'}
              3. 개인정보 처리 정지 요구{'\n'}
              4. 회원 탈퇴 (개인정보 삭제){'\n\n'}
              권리 행사 방법:{'\n'}- 앱 내 "설정 {'>'} 내 정보 관리" 메뉴{'\n'}- 고객센터 문의{'\n'}
              - 이메일: uniqnkorea@gmail.com{'\n\n'}※ 요청 접수 후 10일 이내 조치 및 결과 통지
            </Text>
          </View>

          {/* 제7조: 개인정보 처리 위탁 */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제7조 (개인정보 처리의 위탁)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              회사는 서비스 제공을 위해 다음과 같이 개인정보 처리 업무를 위탁하고 있습니다.
              {'\n\n'}
              1. Google LLC (Firebase){'\n'}- 위탁 업무: 회원 인증, 데이터베이스 운영, 파일 저장
              {'\n'}- 보유 기간: 위탁 계약 종료 시{'\n\n'}
              2. Google LLC (Firebase Cloud Messaging){'\n'}- 위탁 업무: 푸시 알림 발송{'\n'}- 보유
              기간: 발송 완료 시 즉시 삭제{'\n\n'}
              3. Google LLC (Firebase Analytics){'\n'}- 위탁 업무: 앱 사용 통계 분석{'\n'}- 보유
              기간: 14개월{'\n\n'}
              4. Google LLC (Firebase Crashlytics){'\n'}- 위탁 업무: 앱 오류 수집 및 분석{'\n'}-
              보유 기간: 90일{'\n\n'}※ 위탁처 변경 시 개인정보처리방침을 통해 공지
            </Text>
          </View>

          {/* 제8조: 파기 절차 및 방법 */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제8조 (개인정보의 파기 절차 및 방법)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              1. 파기 절차{'\n'}- 회원 탈퇴 또는 보유기간 만료 시 지체없이 파기{'\n'}- 법령에 따라
              보존이 필요한 경우 별도 분리 보관 후 기간 만료 시 파기{'\n\n'}
              2. 파기 방법{'\n'}- 전자적 파일: 복구 불가능한 방법으로 영구 삭제{'\n'}- 종이 문서:
              파쇄 또는 소각
            </Text>
          </View>

          {/* 제9조: 자동 수집 장치 */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제9조 (자동 수집 장치의 설치·운영 및 거부)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              1. 수집 항목{'\n'}- 앱 사용 기록, 접속 빈도, 체류 시간{'\n'}- 기기 식별자, OS 버전, 앱
              버전{'\n'}- 오류 발생 정보 (크래시 로그){'\n\n'}
              2. 수집 목적{'\n'}- 서비스 이용 통계 분석{'\n'}- 앱 성능 개선 및 오류 수정{'\n'}-
              맞춤형 서비스 제공{'\n\n'}
              3. 거부 방법{'\n'}- 기기 설정에서 "광고 추적 제한" 활성화{'\n'}- 앱 삭제 후 재설치
              (식별자 초기화){'\n\n'}※ 거부 시에도 기본 서비스 이용에는 제한이 없습니다.
            </Text>
          </View>

          {/* 제10조: 개인정보 보호책임자 */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제10조 (개인정보 보호책임자)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한
              정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고
              있습니다.{'\n\n'}▶ 개인정보 보호책임자{'\n'}- 성명: 김승호{'\n'}- 직책: 대표{'\n'}-
              연락처: 010-9800-9039{'\n'}- 이메일: uniqnkorea@gmail.com{'\n\n'}※ 개인정보 보호 관련
              문의사항은 위 연락처로 문의해 주시기 바랍니다.
            </Text>
          </View>

          {/* 제11조: 권익침해 구제방법 */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제11조 (권익침해 구제방법)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              정보주체는 개인정보침해로 인한 구제를 받기 위하여 아래 기관에 분쟁해결이나 상담 등을
              신청할 수 있습니다.{'\n\n'}
              1. 개인정보침해 신고센터 (한국인터넷진흥원){'\n'}- 전화: 118{'\n'}- 홈페이지:
              privacy.kisa.or.kr{'\n\n'}
              2. 개인정보분쟁조정위원회{'\n'}- 전화: 1833-6972{'\n'}- 홈페이지: kopico.go.kr{'\n\n'}
              3. 대검찰청 사이버수사과{'\n'}- 전화: 1301{'\n'}- 홈페이지: spo.go.kr{'\n\n'}
              4. 경찰청 사이버안전국{'\n'}- 전화: 182{'\n'}- 홈페이지: cyberbureau.police.go.kr
            </Text>
          </View>

          {/* 제12조: 방침 변경 */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">
              제12조 (개인정보처리방침 변경)
            </Text>
            <Text className="text-sm leading-6 text-gray-600 dark:text-gray-400">
              1. 이 개인정보처리방침은 시행일로부터 적용됩니다.{'\n\n'}
              2. 내용이 변경되는 경우 시행일 7일 전부터 앱 내 공지사항을 통하여 공지합니다.
              {'\n\n'}
              3. 중요한 변경(수집항목, 이용목적, 제3자 제공 등)의 경우 시행일 30일 전부터
              공지합니다.
            </Text>
          </View>

          {/* 시행일 */}
          <View className="border-t border-gray-200 pt-4 dark:border-surface-overlay">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">부칙</Text>
            <Text className="mt-2 text-xs text-gray-500 dark:text-gray-500">
              - 공고일: 2025년 1월 25일{'\n'}- 시행일: 2025년 2월 1일{'\n'}- 버전: 1.0
            </Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
