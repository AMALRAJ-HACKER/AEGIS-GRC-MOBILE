
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface OrgContext {
  orgId: string;
  role: string;
  org: any;
  profile: any;
  userId: string;
}

/** Current user's active organization, role, and profile — the context every screen needs. */
export function useCurrentOrg(){
  return useQuery({
    queryKey: ['currentOrg'],
    queryFn: async (): Promise<OrgContext> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      const { data: membership } = await supabase
        .from('organization_memberships')
        .select('role, organization_id, organizations(*)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

      return {
        orgId: membership?.organization_id ?? '',
        role: membership?.role ?? 'staff',
        org: membership?.organizations ?? null,
        profile: profile ?? null,
        userId: user.id,
      };
    },
    staleTime: 60_000,
  });
}
