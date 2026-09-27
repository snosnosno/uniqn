import type { StorybookConfig } from '@storybook/react-vite';

/**
 * 컴포넌트 작업대 — 디자인 토큰은 src/index.css, 정본은 DESIGN.md.
 * Vite 설정은 .storybook/vite.config.ts(가드 없는 최소 설정)를 쓴다 — 이유는 그 파일 주석.
 */
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  framework: {
    name: '@storybook/react-vite',
    options: { builder: { viteConfigPath: '.storybook/vite.config.ts' } },
  },
  core: { disableTelemetry: true },
};

export default config;
