import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { resetPasswordSchema } from '@/core/schemas/auth.schema';
import { toUserMessage } from '@/lib/errorMessage';
import { focusFirstError, toFieldErrors } from '@/lib/formErrors';
import { supabase } from '@/lib/supabase';
import { requestPasswordReset } from '@/repositories/authRepository';
import { AuthShell, Field, FormError, TextLink } from './AuthShell';

export function Component() {
  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const request = useMutation({
    mutationFn: (value: string) => requestPasswordReset(supabase, value, window.location.origin),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = resetPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      const errors = toFieldErrors(parsed.error);
      setFieldErrors(errors);
      focusFirstError(errors, ['email']);
      return;
    }
    setFieldErrors({});
    request.mutate(parsed.data.email);
  };

  if (request.isSuccess) {
    return (
      <AuthShell
        title="메일을 확인해 주세요"
        description="가입된 이메일이라면 비밀번호 재설정 링크를 보냈어요. 링크는 이 기기의 브라우저에서 열어 주세요."
      >
        <TextLink to="/login">로그인으로 돌아가기</TextLink>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="비밀번호 찾기" description="가입한 이메일로 재설정 링크를 보내 드려요.">
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <Field id="email" label="이메일" error={fieldErrors.email}>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          />
        </Field>
        <FormError message={request.isError ? toUserMessage(request.error) : null} />
        <Button type="submit" size="lg" disabled={request.isPending}>
          {request.isPending ? '보내는 중…' : '재설정 링크 보내기'}
        </Button>
      </form>
      <TextLink to="/login" muted>
        로그인으로 돌아가기
      </TextLink>
    </AuthShell>
  );
}
