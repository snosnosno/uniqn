/**
 * 계정 연결(claim) — 모바일 live/[view_token].tsx 의 PIN 게이트 + 로그인 CTA.
 * ops 도메인에선 uniqn.app 로그인이 이어지지 않으므로(설계 §7 M3) 비로그인이면
 * ops 로그인으로 보냈다가 이 화면(/live/:token)으로 돌아온다.
 * PIN 8자·비가역 바인딩 — 연결 후엔 직접 해제할 수 없다(운영자만).
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '@/auth/authContext';
import { buildLoginPath } from '@/auth/redirect';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import * as opsPlayerService from '@/core/services/ops/opsPlayerService';
import { toUserMessage } from '@/lib/errorMessage';
import { requireOnline } from '@/lib/online';
import { trackOpsFunnel } from '@/repositories/analyticsRepository';
import { normalizePin } from './publicGate';

export function ClaimSection({ token }: { token: string }) {
  const auth = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const userId = auth.status === 'signedIn' ? auth.session.user.id : null;
  const claim = useMutation({
    mutationKey: ['ops', 'ops.claimParticipant'],
    mutationFn: (claimPin: string) => {
      requireOnline('ops.claimParticipant');
      if (!userId) throw new Error('로그인이 필요합니다');
      return opsPlayerService.claimParticipant(token, claimPin, userId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['public', 'player', token] });
      trackOpsFunnel('ops_claim_converted', { tk: token.slice(0, 8) });
      toast.success('내 계정에 연결했습니다');
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  if (!userId) {
    return (
      <section className="flex flex-col items-center gap-3 border-t px-[18px] py-5 text-center">
        <p className="text-sm text-muted-foreground">
          로그인하면 이 대회 참가 기록이 내 계정에 연결돼요.
        </p>
        <Button asChild size="lg" className="w-full">
          <Link to={buildLoginPath(`/live/${token}`)}>로그인하고 연결하기</Link>
        </Button>
      </section>
    );
  }

  const submit = () => {
    if (pin.length !== 8 || claim.isPending) return;
    setOpen(false);
    claim.mutate(pin, { onSettled: () => setPin('') });
  };

  return (
    <section className="border-t px-[18px] py-5">
      <Button size="lg" className="w-full" disabled={claim.isPending} onClick={() => setOpen(true)}>
        {claim.isPending ? '연결 중…' : '내 계정에 연결하기'}
      </Button>
      <Dialog open={open} onOpenChange={(o) => (setOpen(o), !o && setPin(''))}>
        <DialogContent className="max-w-[380px]">
          <DialogHeader>
            <DialogTitle>내 계정에 연결</DialogTitle>
            <DialogDescription>
              슬립에 적힌 8자리 연결 PIN을 입력해주세요. 연결 후에는 직접 해제할 수 없어요(잘못
              연결했다면 운영자에게 문의).
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Input
              autoFocus
              aria-label="연결 PIN"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              placeholder="예: 7F3K9A2C"
              value={pin}
              onChange={(e) => setPin(normalizePin(e.target.value))}
              className="num h-12 text-center text-lg tracking-widest"
            />
            <DialogFooter className="mt-4">
              <Button type="submit" size="lg" disabled={pin.length !== 8 || claim.isPending}>
                연결하기
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
