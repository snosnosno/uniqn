/** @type {import('tailwindcss').Config} */
module.exports = {
  // NativeWind 4.x 필수 설정
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      // UNIQN 브랜드 컬러 (v3.0 - Black & Gold)
      colors: {
        // Text Primary (다크모드 전용) — DESIGN.md L47
        // 라이트 모드 primary 텍스트는 secondary-900(#18181E) 또는 #09090B 사용
        'off-white': '#F0F0F2',
        // Primary: 골드 (메인 액센트)
        primary: {
          50: 'rgba(212,175,55,0.06)',
          100: 'rgba(212,175,55,0.12)',
          200: '#E8C84E',
          300: '#D4AF37',
          400: '#D4AF37',
          500: '#D4AF37',
          600: '#B8962E',
          700: '#8A7228',
          800: '#6E5A1E',
          900: '#524318',
        },
        // Accent: 골드 (primary와 동일 — 호환용)
        accent: {
          50: 'rgba(212,175,55,0.06)',
          100: 'rgba(212,175,55,0.12)',
          200: '#E8C84E',
          300: '#D4AF37',
          400: '#D4AF37',
          500: '#D4AF37',
          600: '#B8962E',
          700: '#8A7228',
        },
        // Surface: 블랙 배경
        surface: {
          DEFAULT: '#09090B',
          dark: '#050506',
          elevated: '#111113',
          overlay: '#19191D',
          hover: '#222228',
        },
        // Secondary: 뉴트럴 쿨 그레이 (A옵션)
        secondary: {
          50: '#F5F5F7',
          100: '#EBEBED',
          200: '#DCDCE0',
          300: '#C0C0C8',
          400: '#A8A8B0',
          500: '#9898A0',
          600: '#707078',
          700: '#4A4A52',
          800: '#2A2A30',
          900: '#18181E',
        },
        // 시멘틱 컨텐츠 토큰 (CSS 변수 참조 — 다크모드 자동 대응)
        content: {
          primary: 'var(--color-content-primary)',
          secondary: 'var(--color-content-secondary)',
          muted: 'var(--color-content-muted)',
          placeholder: 'var(--color-content-placeholder)',
          // 골드 배경 위의 전경 텍스트 (고정 다크 — 다크모드 무관)
          onGold: '#09090B',
        },
        'surface-page': 'var(--color-surface-page)',
        'surface-card': 'var(--color-surface-card)',
        divider: 'var(--color-divider)',
        // 상태 색상
        success: {
          50: 'rgba(34,197,94,0.08)',
          100: 'rgba(34,197,94,0.12)',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
        },
        warning: {
          50: 'rgba(212,160,23,0.08)',
          100: 'rgba(212,160,23,0.12)',
          500: '#D4A017',
          600: '#A16207',
          700: '#854D0E',
        },
        error: {
          50: 'rgba(220,38,38,0.08)',
          100: 'rgba(220,38,38,0.12)',
          500: '#DC2626',
          600: '#B91C1C',
          700: '#991B1B',
        },
        info: {
          50: 'rgba(37,99,235,0.08)',
          100: 'rgba(37,99,235,0.12)',
          500: '#2563EB',
          600: '#1D4ED8',
          700: '#1E40AF',
        },
      },
      // 폰트 패밀리 (Expo Google Fonts)
      fontFamily: {
        'display-semibold': ['Outfit_600SemiBold'],
        display: ['Outfit_700Bold'],
        'display-bold': ['Outfit_800ExtraBold'],
        sans: ['PlusJakartaSans_400Regular'],
        'sans-medium': ['PlusJakartaSans_500Medium'],
        'sans-semibold': ['PlusJakartaSans_600SemiBold'],
        'sans-bold': ['PlusJakartaSans_700Bold'],
      },
      // 폰트 사이즈 (React Native 호환)
      fontSize: {
        micro: ['10px', { lineHeight: '14px' }],
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['14px', { lineHeight: '20px' }],
        base: ['15px', { lineHeight: '22px' }],
        lg: ['18px', { lineHeight: '28px' }],
        xl: ['22px', { lineHeight: '30px' }],
        '2xl': ['28px', { lineHeight: '36px' }],
        '3xl': ['36px', { lineHeight: '44px' }],
      },
      // impeccable §1 — 다크모드 본문 lineHeight 가산 (+6~8%, 밝은 텍스트는
      // 다크 배경 위에서 시각적으로 더 가벼워 호흡이 더 필요).
      // 사용: `leading-body-dark` (본문 ~14-16px 기준), `leading-base-dark` (15px),
      //       `leading-sm-dark` (14px). 적용 예: `text-sm leading-5 dark:leading-body-dark`.
      lineHeight: {
        'sm-dark': '22px', // sm(14) 기본 20 → 다크 22 (+10%)
        'body-dark': '24px', // 본문 통칭 — base/sm 혼용 컨테이너에 사용
        'base-dark': '24px', // base(15) 기본 22 → 다크 24 (+9%)
        'lg-dark': '30px', // lg(18) 기본 28 → 다크 30 (+7%)
      },
      // 스페이싱 (px 단위)
      spacing: {
        0.5: '2px',
        1: '4px',
        1.5: '6px',
        2: '8px',
        2.5: '10px',
        3: '12px',
        3.5: '14px',
        4: '16px',
        5: '20px',
        6: '24px',
        7: '28px',
        8: '32px',
        9: '36px',
        10: '40px',
        11: '44px',
        12: '48px',
        14: '56px',
        16: '64px',
        20: '80px',
        24: '96px',
      },
      // 둥근 모서리 (v3.0 - 날카롭게)
      borderRadius: {
        none: '0px',
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
        xl: '12px',
        '2xl': '14px',
        '3xl': '16px',
      },
      // 그림자 (React Native 호환)
      boxShadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
        DEFAULT: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
        md: '0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)',
        lg: '0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
        xl: '0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04)',
        none: 'none',
      },
      // 자간 (디자인 현대화 v3.1 - 카드 타이틀 타이트닝 + 칩 UPPERCASE)
      letterSpacing: {
        'card-title': '-0.02em',
        chip: '0.06em',
      },
      // 숫자 정렬 (가변→고정폭 전환 — 금액/시간 표시용)
      fontVariantNumeric: {
        tabular: 'tabular-nums',
      },
    },
  },
  plugins: [],
};
