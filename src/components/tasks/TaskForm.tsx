import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DatePickerField } from '@/components/forms/DatePickerField';
import { useCurrentOrg } from '@/hooks/useOrg';
import { fetchMembers, fetchRisks } from '@/services/api';
import { supabase } from '@/lib/supabase';
import { priorityTone } from '@/lib/format';
import { radius, spacing } from '@/lib/design-tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { SearchIcon, XIcon, CheckIcon } from '@/components/icons/ActionIcons';

export const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];

export type TaskFormValues = {
  title: string;
  description: string;
  priority: string;
  due_date: string;
  assigned_to: string;
  linked_control_id: string;
  linked_risk_id: string;
  status?: string;
  recurrence?: string;
  reviewer_id?: string;
};

export const EMPTY_TASK: TaskFormValues = {
  title: '',
  description: '',
  priority: 'medium',
  due_date: '',
  assigned_to: '',
  linked_control_id: '',
  linked_risk_id: '',
  status: 'todo',
  recurrence: 'none',
  reviewer_id: '',
};

// ─── Modal Selection Sheet ──────────────────────────────────────
interface SelectOption {
  id: string;
  label: string;
  subtitle?: string;
  badge?: string;
  badgeTone?: 'critical' | 'warning' | 'info' | 'success' | 'default';
}

