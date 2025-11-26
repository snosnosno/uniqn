/** @type {import('tailwindcss').Config} */
const { colors } = require('./src/styles/tokens/colors');

module.exports = {
  darkMode: 'class', // 다크모드 활성화 (클래스 기반)
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
      screens: {
        'xs': '375px',   // 작은 모바일
        'sm': '640px',   // 일반 모바일  
        'md': '768px',   // 태블릿
        'lg': '1024px',  // 데스크톱
        'xl': '1280px',  // 큰 데스크톱
        '2xl': '1536px', // 매우 큰 화면
      },
      container: {
        center: true,
        padding: {
          DEFAULT: '0.75rem', // 12px - 모바일 기본 패딩 축소
          xs: '0.75rem',      // 12px
          sm: '1rem',         // 16px
          md: '1.5rem',       // 24px
          lg: '2rem',         // 32px
          xl: '3rem',         // 48px
          '2xl': '4rem',      // 64px
        },
        screens: {
          xs: '100%',
          sm: '100%', 
          md: '100%',
          lg: '1024px',
          xl: '1280px',
          '2xl': '1536px',
        }
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
        'pulse-border': 'pulseBorder 2s cubic-bezier(0.4, 0, 0.6, 1) infinite', // 긴급 공고 깜빡임
        // Micro-interactions
        'scale-up': 'scaleUp 0.2s ease-out',
        'scale-down': 'scaleDown 0.15s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'slide-down': 'slideDown 0.25s ease-out',
        'shake': 'shake 0.5s ease-in-out',
        'bounce-subtle': 'bounceSubtle 0.4s ease-out',
        'list-item': 'listItem 0.3s ease-out',
        'pop': 'pop 0.2s ease-out',
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
        pulseBorder: {
          '0%, 100%': {
            borderColor: 'rgb(239 68 68)',  // red-500
            opacity: '1'
          },
          '50%': {
            borderColor: 'rgb(239 68 68)',  // red-500
            opacity: '0.5'
          }
        },
        // Micro-interaction keyframes
        scaleUp: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        scaleDown: {
          '0%': { transform: 'scale(1.05)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
        },
        bounceSubtle: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)' },
        },
        listItem: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        pop: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '50%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
