import { Button } from '@/components/ui/button';
import { UNIQN_WEB_ORIGIN } from '@/lib/links';
import { AuthShell } from '@/routes/auth/AuthShell';
import type { IncompleteStep } from './entry';

const STEP_TEXT: Record<IncompleteStep, string> = {
  signup: '가입 절차(본인인증)가 아직 끝나지 않았어요.',
  reverify: '본인인증을 한 번 더 해야 해요.',
  profile: '닉네임 등 프로필 설정이 남아 있어요.',
};

/** 로그인은 됐지만 UNIQN 가입을 마치지 않은 계정 — 설계 §4.2. ops 웹은 가입 화면을 두지 않는다. */
export function IncompleteAccount({
  step,
  onRecheck,
  rechecking,
  onSignOut,
  signingOut,
}: {
  step: IncompleteStep;
  onRecheck: () => void;
  rechecking: boolean;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  return (
    <AuthShell
      title="가입을 마무리해 주세요"
      description={
        <>
          {STEP_TEXT[step]} UNIQN 앱이나 웹에서 가입을 마무리한 뒤 아래 '다시 확인'을 눌러 주세요.
        </>
      }
    >
      <Button asChild size="lg">
        <a href={UNIQN_WEB_ORIGIN} target="_blank" rel="noopener noreferrer">
          UNIQN 에서 마무리하기 <span aria-hidden="true">↗</span>
          <span className="sr-only">(새 창)</span>
        </a>
      </Button>
      <Button size="lg" variant="outline" onClick={onRecheck} disabled={rechecking}>
        {rechecking ? '확인 중…' : '다시 확인'}
      </Button>
      <Button size="lg" variant="ghost" onClick={onSignOut} disabled={signingOut}>
        {signingOut ? '로그아웃 중…' : '로그아웃'}
      </Button>
    </AuthShell>
  );
}
