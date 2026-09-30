import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FullScreenLoading } from '@/components/FullScreenLoading';
import { useAuth } from '@/auth/authContext';
import { normalizeOpsRedirect } from '@/auth/redirect';
import { loginSchema } from '@/core/schemas/auth.schema';
import { toUserMessage } from '@/lib/errorMessage';
import { focusFirstError, toFieldErrors } from '@/lib/formErrors';
import { supabase } from '@/lib/supabase';
import { UNIQN_SIGNUP_URL } from '@/lib/links';
import { signInWithPassword } from '@/repositories/authRepository';
import { AuthShell, ExternalLink, Field, FormError, TextLink } from './AuthShell';

const FIELD_ORDER = ['email', 'password'] as const;

export function Component() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = normalizeOpsRedirect(params.get('redirect'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const login = useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      signInWithPassword(supabase, input.email, input.password),
    onSuccess: () => navigate(redirect, { replace: true }),
  });

  if (auth.status === 'loading') return <FullScreenLoading />;
  // 이미 로그인돼 있으면 폼을 보여주지 않는다(재설정 링크 세션은 가드가 재설정 화면으로 보낸다).
  if (auth.status === 'signedIn' && !login.isPending) {
    return <Navigate to={redirect} replace />;
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errors = toFieldErrors(parsed.error);
      setFieldErrors(errors);
      focusFirstError(errors, FIELD_ORDER);
      return;
    }
    setFieldErrors({});
    login.mutate(parsed.data);
  };

  return (
    <AuthShell title="로그인" description="UNIQN 계정으로 대회 운영 콘솔에 들어갑니다.">
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
        <Field id="password" label="비밀번호" error={fieldErrors.password}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
          />
        </Field>
        <FormError message={login.isError ? toUserMessage(login.error) : null} />
        <Button type="submit" size="lg" disabled={login.isPending}>
          {login.isPending ? '확인 중…' : '로그인'}
        </Button>
      </form>
      <div className="flex items-center justify-between">
        <TextLink to="/forgot-password">비밀번호 찾기</TextLink>
        <ExternalLink href={UNIQN_SIGNUP_URL}>회원가입은 UNIQN 에서</ExternalLink>
      </div>
    </AuthShell>
  );
}
