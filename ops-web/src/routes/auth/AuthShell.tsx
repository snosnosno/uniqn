import type { ReactNode } from 'react';
import { Link } from 'react-router';

/** 인증 화면 공통 틀 — 가운데 한 열, 괘선 패널(DESIGN.md: 그림자 없음·모서리 2px). */
export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[400px] flex-col justify-center gap-6 px-4 py-10">
      <p className="font-mono text-xs font-semibold tracking-[0.2em] text-accent-text">UNIQN OPS</p>
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] leading-tight font-bold">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="flex flex-col gap-4 border border-border bg-card p-5">{children}</div>
    </main>
  );
}

/** 라벨 + 입력 + 필드 에러. 에러는 aria-describedby 로 입력칸에 연결한다. */
export function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** 폼 전체 에러(서버 응답). 스크린리더가 바로 읽도록 role=alert. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="border border-destructive/60 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}

/** 터치 타깃 44px 을 지키는 글자 링크(DESIGN.md 간격 — 최소 44px). */
const TEXT_LINK = 'inline-flex min-h-11 items-center text-sm underline-offset-4 hover:underline';

export function TextLink({
  to,
  children,
  muted = false,
}: {
  to: string;
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`${TEXT_LINK} ${muted ? 'text-muted-foreground' : 'text-accent-text'}`}
    >
      {children}
    </Link>
  );
}

/** 새 창으로 여는 외부 링크 — 새 창임을 스크린리더에도 알린다. */
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${TEXT_LINK} text-muted-foreground`}
    >
      {children}
      <span aria-hidden="true">&nbsp;↗</span>
      <span className="sr-only">(새 창)</span>
    </a>
  );
}
