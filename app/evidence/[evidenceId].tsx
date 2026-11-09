import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { useCurrentOrg } from '@/hooks/useOrg';
import { fetchEvidence, signedEvidenceUrl, deleteEvidence } from '@/services/api';
import { evidenceHealth, healthTone, fmtDate, logActivity } from '@/lib/format';
import { colors, spacing } from '@/lib/design-tokens';

export default function EvidenceDetail(){
  const { evidenceId } = useLocalSearchParams<{ evidenceId: string }>();
  const r = useRouter();
  const qc = useQueryClient();
  const { data: org } = useCurrentOrg();
  const [busy, setBusy] = useState(false);

  const { data: evidence } = useQuery({
    enabled: !!org?.orgId, queryKey: ['evidence', org?.orgId], queryFn: () => fetchEvidence(org!.orgId),
  });
  const item = (evidence ?? []).find((e: any) => e.id === evidenceId) as any;

  const open = async () => {
    if (!item?.file_path) return;
    setBusy(true);
    try {
      const url = await signedEvidenceUrl(item.file_path);
      await WebBrowser.openBrowserAsync(url);
    } catch (e: any) { Alert.alert('Could not open', e?.message ?? 'Try again.'); }
    finally { setBusy(false); }
  };

  const download = async () => {
    if (!item?.file_path) return;
    setBusy(true);
    try {
      const url = await signedEvidenceUrl(item.file_path);
      const dest = `${FileSystem.cacheDirectory}${item.title.replace(/[^a-zA-Z0-9._-]/g, '_')}.${item.type ?? 'bin'}`;
      const res = await FileSystem.downloadAsync(url, dest);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(res.uri, { mimeType: item.mime_type ?? undefined, dialogTitle: item.title });
      }
    } catch (e: any) { Alert.alert('Download failed', e?.message ?? 'Try again.'); }
    finally { setBusy(false); }
  };

  const remove = () => {
    Alert.alert('Delete evidence', `Delete “${item.title}” permanently? Linked controls lose this evidence.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await deleteEvidence(item.id, item.file_path);
          await logActivity(org!.orgId, 'evidence_deleted', 'evidence', item.id, { title: item.title });
          qc.invalidateQueries({ queryKey: ['evidence'] });
          r.back();
        } catch (e: any) { Alert.alert('Delete failed', e?.message ?? 'Try again.'); }
      } },
    ]);
  };

  if (!item) return <Screen style={{ paddingTop: spacing.xl }}><Text style={{ color: colors.textMuted }}>Loading evidence…</Text></Screen>;

  const h = evidenceHealth(item.expiry_date);

  return (
    <ScrollView style={{ flex:1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingTop: 12, paddingBottom: 40, paddingHorizontal: spacing.md, gap: spacing.md, maxWidth: 760, width:'100%', alignSelf:'center' }}>
      <Pressable onPress={()=> r.back()}><Text style={{ color: colors.navy, fontWeight:'600' }}>‹ Back to library</Text></Pressable>

      <View style={{ gap:6 }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <Text style={{ fontSize:20, fontWeight:'800', color: colors.navy, flex:1 }}>📄 {item.title}</Text>
          <Badge label={h === 'none' ? 'No expiry' : h === 'valid' ? 'Valid' : h === 'expiring' ? 'Expiring soon' : 'Expired'} tone={healthTone(h)} />
        </View>
        <Text style={{ color: colors.textMuted, fontSize:12 }}>Status: {item.status} · {item.type ? `${String(item.type).toUpperCase()} · ` : ''}{item.file_size ? `${Math.round(item.file_size / 1024)} KB · ` : ''}Added {fmtDate(item.created_at)}</Text>
      </View>

      <View style={{ flexDirection:'row', gap:8 }}>
        <View style={{ flex:1 }}><Button title={busy ? 'Working…' : 'Open'} loading={busy} onPress={open} /></View>
        <View style={{ flex:1 }}><Button title="Download / Share" variant="secondary" onPress={download} /></View>
      </View>

      {item.description ? <Card><Text style={{ fontWeight:'700', marginBottom:4 }}>Description</Text><Text style={{ lineHeight:20 }}>{item.description}</Text></Card> : null}

      <Card style={{ gap:6 }}>
        <Text style={{ fontWeight:'700' }}>Details</Text>
        <Text style={{ fontSize:13, color: colors.textMuted }}>Expiry / review date: {item.expiry_date ? fmtDate(item.expiry_date) : 'None set'}</Text>
        <Text style={{ fontSize:13, color: colors.textMuted }}>Uploaded by: {item.owner?.full_name ?? 'Unknown'}</Text>
        <Text style={{ fontSize:13, color: colors.textMuted }}>Linked controls: {item.links?.length ?? 0}</Text>
        <Text style={{ fontSize:13, color: colors.textMuted }}>Version: v{(item.links?.length ?? 0) + 1} (latest)</Text>
      </Card>

      <Button title="Delete Evidence" variant="secondary" onPress={remove} style={{ borderColor: colors.red }} />
    </ScrollView>
  );
}
