import { useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';
import { canConfirm } from '@/lib/keyGuards';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** 판단에 필요한 결과(순위·상금·좌석)를 미리 보여준다 — 확인 자체가 정보가 되게(DESIGN.md). */
  children: ReactNode;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
}

/**
 * 운영 확인창 — Enter 확정 · Esc 취소(사용자 결정 2026-09-28).
 * 열리면 확정 버튼에 포커스가 가서 Enter 한 번으로 끝난다. Esc 는 Radix 기본 동작.
 *
 * 오조작 가드(D1 코드 리뷰 H3): 확정 버튼 기본 포커스 + Enter 는 위험 조합이라
 * ① 키 자동반복(누르고 있기) 무시 ② 열린 뒤 150ms 무장 ③ 한 번 열림당 한 번만 확정 — 이중 RPC 방지.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  children,
  confirmLabel,
  tone = 'danger',
  onConfirm,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const openedAtRef = useRef(0);
  const confirmedRef = useRef(false);

  const handleConfirm = () => {
    const allowed = canConfirm({
      openedAt: openedAtRef.current,
      now: Date.now(),
      repeat: false,
      alreadyConfirmed: confirmedRef.current,
    });
    if (!allowed) return;
    confirmedRef.current = true;
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[420px] gap-3"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          openedAtRef.current = Date.now();
          confirmedRef.current = false;
          confirmRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div className="text-sm leading-relaxed">{children}</div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소 <Kbd>Esc</Kbd>
          </Button>
          <Button
            ref={confirmRef}
            variant={tone === 'danger' ? 'destructive' : 'default'}
            onClick={handleConfirm}
            onKeyDown={(event) => {
              // 누르고 있는 Enter 의 자동반복이 click 으로 바뀌지 않게 막는다
              if (event.repeat) event.preventDefault();
            }}
          >
            {confirmLabel} <Kbd>Enter</Kbd>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
