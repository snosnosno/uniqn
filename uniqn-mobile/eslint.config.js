/**
 * UNIQN Mobile - ESLint Flat Config
 *
 * @description React Native + TypeScript + Expo 프로젝트용 ESLint 설정
 * @version 2.0.0 (flat config 마이그레이션)
 */

const expoConfig = require('eslint-config-expo/flat');
const eslintConfigPrettier = require('eslint-config-prettier');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const reactPlugin = require('eslint-plugin-react');
const reactHooksPlugin = require('eslint-plugin-react-hooks');
const reactNativePlugin = require('eslint-plugin-react-native');

module.exports = [
  // 1. Expo 기본 설정 (TypeScript, React, React Hooks, import 포함)
  ...expoConfig,

  // 2. 프로젝트 TypeScript 규칙
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    languageOptions: {
      parser: tsParser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
    },
  },

  // 3. 프로젝트 React / React Native 규칙
  {
    files: ['**/*.{jsx,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'react-native': reactNativePlugin,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // React
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/display-name': 'off',
      'react/no-unescaped-entities': 'warn',

      // React Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // React Native
      'react-native/no-unused-styles': 'warn',
      'react-native/no-inline-styles': 'off',
      'react-native/no-color-literals': 'off',
    },
  },

  // 4. 프로젝트 일반 규칙
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error', 'info', 'debug'] }],
      'no-debugger': 'warn',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@expo/vector-icons',
              message: 'Use @/components/icons instead.',
            },
            {
              name: 'lucide-react-native',
              message: '아이콘은 @/components/icons 에서 import 하세요 (stroke·색 일관성).',
            },
          ],
          patterns: [
            {
              group: ['@expo/vector-icons/*'],
              message: 'Use @/components/icons instead.',
            },
          ],
        },
      ],
      'prefer-const': 'warn',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'multi-line'],
    },
  },

  // 4a. 리프 컴포넌트에서 @/hooks 배럴 import 금지 — 순환 참조 크래시 이력.
  // hooks 배럴을 리프 UI에서 통째로 import하면 배럴이 끌어오는 무거운 의존성 그래프가
  // 순환 참조를 만들어 마운트 시 크래시가 났다(hooks barrel↔UI). 개별 훅 직접 경로로 import.
  // no-restricted-imports 는 flat config에서 배열 옵션이 병합되지 않고 통째로 교체되므로,
  // 컴포넌트 범위에서도 아이콘 금지(4번 블록)를 유지하기 위해 함께 명시한다.
  // (app/ 라우트는 대상에서 제외 — 컴포넌트 트리 리프만 규제)
  {
    files: ['src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@expo/vector-icons',
              message: 'Use @/components/icons instead.',
            },
            {
              name: 'lucide-react-native',
              message: '아이콘은 @/components/icons 에서 import 하세요 (stroke·색 일관성).',
            },
            {
              name: '@/hooks',
              message:
                '리프 컴포넌트에서 hooks 배럴 import 금지 — 순환 참조 크래시 이력. 개별 훅 직접 경로로 import',
            },
          ],
          patterns: [
            {
              group: ['@expo/vector-icons/*'],
              message: 'Use @/components/icons instead.',
            },
          ],
        },
      ],
    },
  },

  // 4b. T-B12: boardService direct sync 함수 외부 호출 차단
  // 모든 schedule_board sync는 jobManagementService.enqueueScheduleBoardSync 경유 필수.
  // 4d에 통합되어 있어 이 블록은 더 이상 필요하지 않음.

  // 4c. 아이콘 래핑 레이어 — lucide-react-native 직접 import 허용 (유일한 경로)
  {
    files: ['src/components/icons/index.tsx'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },

  // 4d. NativeWind 동적 className 가드레일 — dark:text-off-white 재발 방지
  // 2026-04-19 전체 sweep: 삼항/템플릿 리터럴/함수 반환 내 `dark:text-off-white` 는
  // 정적 추출 실패로 다크모드에서 텍스트가 안 보이는 버그를 반복 유발.
  // CSS var 토큰(`text-content-primary`)은 `.dark` 클래스로 자동 스왑되므로
  // 동적 컨텍스트에서는 반드시 토큰을 사용한다.
  {
    files: ['src/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'ImportSpecifier[imported.name=/^syncScheduleBoard(ForJobPosting|ByJobPostingId|ByApplicationId)$/]',
          message:
            'T-B12: outbox enqueue를 사용하세요. enqueueScheduleBoardSync from "@/services/jobs/jobManagementService"',
        },
        {
          selector: 'ConditionalExpression > Literal[value=/dark:(text|bg|border)-off-white/]',
          message:
            '삼항 분기 내 dark:text-off-white 금지. `text-content-primary` CSS var 토큰 사용 (NativeWind 정적 추출 실패 방지).',
        },
        {
          selector: 'LogicalExpression > Literal[value=/dark:(text|bg|border)-off-white/]',
          message:
            '&& / || 분기 내 dark:text-off-white 금지. `text-content-primary` CSS var 토큰 사용.',
        },
        {
          selector: 'TemplateLiteral TemplateElement[value.raw=/dark:(text|bg|border)-off-white/]',
          message:
            '템플릿 리터럴 내 dark:text-off-white 금지. `text-content-primary` CSS var 토큰 사용 (NativeWind 정적 추출 실패 방지).',
        },
        {
          selector: 'ReturnStatement > Literal[value=/dark:(text|bg|border)-off-white/]',
          message:
            '함수 반환 className에 dark:text-off-white 금지. `text-content-primary` CSS var 토큰 사용.',
        },
        {
          selector: 'ArrowFunctionExpression > Literal[value=/dark:(text|bg|border)-off-white/]',
          message:
            'Arrow 함수 반환 className에 dark:text-off-white 금지. `text-content-primary` CSS var 토큰 사용.',
        },
        // Firebase Timestamp 레거시 청산 가드 (2026-04-19)
        // timestampSchema는 ISO string을 반환한다. Date가 필요한 view site만 @/utils/date의
        // toDate(str)로 변환하고, Firebase Firestore 모방 API(Timestamp 클래스, .toDate(),
        // SerializedTimestamp/TimestampLike/getDateString 등)는 전부 제거됐다. 재도입 차단.
        {
          selector: 'NewExpression[callee.name="Timestamp"]',
          message:
            'Firebase Timestamp 클래스 재도입 금지. ISO string(new Date().toISOString()) 또는 Date 사용.',
        },
        {
          selector: 'MemberExpression[object.name="Timestamp"]',
          message:
            'Timestamp.now()/fromDate() 등 Firebase 모방 API 금지. new Date() + .toISOString() 사용.',
        },
        {
          selector:
            'ImportSpecifier[imported.name=/^(SerializedTimestamp|TimestampLike|hasToDate|hasSeconds|getDateString)$/]',
          message:
            '청산된 Firebase Timestamp 레거시 타입/헬퍼는 import 금지. timestampSchema(ISO string) 또는 @/utils/date의 toDate(str) 사용.',
        },
        {
          selector: 'CallExpression[callee.type="MemberExpression"][callee.property.name="toDate"]',
          message:
            '.toDate() 메서드 호출 금지 (Firebase Timestamp 레거시). schema 출력은 ISO string이므로 @/utils/date의 toDate(str) 함수를 사용.',
        },
        // Alert 웹 no-op 가드 (2026-07-17)
        // rn-web 의 Alert.alert 는 완전 no-op(static alert() {}) — 웹 배포(uniqn.app)에서
        // 확인 다이얼로그가 게이트인 액션이 통째로 죽는 사고 재발 방지(10파일 21건 교정 이력).
        {
          selector: 'CallExpression[callee.object.name="Alert"][callee.property.name="alert"]',
          message:
            'Alert.alert 직접 호출 금지 — 웹(rn-web)에서 no-op. 확인/취소는 confirmAction, 1버튼 안내는 showAlert (@/utils) 를 사용하세요.',
        },
        {
          selector:
            'CallExpression[callee.object.name="window"][callee.property.name=/^(confirm|alert)$/]',
          message:
            'window.confirm/alert 직접 호출 금지 — confirmAction/showAlert (@/utils) 경유 (네이티브 분기 일관성).',
        },
        // 정산 동결값 SSOT 가드 (2026-07-27, SETTLE-5)
        // `payrollAmount > 0` 로 동결값을 판정하면 **정산 0원 완료 건**(노쇼 등)이 재계산
        // fallback 으로 새어나가, 같은 근무 1건이 화면마다 다른 금액으로 보인다. 실제로
        // 5곳이 같은 방식으로 어긋나 있었고 헬퍼는 주석으로 이 패턴을 금지해 뒀는데도
        // 소비처 전부가 우회했다 — 사람 기억 대신 기계로 막는다.
        {
          selector:
            'BinaryExpression[operator=">"][left.property.name="payrollAmount"][right.value=0]',
          message:
            'payrollAmount > 0 로 동결값을 판정하지 마세요 — 0원 완료 건이 재계산으로 새어나갑니다. shouldUseFrozenPayrollAmount (@/utils/settlementGrouping) 를 쓰세요.',
        },
      ],
    },
  },

  // 4e. Alert 웹 no-op 가드 예외 — 플랫폼 분기 유틸 자신만 원시 API 사용 허용
  {
    files: ['src/utils/confirmAction.ts', 'src/utils/showAlert.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },

  // 5. 테스트 파일 오버라이드
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // 6. Prettier (마지막에 적용하여 충돌 규칙 비활성화)
  eslintConfigPrettier,

  // 7. 무시 패턴
  {
    ignores: [
      'node_modules/',
      'dist/',
      'dist-build-check/',
      'dist-e2e/',
      'dist-e2e-emu/',
      'build/',
      '.expo/',
      'android/',
      'ios/',
      '*.d.ts',
      'coverage/',
      'playwright-report/',
      'functions/',
      'supabase/functions/',
      'scripts/',
      'e2e/',
    ],
  },
];
