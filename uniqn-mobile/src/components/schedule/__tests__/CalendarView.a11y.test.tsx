import { LocaleConfig } from 'react-native-calendars';
import '../CalendarView';

/**
 * 캘린더는 이 탭의 기본 뷰다. 라이브러리 기본값을 그대로 두면
 * - 날짜 셀 터치 타깃이 32×32 라 한 손 조작에서 탭이 자주 먹지 않고,
 * - VoiceOver 가 'Monday 13 July 2026' 을 영어로 읽으며 일정 건수·상태는 낭독하지 않는다.
 *
 * 렌더 없이 모듈이 설정한 값만 검증한다 (react-native-calendars 실렌더는 무겁다).
 */
describe('CalendarView 접근성 설정', () => {
  it('한국어 로케일에 접근성 라벨 포맷을 지정한다', () => {
    expect(LocaleConfig.locales.ko).toBeDefined();
    expect(LocaleConfig.locales.ko.formatAccessibilityLabel).toBe('yyyy년 M월 d일 dddd');
  });

  it('기본 로케일이 한국어다', () => {
    expect(LocaleConfig.defaultLocale).toBe('ko');
  });
});
