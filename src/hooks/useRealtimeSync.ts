import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * useRealtimeSync — live workspace updates.
 *
 * Subscribes to Postgres changes (INSERT/UPDATE/DELETE) on every workspace
 * table and refreshes the react-query cache, so whatever screen is open
 * updates within ~a second of any teammate's change — no pull-to-refresh.
 *
 * How it stays safe & cheap:
 * - Delivery is RLS-gated server-side (Supabase Realtime only sends rows the
 *   subscriber can SELECT), so cross-org data never reaches a client.
 * - Requires the tables to be members of the `supabase_realtime` publication
 *   (see supabase/migrations/0004_realtime.sql).
 * - Events are debounced: a burst of writes from one mutation cascade
 *   (task + activity_log + notification) results in a single refetch pass.
 * - Refetching is SELECT-only, so there is no write -> event -> write loop.
 * - Realtime errors are caught and logged only: a flaky websocket never
 *   crashes the app or blocks the UI.
 */

const TABLES = [
  'activity_logs',
  'ai_conversations',
  'ai_messages',
  'audit_findings',
  'audits',
  'compliance_assessments',
  'evidence',
  'evidence_control_links',
  'evidence_versions',
  'framework_controls',
  'frameworks',
  'invitations',
  'notifications',
  'organization_memberships',
  'organizations',
  'profiles',
  'risk_history',
  'risks',
  'task_comments',
  'tasks',
] as const;

const DEBOUNCE_MS = 400;

export function useRealtimeSync(enabled: boolean): void {
  const queryClient = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let channel: any = null;
    try {
      const flush = () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          timer.current = null;
          // Invalidate every query: active ones refetch now, inactive ones are
          // stale for the next mount. Keeps all screens coherent with zero
          // per-screen wiring.
          queryClient.invalidateQueries();
        }, DEBOUNCE_MS);
      };

      channel = supabase.channel('aegis-workspace-sync');
      for (const table of TABLES) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table }, flush);
      }

      channel.on('error', (err: any) => {
        // Realtime websocket hiccups must never bring down the UI. Log and
        // keep going — the app remains fully functional without live sync.
        console.warn('[AEGIS] Realtime channel error:', err?.message ?? err);
      });

      // subscribe() returns a Subscription; no callback argument in supabase-js v2.
      channel.subscribe();

    } catch (e: any) {
      // If Realtime isn't available on this project, silently degrade.
      console.warn('[AEGIS] Realtime sync unavailable:', e?.message ?? e);
    }

    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      if (channel) {
        try { void supabase.removeChannel(channel); } catch { /* ignore */ }
      }
    };
  }, [enabled, queryClient]);
}
