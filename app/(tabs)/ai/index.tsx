import { useState, useRef, useEffect, type ComponentRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Aurora } from '@/components/motion/Aurora';
import { useResponsive } from '@/lib/responsive';
import { useCurrentOrg } from '@/hooks/useOrg';
import { askAI, createTask } from '@/services/api';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/lib/design-tokens';
import { TabIcon } from '@/components/icons/TabIcon';
import { CheckIcon, ArrowRightIcon } from '@/components/icons/ActionIcons';

type AIContext = 'general' | 'frameworks' | 'risks' | 'evidence';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: string[];
  isDemo?: boolean;
  createdAt: Date;
}

const CONTEXTS: Array<{ key: AIContext; label: string; icon: string }> = [
  { key: 'general', label: 'General', icon: '🌐' },
  { key: 'frameworks', label: 'Frameworks', icon: '📊' },
  { key: 'risks', label: 'Risks', icon: '⚠️' },
  { key: 'evidence', label: 'Evidence', icon: '📁' },
];

const PROMPTS_BY_CONTEXT: Record<AIContext, string[]> = {
  general: [
    'What are our most critical compliance gaps?',
    'Summarize our organizational compliance posture',
    'Draft an Incident Response policy outline',
    'How do we prepare for an upcoming external audit?',
  ],
  frameworks: [
    'What evidence do I need for ISO 27001 A.5.15 Access Control?',
    'Explain the DPDP consent and data principal rights in plain language',
    'What are the core differences between NIST CSF and ISO 27001?',
    'What controls should we prioritize for SOC 2 Type II readiness?',
  ],
  risks: [
    'How do I calculate residual risk after implementing safeguards?',
    'What are recommended mitigation steps for vendor supply-chain risks?',
    'Draft a risk treatment plan for unencrypted data backups',
    'Suggest high-impact controls for ransomware exposure',
  ],
  evidence: [
    'What constitutes valid audit evidence for MFA implementation?',
    'How often should access review evidence be collected and signed off?',
    'What evidence artifacts are required for disaster recovery testing?',
    'Draft an evidence checklist for annual penetration testing',
  ],
};

