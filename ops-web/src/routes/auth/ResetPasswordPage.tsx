import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FullScreenLoading } from '@/components/FullScreenLoading';
import { useAuth } from '@/auth/authContext';
import { DEFAULT_AFTER_LOGIN } from '@/auth/redirect';
import { passwordSchema } from '@/core/schemas/auth.schema';
import { useSignOut } from '@/hooks/useSignOut';
import { toUserMessage } from '@/lib/errorMessage';
import { focusFirstError, toFieldErrors } from '@/lib/formErrors';
import { supabase } from '@/lib/supabase';
import { updatePassword } from '@/repositories/authRepository';
import { AuthShell, Field, FormError, TextLink } from './AuthShell';

/** 모바일 비밀번호 정책(동기화 사본) + 확인 일치. */
const newPasswordSchema = z
  .object({ password: passwordSchema, passwordConfirm: z.string() })
  .refine((v) => v.password === v.passwordConfirm, {
    message: '비밀번호가 일치하지 않습니다',
    path: ['passwordConfirm'],
  });

const FIELD_ORDER = ['password', 'passwordConfirm'] as const;

/**
 * 재설정 메일 링크의 도착 화면. supabase-js 가 URL 의 토큰으로 recovery 세션을 만든다(detectSessionInUrl).
 *
 * 🔒 폼은 **recovery 세션에서만** 연다. 일반 로그인 세션에 열어 두면 현장 공용 PC 에 로그인된 채
 *    남은 콘솔에서 누구든 주소만 쳐서 현재 비밀번호 없이 UNIQN 계정 비밀번호를 바꿀 수 있다(리뷰 W2).
 *    만료된 링크를 이미 로그인된 브라우저에서 열어도 supabase-js 는 기존 세션을 유지하므로 같은 분기로 간다.
 */
export function Component() {
  const auth = useAuth();
  const navigate = useNavigate();
  const signOut = useSignOut();
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const update = useMutation({
    mutationFn: (value: string) => updatePassword(supabase, value),
    onSuccess: () => {
      toast.success('비밀번호를 바꿨어요');
      navigate(DEFAULT_AFTER_LOGIN, { replace: true });
    },
  });

  if (auth.status === 'loading') return <FullScreenLoading />;

  if (auth.status === 'signedOut') {
    return (
      <AuthShell
        title="링크가 만료됐어요"
        description="재설정 링크는 한 번만, 짧은 시간 동안 쓸 수 있어요. 다시 요청해 주세요."
      >
        <TextLink to="/forgot-password">재설정 링크 다시 받기</TextLink>
      </AuthShell>
    );
  }

  if (!auth.recovery) {
    return (
      <AuthShell
        title="재설정 링크로 들어와 주세요"
        description="비밀번호는 메일로 받은 재설정 링크에서만 바꿀 수 있어요. 링크가 만료됐다면 로그아웃한 뒤 '비밀번호 찾기'로 다시 받아 주세요."
      >
        <Button size="lg" onClick={() => navigate(DEFAULT_AFTER_LOGIN)}>
          콘솔로 돌아가기
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() => signOut.mutate()}
          disabled={signOut.isPending}
        >
          로그아웃
        </Button>
      </AuthShell>
    );
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = newPasswordSchema.safeParse({ password, passwordConfirm });
    if (!parsed.success) {
      const errors = toFieldErrors(parsed.error);
      setFieldErrors(errors);
      focusFirstError(errors, FIELD_ORDER);
      return;
    }
    setFieldErrors({});
    update.mutate(parsed.data.password);
  };

  return (
    <AuthShell
      title="새 비밀번호"
      description="8자 이상, 대문자·소문자·숫자·특수문자를 모두 넣어 주세요. UNIQN 앱에도 같이 적용돼요."
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        {/* 비밀번호 관리자가 어느 계정의 비밀번호인지 알 수 있게 숨은 이메일 칸을 둔다. */}
        <input
          type="email"
          autoComplete="username"
          value={auth.session.user.email ?? ''}
          readOnly
          hidden
        />
        <Field id="password" label="새 비밀번호" error={fieldErrors.password}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
          />
        </Field>
        <Field id="passwordConfirm" label="새 비밀번호 확인" error={fieldErrors.passwordConfirm}>
          <Input
            id="passwordConfirm"
            type="password"
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            aria-invalid={Boolean(fieldErrors.passwordConfirm)}
            aria-describedby={fieldErrors.passwordConfirm ? 'passwordConfirm-error' : undefined}
          />
        </Field>
        <FormError message={update.isError ? toUserMessage(update.error) : null} />
        <Button type="submit" size="lg" disabled={update.isPending}>
          {update.isPending ? '바꾸는 중…' : '비밀번호 바꾸기'}
        </Button>
      </form>
    </AuthShell>
  );
}
