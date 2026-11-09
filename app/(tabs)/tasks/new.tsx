import { useState } from 'react';
import { Pressable, Text, View, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { SlideIn } from '@/components/motion/SlideIn';
import { SwipeBackContainer } from '@/components/navigation/SwipeBackContainer';
import { TaskForm, type TaskFormValues } from '@/components/tasks/TaskForm';
import { useCurrentOrg } from '@/hooks/useOrg';
import { createTask } from '@/services/api';
import { logActivity, notify } from '@/lib/format';
import { spacing } from '@/lib/design-tokens';
import { useTheme } from '@/theme/ThemeProvider';

export default function AddTask() {
  const r = useRouter();
  const qc = useQueryClient();
  const { data: org, isLoading } = useCurrentOrg();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ assessmentId?: string; riskId?: string }>();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goBackToTasks = () => {
    try {
      r.replace('/(tabs)/tasks' as any);
    } catch {
      try {
        r.navigate('/(tabs)/tasks' as any);
      } catch {
        r.push('/(tabs)/tasks' as any);
      }
    }
  };

  const save = async (values: TaskFormValues) => {
    if (!org?.orgId || !org?.userId) {
      setError('Your workspace is still loading. Try again in a moment.');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const payload = {
        title: values.title.trim(),
        description: values.description?.trim() || null,
        priority: values.priority || 'medium',
        due_date: values.due_date || null,
        assigned_to: values.assigned_to || org.userId,
        linked_control_id: values.linked_control_id || null,
        linked_risk_id: values.linked_risk_id || null,
        status: values.status || 'todo',
        recurrence: values.recurrence || 'none',
      };

      const created = await createTask(org.orgId, org.userId, payload);

      try {
        await logActivity(org.orgId, 'task_created', 'task', created.id, { title: values.title });
      } catch {
        // Non-blocking log activity
      }

      if (payload.assigned_to && payload.assigned_to !== org.userId) {
        try {
          await notify(
            payload.assigned_to,
            org.orgId,
            'task_assigned',
            'New task assigned',
            values.title,
            'task',
            created.id,
          );
        } catch {
          // Non-blocking notification
        }
      }

      await qc.invalidateQueries({ queryKey: ['tasks', org.orgId] });
      Alert.alert('Success', 'New task added successfully');
      r.replace(`/(tabs)/tasks/${created.id}`);
    } catch (e: any) {
      setError(e?.message ?? 'Could not create task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <SwipeBackContainer onBack={goBackToTasks}>
        <SlideIn>
          <View style={{ flex: 1, gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pressable onPress={goBackToTasks} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back to tasks">
                <Text style={{ color: colors.teal, fontWeight: '700', fontSize: 13 }}>‹ Back</Text>
              </Pressable>
              <Text style={{ fontSize: 24, fontWeight: '800', color: colors.heading, flex: 1 }}>
                Create Task
              </Text>
            </View>

            <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19 }}>
              Assign remediation work with a due date and review flow.
            </Text>

            {isLoading ? (
              <Card>
                <Text style={{ color: colors.textMuted }}>Loading workspace…</Text>
              </Card>
            ) : (
              <TaskForm
                mode="create"
                saving={saving}
                serverError={error}
                initialValues={{
                  assigned_to: org?.userId ?? '',
                  linked_control_id: params.assessmentId ?? '',
                  linked_risk_id: params.riskId ?? '',
                }}
                onSubmit={save}
                onCancel={goBackToTasks}
              />
            )}
          </View>
        </SlideIn>
      </SwipeBackContainer>
    </Screen>
  );
}