export default function AI() {
  const r = useRouter();
  const params = useLocalSearchParams<{ context?: string }>();
  const { data: org } = useCurrentOrg();
  const { colors, isDark } = useTheme();
  const { topInset, bottomInset, hPad, maxContent } = useResponsive();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  const [context, setContext] = useState<AIContext>(
    (params.context as AIContext) && ['general', 'frameworks', 'risks', 'evidence'].includes(params.context as any)
      ? (params.context as AIContext)
      : 'general',
  );

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const [messages, setMessages] = useState<Msg[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: "Hello! I am your AEGIS AI Compliance Assistant. Ask me anything about compliance frameworks (ISO 27001, SOC 2, NIST, DPDP), risk scoring, evidence requirements, or policy language. I analyze your workspace data with strict role permissions.",
      sources: ['AEGIS GRC Intelligence'],
      createdAt: new Date(),
    },
  ]);

  const send = async (textOverride?: string) => {
    const q = (textOverride ?? input).trim();
    if (!q || loading) return;

    const userMsg: Msg = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: q,
      createdAt: new Date(),
    };

    setInput('');
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);

    try {
      const res = await askAI(org?.orgId ?? '', q, context);
      const assistantMsg: Msg = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: res.answer,
        sources: res.sources,
        isDemo: res.is_demo,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          text: `I encountered an issue analyzing your workspace: ${e?.message ?? 'Please try again in a moment.'}`,
          sources: [],
          isDemo: true,
          createdAt: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    }
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await Clipboard.setStringAsync(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      Alert.alert('Copy failed', 'Could not copy to clipboard.');
    }
  };

  const exportAsTask = async (text: string, id: string) => {
    if (!org?.orgId || !org?.userId) return;
    setExportingId(id);
    try {
      const title = text.slice(0, 60).replace(/\n/g, ' ').trim() + (text.length > 60 ? '…' : '');
      const created = await createTask(org.orgId, org.userId, {
        title: `AI Action: ${title}`,
        description: text,
        priority: 'medium',
      });

      Alert.alert(
        'Task Created',
        'An actionable task has been created from this AI suggestion.',
        [
          { text: 'View Tasks', onPress: () => r.push('/(tabs)/tasks' as any) },
          { text: 'Done', style: 'cancel' },
        ],
      );
    } catch (e: any) {
      Alert.alert('Export Failed', e?.message ?? 'Could not create task from AI suggestion.');
    } finally {
      setExportingId(null);
    }
  };

  const resetChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        text: "Started a fresh conversation. How can I help with your compliance objectives today?",
        sources: ['AEGIS GRC Intelligence'],
        createdAt: new Date(),
      },
    ]);
  };

  const currentPrompts = PROMPTS_BY_CONTEXT[context] ?? PROMPTS_BY_CONTEXT.general;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Aurora />

      {/* Top Header Card */}
      <View
        style={{
          paddingTop: topInset + 6,
          paddingBottom: 10,
          paddingHorizontal: hPad,
          backgroundColor: isDark ? 'rgba(15,23,42,0.92)' : colors.navy,
          borderBottomWidth: 1,
          borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)',
          gap: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.15)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TabIcon name="ai" color="#8FB2FB" size={18} />
            </View>
            <View>
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 18 }}>
                AI Compliance Assistant
              </Text>
              <Text style={{ color: '#94A3B8', fontSize: 11 }}>
                Real-time workspace guidance & gap analysis
              </Text>
            </View>
          </View>

          <Pressable
            onPress={resetChat}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="New chat conversation"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: 'rgba(255,255,255,0.12)',
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>+ New Chat</Text>
          </Pressable>
        </View>

        {/* Context Selector Bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '700' }}>Context:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {CONTEXTS.map((c) => {
              const active = context === c.key;
              return (
                <Pressable
                  key={c.key}
                  onPress={() => setContext(c.key)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: active ? (isDark ? '#38BDF8' : '#8FB2FB') : 'rgba(255,255,255,0.12)',
                  }}
                >
                  <Text style={{ fontSize: 11 }}>{c.icon}</Text>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: active ? '800' : '600',
                      color: active ? '#0A1931' : '#FFFFFF',
                    }}
                  >
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <Text style={{ color: '#94A3B8', fontSize: 10, fontStyle: 'italic' }}>
          ⚠ AI outputs are advisory and must be reviewed by a qualified compliance professional.
        </Text>
      </View>

      {/* Main Chat Flow with Keyboard Avoidance */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingTop: 12,
            paddingBottom: 24,
            paddingHorizontal: hPad,
            gap: 14,
            width: '100%',
            maxWidth: maxContent ?? 760,
            alignSelf: 'center',
          }}
        >
          {/* Quick Prompt Suggestions */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: colors.textMuted }}>
              SUGGESTED QUESTIONS ({context.toUpperCase()})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {currentPrompts.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => send(p)}
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 999,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#38BDF8' : colors.heading }}>
                    {p}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Conversation Messages */}
          {messages.map((m) => {
            const isUser = m.role === 'user';
            return (
              <View
                key={m.id}
                style={{
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: '88%',
                  gap: 4,
                }}
              >
                {/* Assistant Label / Avatar */}
                {!isUser ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 999,
                        backgroundColor: isDark ? '#1E293B' : colors.navy,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <TabIcon name="ai" color="#8FB2FB" size={12} />
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: colors.heading }}>
                      AEGIS AI
                    </Text>
                  </View>
                ) : null}

                {/* Message Bubble */}
                <View
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    borderRadius: 16,
                    borderTopLeftRadius: !isUser ? 4 : 16,
                    borderTopRightRadius: isUser ? 4 : 16,
                    backgroundColor: isUser
                      ? isDark
                        ? '#0284C7'
                        : colors.navy
                      : isDark
                      ? colors.surface
                      : '#FFFFFF',
                    borderWidth: !isUser ? 1 : 0,
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border,
                    shadowColor: '#000',
                    shadowOpacity: isDark ? 0.2 : 0.04,
                    shadowRadius: 3,
                    elevation: 1,
                    gap: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      lineHeight: 22,
                      color: isUser ? '#FFFFFF' : colors.text,
                    }}
                  >
                    {m.text}
                  </Text>

                  {/* Sources tag list */}
                  {m.sources?.length ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                      {m.sources.map((s) => (
                        <View
                          key={s}
                          style={{
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 4,
                            backgroundColor: isUser ? 'rgba(255,255,255,0.2)' : colors.surfaceAlt,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 9,
                              fontWeight: '700',
                              color: isUser ? '#FFFFFF' : colors.textMuted,
                            }}
                          >
                            Source: {s}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {m.isDemo ? (
                    <View
                      style={{
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                        backgroundColor: 'rgba(245,158,11,0.15)',
                        alignSelf: 'flex-start',
                      }}
                    >
                      <Text style={{ fontSize: 9, fontWeight: '800', color: '#D97706' }}>
                        DEMO SIMULATION
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Assistant Message Actions (Copy & Export) */}
                {!isUser && m.id !== 'welcome' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, marginTop: 2 }}>
                    <Pressable
                      onPress={() => handleCopy(m.text, m.id)}
                      hitSlop={8}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    >
                      {copiedId === m.id ? (
                        <>
                          <CheckIcon color={colors.teal} size={12} />
                          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.teal }}>Copied!</Text>
                        </>
                      ) : (
                        <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#38BDF8' : '#0369A1' }}>
                          📋 Copy
                        </Text>
                      )}
                    </Pressable>

                    <Pressable
                      onPress={() => exportAsTask(m.text, m.id)}
                      hitSlop={8}
                      disabled={exportingId === m.id}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#38BDF8' : '#0369A1' }}>
                        {exportingId === m.id ? 'Creating Task…' : '⬆ Export as Task'}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}

          {/* Thinking / Analyzing Indicator */}
          {loading ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 14,
                backgroundColor: isDark ? colors.surface : '#FFFFFF',
                borderWidth: 1,
                borderColor: colors.border,
                alignSelf: 'flex-start',
              }}
            >
              <ActivityIndicator size="small" color={isDark ? '#38BDF8' : colors.navy} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted }}>
                AEGIS AI is analyzing workspace data…
              </Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Bottom Message Input Bar */}
        <View
          style={{
            paddingHorizontal: hPad,
            paddingTop: 8,
            paddingBottom: Math.max(bottomInset + 76, 92),
            backgroundColor: isDark ? 'rgba(15,23,42,0.95)' : '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: colors.border,
            width: '100%',
            maxWidth: maxContent ?? 760,
            alignSelf: 'center',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={`Ask about ${context}…`}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={1000}
              style={{
                flex: 1,
                minHeight: 40,
                maxHeight: 90,
                paddingHorizontal: 12,
                paddingTop: 10,
                paddingBottom: 10,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surfaceAlt,
                fontSize: 14,
                color: colors.text,
              }}
            />

            <Pressable
              onPress={() => send()}
              disabled={loading || !input.trim()}
              style={{
                height: 40,
                paddingHorizontal: 16,
                borderRadius: 12,
                backgroundColor: input.trim() && !loading ? (isDark ? '#38BDF8' : colors.navy) : colors.surfaceAlt,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '800',
                  color: input.trim() && !loading ? (isDark ? '#0A1931' : '#FFFFFF') : colors.textMuted,
                }}
              >
                Send
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
