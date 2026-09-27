/// <reference types="vitest/config" />
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { assertSafeSupabaseTarget } from './config/envGuard.ts';

// https://vite.dev/config/
export default defineConfig(({ command, mode, isPreview }) => {
  // 가드 제외 2가지만 허용한다:
  // - vitest(mode=test): Supabase 에 붙지 않는다. `VITEST=1 npm run build:prod` 같은 우회는 mode 로 막힌다.
  // - preview: 이미 만들어진 번들을 서빙할 뿐이라 가드할 대상이 없다(검사는 build 때 끝났다).
  const isVitest = Boolean(process.env.VITEST) && mode === 'test';
  if (!isVitest && !isPreview) {
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    // dev 서버도 막는다 — 로컬에서 prod 에 붙는 것이 가장 흔한 사고 경로다.
    assertSafeSupabaseTarget({
      mode: command === 'serve' ? 'development' : mode,
      url: env.VITE_SUPABASE_URL,
    });
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    build: {
      // 끈다: 'hidden' 도 .map 이 dist 에 남아 그대로 배포·공개된다(W0 리뷰).
      // 에러 수집 도구를 붙일 때 업로드 후 삭제하는 파이프라인과 함께 다시 켠다.
      sourcemap: false,
    },
    test: {
      include: ['src/**/*.test.{ts,tsx}', 'config/**/*.test.ts'],
      environment: 'node',
    },
  };
});
