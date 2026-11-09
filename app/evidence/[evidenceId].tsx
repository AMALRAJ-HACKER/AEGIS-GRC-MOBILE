import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { SwipeBackContainer } from '@/components/navigation/SwipeBackContainer';
import { useCurrentOrg } from '@/hooks/useOrg';
import { useResponsive } from '@/lib/responsive';
import { fetchEvidence, signedEvidenceUrl, deleteEvidence } from '@/services/api';
import { evidenceHealth, healthTone, fmtDate, logActivity } from '@/lib/format';
import { spacing } from '@/lib/design-tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { ChevronLeftIcon } from '@/components/icons/ActionIcons';

export default function EvidenceDetail() {
  const { evidenceId } = useLocalSearchParams<{ evidenceId: string }>();
  const r = useRouter();
  const qc = useQueryClient();
  const { data: org } = useCurrentOrg();
  const { colors, isDark } = useTheme();
  const { topInset, bottomInset, hPad, maxContent } = useResponsive();
  const [busy, setBusy] = useState(false);

  const { data: evidence, isLoading: evidenceLoading } = useQuery({
    enabled: !!org?.orgId,
    queryKey: ['evidence', org?.orgId],
    queryFn: () => fetchEvidence(org!.orgId),
  });
  const item = (evidence ?? []).find((e: any) => e.id === evidenceId) as any;

  // Detect if file is an image (e.g. evidence.webp, .png, .jpg)
  const isImage =
    ['webp', 'png', 'jpg', 'jpeg', 'gif', 'svg'].includes(String(item?.type ?? '').toLowerCase()) ||
    Boolean(item?.mime_type?.startsWith('image/')) ||
    Boolean(item?.file_path?.match(/\.(webp|png|jpe?g|gif|svg)$/i)) ||
    Boolean(item?.title?.match(/\.(webp|png|jpe?g|gif|svg)$/i));

  // Auto-fetch signed URL for preview if file is an image
  const { data: previewUrl, isLoading: previewLoading } = useQuery({
    enabled: !!item?.file_path && isImage,
    queryKey: ['evidencePreview', item?.file_path],
    queryFn: () => signedEvidenceUrl(item!.file_path),
  });

  const open = async () => {
    if (!item?.file_path) return;
    setBusy(true);
    try {
      const url = previewUrl || (await signedEvidenceUrl(item.file_path));
      await WebBrowser.openBrowserAsync(url);
    } catch (e: any) {
      Alert.alert('Could not open', e?.message ?? 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    if (!item?.file_path) return;
    setBusy(true);
    try {
      const url = previewUrl || (await signedEvidenceUrl(item.file_path));
      const dest = `${FileSystem.cacheDirectory}${item.title.replace(/[^a-zA-Z0-9._-]/g, '_')}.${item.type ?? 'bin'}`;
      const res = await FileSystem.downloadAsync(url, dest);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(res.uri, {
          mimeType: item.mime_type ?? undefined,
          dialogTitle: item.title,
        });
      }
    } catch (e: any) {
      Alert.alert('Download failed', e?.message ?? 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    Alert.alert(
      'Delete evidence',
      `Delete “${item.title}” permanently? Linked controls will lose this evidence.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEvidence(item.id, item.file_path);
              await logActivity(org!.orgId, 'evidence_deleted', 'evidence', item.id, {
                title: item.title,
              });
              qc.invalidateQueries({ queryKey: ['evidence'] });
              qc.invalidateQueries({ queryKey: ['fwStats'] });
              r.back();
            } catch (e: any) {
              Alert.alert('Delete failed', e?.message ?? 'Try again.');
            }
          },
        },
      ],
    );
  };

  if (!item) {
    return (
      <Screen>
        <SwipeBackContainer onBack={() => r.back()}>
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              padding: spacing.xl,
              gap: 12,
            }}
          >
            {evidenceLoading ? (
              <>
                <ActivityIndicator color={colors.primary} size="large" />
                <Text style={{ color: colors.textMuted, fontSize: 14 }}>Loading evidence details…</Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 32 }}>📁</Text>
                <Text style={{ fontWeight: '700', fontSize: 16, color: colors.heading }}>
                  Evidence Not Found
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center' }}>
                  This file may have been deleted or moved.
                </Text>
                <Button title="‹ Back to Library" variant="secondary" onPress={() => r.back()} />
              </>
            )}
          </View>
        </SwipeBackContainer>
      </Screen>
    );
  }

  const h = evidenceHealth(item.expiry_date);
  const fileExt = String(item.type ?? (item.file_path?.split('.').pop() || 'FILE')).toUpperCase();
  const fileSizeStr = item.file_size
    ? item.file_size > 1048576
      ? `${(item.file_size / 1048576).toFixed(1)} MB`
      : `${Math.round(item.file_size / 1024)} KB`
    : 'Unknown size';

  return (
    <Screen>
      <SwipeBackContainer onBack={() => r.back()}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: topInset + spacing.sm,
            paddingBottom: Math.max(bottomInset + 40, 60),
            paddingHorizontal: hPad,
            gap: spacing.md,
            maxWidth: maxContent,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          {/* Header navigation */}
          <View style={{ gap: 8 }}>
            <Pressable
              onPress={() => r.back()}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}
            >
              <ChevronLeftIcon color={colors.primary} size={18} />
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>
                Evidence Library
              </Text>
            </Pressable>

            <View style={{ gap: 4, marginTop: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Badge label={fileExt} tone="info" />
                <Badge
                  label={item.status === 'approved' ? 'Approved' : item.status === 'rejected' ? 'Rejected' : 'Pending Review'}
                  tone={item.status === 'approved' ? 'success' : item.status === 'rejected' ? 'critical' : 'warning'}
                />
                <Badge
                  label={h === 'none' ? 'No Expiry' : h === 'valid' ? 'Valid' : h === 'expiring' ? 'Expiring Soon' : 'Expired'}
                  tone={healthTone(h)}
                />
              </View>

              <Text style={{ fontSize: 22, fontWeight: '800', color: colors.heading, marginTop: 2 }}>
                {item.title}
              </Text>

              <Text style={{ color: colors.textMuted, fontSize: 12.5 }}>
                {fileSizeStr} · Uploaded {fmtDate(item.created_at)}
              </Text>
            </View>
          </View>

          {/* Visual Preview Card (High Priority for WebP, PNG, JPG) */}
          {isImage ? (
            <Card
              style={{
                padding: spacing.md,
                gap: 12,
                backgroundColor: colors.surface,
                borderRadius: 16,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.heading }}>
                  🖼️ Visual Preview ({fileExt})
                </Text>
                <Pressable onPress={open} hitSlop={6}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                    Full Screen ↗
                  </Text>
                </Pressable>
              </View>

              {previewLoading ? (
                <View style={{ height: 240, justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color={colors.primary} size="large" />
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>Loading preview…</Text>
                </View>
              ) : previewUrl ? (
                <View
                  style={{
                    borderRadius: 12,
                    overflow: 'hidden',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Image
                    source={{ uri: previewUrl }}
                    style={{
                      width: '100%',
                      height: 280,
                    }}
                    resizeMode="contain"
                  />
                </View>
              ) : (
                <View style={{ height: 160, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>Preview could not be loaded.</Text>
                </View>
              )}
            </Card>
          ) : (
            <Card
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                padding: spacing.md,
                backgroundColor: colors.surface,
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 12,
                  backgroundColor: colors.surfaceAlt,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 26 }}>📄</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.heading }}>
                  {item.title}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  {fileExt} Document · {fileSizeStr}
                </Text>
              </View>
            </Card>
          )}

          {/* Action Row */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button
                title={busy ? 'Opening…' : 'Open in Browser'}
                loading={busy}
                onPress={open}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Download / Share"
                variant="secondary"
                disabled={busy}
                onPress={download}
              />
            </View>
          </View>

          {/* Description Section */}
          {item.description ? (
            <Card style={{ padding: spacing.md, gap: 6, backgroundColor: colors.surface }}>
              <Text style={{ fontWeight: '700', fontSize: 14, color: colors.heading }}>
                Description & Purpose
              </Text>
              <Text style={{ fontSize: 13, lineHeight: 20, color: colors.text }}>
                {item.description}
              </Text>
            </Card>
          ) : null}

          {/* Metadata & Compliance Details */}
          <Card style={{ padding: spacing.md, gap: 10, backgroundColor: colors.surface }}>
            <Text style={{ fontWeight: '700', fontSize: 14, color: colors.heading }}>
              Compliance Record Details
            </Text>

            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 12.5, color: colors.textMuted }}>Expiry / Review Date</Text>
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.text }}>
                  {item.expiry_date ? fmtDate(item.expiry_date) : 'None set'}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 12.5, color: colors.textMuted }}>Uploaded By</Text>
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.text }}>
                  {item.owner?.full_name ?? 'Organization Member'}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 12.5, color: colors.textMuted }}>Linked Controls</Text>
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.text }}>
                  {item.links?.length ?? 0} controls mapped
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 12.5, color: colors.textMuted }}>Document Version</Text>
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.text }}>
                  v{(item.links?.length ?? 0) + 1} (latest active)
                </Text>
              </View>
            </View>
          </Card>

          {/* Destructive Action */}
          <Button
            title="Delete Evidence"
            variant="secondary"
            onPress={remove}
            style={{ borderColor: colors.red, marginTop: 4 }}
          />
        </ScrollView>
      </SwipeBackContainer>
    </Screen>
  );
}
