import { Link, Outlet } from 'react-router';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/authContext';
import { useSignOut } from '@/hooks/useSignOut';

/** 로그인 후 공통 틀 — 상단 한 줄(서비스명·계정·로그아웃). 콘솔 셸은 W4 에서 이 안에 들어간다. */
export function AppLayout() {
  const auth = useAuth();
  const signOut = useSignOut();
  const email = auth.status === 'signedIn' ? auth.session.user.email : undefined;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-12 items-center gap-3 border-b border-border px-4">
        <Link
          to="/tournaments"
          className="font-mono text-xs font-semibold tracking-[0.2em] text-accent-text"
        >
          UNIQN OPS
        </Link>
        <span className="ml-auto truncate text-xs text-muted-foreground">{email}</span>
        <Button
          variant="ghost"
          className="h-11"
          onClick={() => signOut.mutate()}
          disabled={signOut.isPending}
        >
          로그아웃
        </Button>
      </header>
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}
