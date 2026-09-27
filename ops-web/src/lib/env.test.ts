import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

describe('parseEnv', () => {
  it('URL 과 anon 키가 있으면 통과한다', () => {
    const env = parseEnv({
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: 'anon',
    });
    expect(env.VITE_SUPABASE_URL).toBe('http://127.0.0.1:54321');
  });

  it('값이 빠지면 키 이름을 담아 실패한다', () => {
    expect(() => parseEnv({ VITE_SUPABASE_URL: 'http://127.0.0.1:54321' })).toThrow(
      /VITE_SUPABASE_ANON_KEY/
    );
  });

  it('URL 형식이 틀리면 실패한다', () => {
    expect(() => parseEnv({ VITE_SUPABASE_URL: 'nope', VITE_SUPABASE_ANON_KEY: 'anon' })).toThrow(
      /VITE_SUPABASE_URL/
    );
  });
});
