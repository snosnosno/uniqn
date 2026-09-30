import { Navigate, Outlet, useLocation } from 'react-router';
import { Button } from '@/components/ui/button';
import { FullScreenLoading } from '@/components/FullScreenLoading';
import { useOpsEntry } from '@/hooks/useOpsEntry';
import { useSignOut } from '@/hooks/useSignOut';
import { toUserMessage } from '@/lib/errorMessage';
import { AuthShell } from '@/routes/auth/AuthShell';
import { useAuth } from './authContext';
import { IncompleteAccount } from './IncompleteAccount';
import { buildLoginPath } from './redirect';

/**
 * 콘솔 라우트 가드 — 설계 §4.1. **UX 용**이다: 데이터 보호는 RLS 가 한다.
 * - 비로그인 → /login?redirect=<현재 경로>
 * - 재설정 링크 세션(recovery) → 비밀번호부터 바꾸게 /reset-password (링크를 콘솔 출입증으로 쓰지 않는다)
 * - 가입 미완료 → 안내 화면
 */
export function RequireAuth() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === 'loading') return <FullScreenLoading />;
  if (auth.status === 'signedOut') {
    const current = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={buildLoginPath(current)} replace />;
  }
  if (auth.recovery) return <Navigate to="/reset-password" replace />;
  return <EntryGate userId={auth.session.user.id} />;
}

function EntryGate({ userId }: { userId: string }) {
  const entry = useOpsEntry(userId);
  const signOut = useSignOut();

  if (entry.isPending) return <FullScreenLoading />;
  if (entry.isError) {
    return (
      <AuthShell title="계정 정보를 불러오지 못했어요" description={toUserMessage(entry.error)}>
        <Button size="lg" onClick={() => entry.refetch()}>
          다시 시도
        </Button>
      </AuthShell>
    );
  }
  if (entry.data.kind === 'incomplete') {
    return (
      <IncompleteAccount
        step={entry.data.step}
        onRecheck={() => entry.refetch()}
        rechecking={entry.isFetching}
        onSignOut={() => signOut.mutate()}
        signingOut={signOut.isPending}
      />
    );
  }
  return <Outlet />;
}
