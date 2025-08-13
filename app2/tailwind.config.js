/** @type {import('tailwindcss').Config} */
const { colors } = require('./src/styles/tokens/colors');

module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Primary 색상 - 청색 계열 (디자인 토큰 통합)
        primary: colors.primary,
        // Secondary 색상 - 초록색 계열 (디자인 토큰 통합)
        secondary: colors.secondary,
        // Semantic 색상 (디자인 토큰 통합)
        success: colors.success,
        warning: colors.warning,
        error: colors.error,
        info: colors.info,
        // 중성 색상 (디자인 토큰 통합)
        gray: colors.gray,
        // 배경 색상 (디자인 토큰 통합)
        background: colors.background,
        // 텍스트 색상 (디자인 토큰 통합)
        text: colors.text,
        // 보더 색상 (디자인 토큰 통합)
        border: colors.border,
        // 출석 상태 색상 (디자인 토큰 통합)
        attendance: colors.attendance,
        // 시간대별 색상 (디자인 토큰 통합)
        timeSlot: colors.timeSlot,
      },
      fontFamily: {
        sans: [
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      fontSize: {
        // 모바일 최소 14px 보장
        'xs': ['0.875rem', { lineHeight: '1.25rem' }],   // 14px
        'sm': ['0.9375rem', { lineHeight: '1.375rem' }], // 15px
        'base': ['1rem', { lineHeight: '1.5rem' }],      // 16px
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],   // 18px
        'xl': ['1.25rem', { lineHeight: '1.875rem' }],   // 20px
        '2xl': ['1.5rem', { lineHeight: '2rem' }],       // 24px
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],  // 30px
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],    // 36px
        '5xl': ['3rem', { lineHeight: '1.2' }],          // 48px
        '6xl': ['3.75rem', { lineHeight: '1.2' }],       // 60px
      },
      spacing: {
        '18': '4.5rem',  // 72px
        '88': '22rem',   // 352px
        '128': '32rem',  // 512px
        '144': '36rem',  // 576px
      },
      minHeight: {
        'touch': '44px', // WCAG 터치 타겟 최소 크기
      },
      minWidth: {
        'touch': '44px', // WCAG 터치 타겟 최소 크기
      },
      boxShadow: {
        'focus': '0 0 0 3px rgba(59, 130, 246, 0.5)',
        'focus-error': '0 0 0 3px rgba(239, 68, 68, 0.5)',
        'focus-success': '0 0 0 3px rgba(34, 197, 94, 0.5)',
      },
      animation: {
        'slide-in': 'slideIn 0.2s ease-out',
        'slide-out': 'slideOut 0.2s ease-in',
        'fade-in': 'fadeIn 0.2s ease-out',
        'fade-out': 'fadeOut 0.2s ease-in',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideOut: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}
