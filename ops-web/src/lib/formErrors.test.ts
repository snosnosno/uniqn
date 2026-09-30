import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { toFieldErrors } from './formErrors';

describe('toFieldErrors', () => {
  it('필드마다 첫 메시지만', () => {
    const schema = z.object({
      a: z.string().min(2, 'a짧음').max(1, 'a김'),
      b: z.string().min(1, 'b필수'),
    });
    const result = schema.safeParse({ a: 'x', b: '' });
    expect(result.success).toBe(false);
    if (!result.success) expect(toFieldErrors(result.error)).toEqual({ a: 'a짧음', b: 'b필수' });
  });
});
