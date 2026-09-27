import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Storybook 전용 Vite 설정 — 앱의 vite.config.ts(빌드 가드 포함)와 분리한다.
 * 스토리는 Supabase 를 쓰지 않아 가드할 대상이 없고, `storybook build` 는 production 모드라
 * 앱 설정을 쓰면 가드가 URL 부재로 막는다. 앱 빌드 경로의 가드는 그대로다(우회 아님).
 * ⚠️ 스토리에서 @/lib/supabase 를 import 하지 말 것 — env 없이 부팅 실패한다.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, '../src') },
  },
});