function SelectionModal({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
  searchPlaceholder = 'Search options…',
  allowNone = false,
  noneLabel = 'None',
}: {
  visible: boolean;
  title: string;
  options: SelectOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  searchPlaceholder?: string;
  allowNone?: boolean;
  noneLabel?: string;
}) {
  const { colors } = useTheme();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.subtitle && o.subtitle.toLowerCase().includes(q)) ||
        (o.badge && o.badge.toLowerCase().includes(q)),
    );
  }, [options, search]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: '80%',
            paddingTop: 16,
            paddingBottom: 32,
            gap: 12,
            borderTopWidth: 1,
            borderColor: colors.border,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.heading }}>
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={10} style={{ padding: 4 }}>
              <XIcon color={colors.textMuted} size={20} />
            </Pressable>
          </View>

          {/* Search bar */}
          <View style={{ paddingHorizontal: 20 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.inputBg,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                paddingHorizontal: 12,
                gap: 8,
              }}
            >
              <SearchIcon color={colors.textMuted} size={16} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={searchPlaceholder}
                placeholderTextColor={colors.textMuted}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  fontSize: 14,
                  color: colors.text,
                }}
              />
              {search ? (
                <Pressable onPress={() => setSearch('')} hitSlop={8}>
                  <XIcon color={colors.textMuted} size={16} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* List */}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 6, paddingVertical: 4 }}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              allowNone ? (
                <Pressable
                  onPress={() => {
                    onSelect('');
                    onClose();
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 12,
                    borderRadius: radius.sm,
                    backgroundColor: !selectedValue ? colors.lightBlue : 'transparent',
                    borderWidth: 1,
                    borderColor: !selectedValue ? colors.teal : colors.border,
                    marginBottom: 4,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '600',
                        color: !selectedValue ? colors.teal : colors.textMuted,
                      }}
                    >
                      {noneLabel}
                    </Text>
                  </View>
                  {!selectedValue ? <CheckIcon color={colors.teal} size={18} /> : null}
                </Pressable>
              ) : undefined
            }
            ListEmptyComponent={
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>No options found</Text>
              </View>
            }
            renderItem={({ item }) => {
              const selected = selectedValue === item.id;
              return (
                <Pressable
                  onPress={() => {
                    onSelect(item.id);
                    onClose();
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 12,
                    borderRadius: radius.sm,
                    backgroundColor: selected ? colors.lightBlue : colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: selected ? colors.teal : 'transparent',
                    gap: 10,
                  }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {item.badge ? (
                        <Badge label={item.badge} tone={item.badgeTone ?? 'default'} />
                      ) : null}
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: '600',
                          color: selected ? colors.teal : colors.text,
                          flex: 1,
                        }}
                        numberOfLines={2}
                      >
                        {item.label}
                      </Text>
                    </View>
                    {item.subtitle ? (
                      <Text style={{ fontSize: 12, color: colors.textMuted }} numberOfLines={1}>
                        {item.subtitle}
                      </Text>
                    ) : null}
                  </View>
                  {selected ? <CheckIcon color={colors.teal} size={18} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

// ─── Select Trigger Button ──────────────────────────────────────
function SelectTrigger({
  label,
  valueText,
  placeholder,
  onPress,
  badge,
  badgeTone,
  error,
}: {
  label: string;
  valueText?: string;
  placeholder: string;
  onPress: () => void;
  badge?: string;
  badgeTone?: 'critical' | 'warning' | 'info' | 'success' | 'default';
  error?: string | null;
}) {
  const { colors } = useTheme();
  const hasValue = !!valueText && valueText !== 'None';

  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{label}</Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${valueText || placeholder}`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderWidth: 1,
          borderColor: error ? colors.red : colors.border,
          borderRadius: radius.md,
          backgroundColor: colors.inputBg,
          paddingHorizontal: 14,
          paddingVertical: 12,
          gap: 10,
        }}
      >
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {badge ? <Badge label={badge} tone={badgeTone ?? 'default'} /> : null}
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontSize: 14,
              color: hasValue ? colors.text : colors.textMuted,
              fontWeight: hasValue ? '500' : '400',
            }}
          >
            {valueText || placeholder}
          </Text>
        </View>
        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.teal }}>CHANGE</Text>
      </Pressable>
      {error ? <Text style={{ color: colors.red, fontSize: 12 }}>{error}</Text> : null}
    </View>
  );
}

// ─── Priority Pill Selector ─────────────────────────────────────
function PriorityPills({
  value,
  onChange,
}: {
  value: string;
  onChange: (priority: Priority) => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>Priority *</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {PRIORITIES.map((p) => {
          const active = value === p;
          const tone = priorityTone(p);
          let activeBorder = colors.teal;
          let activeBg = colors.tealLight;
          let activeText = colors.navy;

          if (p === 'critical') {
            activeBorder = colors.red;
            activeBg = colors.redLight;
            activeText = colors.red;
          } else if (p === 'high') {
            activeBorder = colors.amber;
            activeBg = colors.amberLight;
            activeText = '#B45309';
          } else if (p === 'medium') {
            activeBorder = colors.teal;
            activeBg = colors.tealLight;
            activeText = colors.teal;
          } else {
            activeBorder = colors.border;
            activeBg = colors.surfaceAlt;
            activeText = colors.text;
          }

          return (
            <Pressable
              key={p}
              onPress={() => onChange(p)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: radius.md,
                borderWidth: active ? 2 : 1,
                borderColor: active ? activeBorder : colors.border,
                backgroundColor: active ? activeBg : colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: active ? activeText : colors.textMuted,
                  textTransform: 'capitalize',
                }}
              >
                {p}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Main TaskForm Component ────────────────────────────────────
export function TaskForm({
  initialValues,
  saving,
  serverError,
  onSubmit,
  onCancel,
}: {
  mode?: 'create' | 'edit';
  initialValues?: Partial<TaskFormValues>;
  saving: boolean;
  serverError?: string | null;
  onSubmit: (values: TaskFormValues) => void | Promise<void>;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  const { data: org } = useCurrentOrg();
  const orgId = org?.orgId ?? '';
  const currentUserId = org?.userId ?? '';

  const [form, setForm] = useState<TaskFormValues>(() => ({
    ...EMPTY_TASK,
    assigned_to: currentUserId,
    ...initialValues,
  }));

  const [fwId, setFwId] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  // Modals visibility state
  const [assigneeModal, setAssigneeModal] = useState(false);
  const [frameworkModal, setFrameworkModal] = useState(false);
  const [controlModal, setControlModal] = useState(false);
  const [riskModal, setRiskModal] = useState(false);

  const set = (k: keyof TaskFormValues, v: any) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Query workspace members
  const membersQuery = useQuery({
    queryKey: ['members', orgId],
    queryFn: () => fetchMembers(orgId),
    enabled: !!orgId,
  });

  // Query workspace risks
  const risksQuery = useQuery({
    queryKey: ['risks', orgId],
    queryFn: () => fetchRisks(orgId),
    enabled: !!orgId,
  });

  // Query compliance assessments & controls
  const controlsQuery = useQuery({
    queryKey: ['assessmentsForTask', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compliance_assessments')
        .select('id, status, framework_controls(control_id, title, framework_id, frameworks(name))')
        .eq('organization_id', orgId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId,
  });

  // Extract unique frameworks
  const frameworks = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of controlsQuery.data ?? []) {
      const fc = (a as any).framework_controls;
      if (fc?.framework_id && fc?.frameworks?.name) {
        map.set(fc.framework_id, fc.frameworks.name);
      }
    }
    return Array.from(map.entries());
  }, [controlsQuery.data]);

  // Filtered controls based on framework
  const controlOptions = useMemo(() => {
    return (controlsQuery.data ?? []).filter(
      (a: any) => !fwId || a.framework_controls?.framework_id === fwId,
    );
  }, [controlsQuery.data, fwId]);

  // Prepare options for modals
  const memberOptions: SelectOption[] = useMemo(() => {
    return (membersQuery.data ?? []).map((m: any) => {
      const name = m.profile?.full_name || 'Member';
      const email = m.profile?.email || m.user_id;
      return {
        id: m.user_id,
        label: name,
        subtitle: email,
        badge: m.role ? m.role.replace(/_/g, ' ') : undefined,
      };
    });
  }, [membersQuery.data]);

  const frameworkOptions: SelectOption[] = useMemo(() => {
    return frameworks.map(([id, name]) => ({
      id,
      label: name,
    }));
  }, [frameworks]);

  const controlSelectOptions: SelectOption[] = useMemo(() => {
    return controlOptions.map((a: any) => ({
      id: a.id,
      label: a.framework_controls?.title ?? 'Untitled Control',
      badge: a.framework_controls?.control_id ?? 'Control',
      badgeTone: 'info',
      subtitle: a.framework_controls?.frameworks?.name ?? undefined,
    }));
  }, [controlOptions]);

  const riskSelectOptions: SelectOption[] = useMemo(() => {
    return (risksQuery.data ?? []).map((r: any) => ({
      id: r.id,
      label: r.title,
      badge: r.severity ?? undefined,
      badgeTone: r.severity ? priorityTone(r.severity) : undefined,
      subtitle: r.category ? `Category: ${r.category}` : undefined,
    }));
  }, [risksQuery.data]);

  // Selected labels
  const selectedAssignee = memberOptions.find((m) => m.id === form.assigned_to);
  const selectedFramework = frameworkOptions.find((f) => f.id === fwId);
  const selectedControl = (controlsQuery.data ?? []).find(
    (a: any) => a.id === form.linked_control_id,
  );
  const selectedRisk = (risksQuery.data ?? []).find((r: any) => r.id === form.linked_risk_id);

  const error = localError ?? serverError;

  const handleSubmit = () => {
    if (!form.title.trim()) {
      setLocalError('Task title is required.');
      return;
    }
    setLocalError(null);
    onSubmit({
      ...form,
      title: form.title.trim(),
      description: form.description?.trim() || '',
      assigned_to: form.assigned_to || currentUserId,
      linked_control_id: form.linked_control_id || '',
      linked_risk_id: form.linked_risk_id || '',
    });
  };

  return (
    <ScrollView
      contentContainerStyle={{ gap: spacing.md, paddingBottom: 140 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Error alert */}
      {error ? (
        <View
          style={{
            backgroundColor: colors.criticalBg,
            borderWidth: 1,
            borderColor: colors.red,
            borderRadius: radius.md,
            padding: 12,
          }}
        >
          <Text style={{ color: colors.red, fontSize: 13, fontWeight: '600' }}>
            {error}
          </Text>
        </View>
      ) : null}

      {/* ─── Card 1: Task Information ─── */}
      <Card style={{ gap: spacing.md, padding: spacing.md }}>
        <Input
          label="Title *"
          value={form.title}
          onChangeText={(v: string) => set('title', v)}
          placeholder="e.g. Enable MFA on all admin accounts"
          autoCapitalize="sentences"
        />

        <Input
          label="Description"
          value={form.description}
          onChangeText={(v: string) => set('description', v)}
          placeholder="What needs to be done…"
          multiline
          numberOfLines={4}
          style={{ minHeight: 90, textAlignVertical: 'top' }}
        />

        <PriorityPills
          value={form.priority}
          onChange={(p) => set('priority', p)}
        />

        <DatePickerField
          label="Due Date"
          value={form.due_date}
          onChange={(v) => set('due_date', v)}
          placeholder="Select due date"
        />

        <SelectTrigger
          label="Assign To"
          valueText={
            selectedAssignee
              ? `${selectedAssignee.label} (${selectedAssignee.subtitle})`
              : form.assigned_to
              ? 'Selected Member'
              : 'Select team member'
          }
          placeholder="Select team member"
          onPress={() => setAssigneeModal(true)}
        />
      </Card>

      {/* ─── Card 2: Links (optional) ─── */}
      <Card style={{ gap: spacing.md, padding: spacing.md }}>
        <View style={{ gap: 2 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.heading }}>
            Links (optional)
          </Text>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>
            Connect this remediation task to a framework control or recorded risk.
          </Text>
        </View>

        {frameworks.length > 0 ? (
          <SelectTrigger
            label="Filter controls by framework"
            valueText={selectedFramework?.label || 'All frameworks'}
            placeholder="All frameworks"
            onPress={() => setFrameworkModal(true)}
          />
        ) : null}

        <SelectTrigger
          label="Linked Control"
          valueText={
            selectedControl
              ? `${(selectedControl as any).framework_controls?.control_id ?? ''} — ${(selectedControl as any).framework_controls?.title ?? ''}`
              : form.linked_control_id
              ? 'Linked control'
              : 'None'
          }
          badge={
            selectedControl
              ? (selectedControl as any).framework_controls?.control_id
              : undefined
          }
          badgeTone="info"
          placeholder="None"
          onPress={() => setControlModal(true)}
        />

        <SelectTrigger
          label="Linked Risk"
          valueText={selectedRisk ? selectedRisk.title : form.linked_risk_id ? 'Linked risk' : 'None'}
          badge={selectedRisk?.severity ?? undefined}
          badgeTone={selectedRisk?.severity ? priorityTone(selectedRisk.severity) : undefined}
          placeholder="None"
          onPress={() => setRiskModal(true)}
        />
      </Card>

      {/* ─── Action Buttons ─── */}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
        <View style={{ flex: 1 }}>
          <Button
            title="Cancel"
            variant="secondary"
            disabled={saving}
            onPress={onCancel}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Create Task"
            loading={saving}
            onPress={handleSubmit}
          />
        </View>
      </View>

      {/* ─── Modals ─── */}
      <SelectionModal
        visible={assigneeModal}
        title="Assign To"
        options={memberOptions}
        selectedValue={form.assigned_to}
        onSelect={(val) => set('assigned_to', val)}
        onClose={() => setAssigneeModal(false)}
        searchPlaceholder="Search members by name or email…"
      />

      <SelectionModal
        visible={frameworkModal}
        title="Filter by Framework"
        options={frameworkOptions}
        selectedValue={fwId}
        onSelect={(val) => setFwId(val)}
        onClose={() => setFrameworkModal(false)}
        searchPlaceholder="Search frameworks…"
        allowNone
        noneLabel="All frameworks"
      />

      <SelectionModal
        visible={controlModal}
        title="Link to Control"
        options={controlSelectOptions}
        selectedValue={form.linked_control_id}
        onSelect={(val) => set('linked_control_id', val)}
        onClose={() => setControlModal(false)}
        searchPlaceholder="Search controls by ID or title…"
        allowNone
        noneLabel="None"
      />

      <SelectionModal
        visible={riskModal}
        title="Link to Risk"
        options={riskSelectOptions}
        selectedValue={form.linked_risk_id}
        onSelect={(val) => set('linked_risk_id', val)}
        onClose={() => setRiskModal(false)}
        searchPlaceholder="Search risks by title or category…"
        allowNone
        noneLabel="None"
      />
    </ScrollView>
  );
}
