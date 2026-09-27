import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { toUserMessage } from '@/lib/errorMessage';
import { signOut } from '@/repositories/authRepository';

export function useSignOut() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => signOut(supabase),
    onSuccess: () => navigate('/login', { replace: true }),
    onError: (error) => toast.error(toUserMessage(error)),
  });
}
