import { describe, expect, it } from 'vitest';
import { assertSafeSupabaseTarget, PROD_SUPABASE_PROJECT_REF } from './envGuard.ts';

const PROD_URL = `https://${PROD_SUPABASE_PROJECT_REF}.supabase.co`;
const LOCAL_URL = 'http://127.0.0.1:54321';

describe('assertSafeSupabaseTarget', () => {
  it('개발 모드 + 로컬 URL 은 통과한다', () => {
    expect(() => assertSafeSupabaseTarget({ mode: 'development', url: LOCAL_URL })).not.toThrow();
  });

  it('운영 모드 + prod URL 은 통과한다', () => {
    expect(() => assertSafeSupabaseTarget({ mode: 'production', url: PROD_URL })).not.toThrow();
  });

  it('운영이 아닌 모드에서 prod URL 을 쓰면 실패한다', () => {
    expect(() => assertSafeSupabaseTarget({ mode: 'development', url: PROD_URL })).toThrow(
      /운영이 아닌 빌드/
    );
    expect(() => assertSafeSupabaseTarget({ mode: 'staging', url: PROD_URL })).toThrow();
  });

  it('운영 모드에서 로컬 URL 을 쓰면 실패한다', () => {
    expect(() => assertSafeSupabaseTarget({ mode: 'production', url: LOCAL_URL })).toThrow(
      /운영 빌드/
    );
    expect(() =>
      assertSafeSupabaseTarget({ mode: 'production', url: 'http://localhost:54321' })
    ).toThrow();
  });

  it('URL 이 비어 있거나 형식이 틀리면 실패한다', () => {
    expect(() => assertSafeSupabaseTarget({ mode: 'development', url: undefined })).toThrow(
      /VITE_SUPABASE_URL/
    );
    expect(() => assertSafeSupabaseTarget({ mode: 'development', url: 'not-a-url' })).toThrow();
  });

  it('끝에 점을 붙인 prod 호스트도 prod 로 판정한다(리뷰 M2)', () => {
    expect(() => assertSafeSupabaseTarget({ mode: 'development', url: `${PROD_URL}.` })).toThrow(
      /운영이 아닌 빌드/
    );
    expect(() =>
      assertSafeSupabaseTarget({ mode: 'development', url: PROD_URL.toUpperCase() })
    ).toThrow();
  });

  it('운영 빌드는 prod 호스트만 허용한다(리뷰 M3)', () => {
    expect(() =>
      assertSafeSupabaseTarget({ mode: 'production', url: `${PROD_URL}.` })
    ).not.toThrow();
    expect(() =>
      assertSafeSupabaseTarget({ mode: 'production', url: 'https://other-project.supabase.co' })
    ).toThrow(/운영 빌드/);
    expect(() =>
      assertSafeSupabaseTarget({ mode: 'production', url: 'http://localhost.:54321' })
    ).toThrow();
  });

  it('prod ref 를 부분 문자열로 속이는 호스트는 prod 로 보지 않는다', () => {
    const lookalike = `https://${PROD_SUPABASE_PROJECT_REF}.supabase.co.evil.example`;
    expect(() => assertSafeSupabaseTarget({ mode: 'development', url: lookalike })).not.toThrow();
  });
});
