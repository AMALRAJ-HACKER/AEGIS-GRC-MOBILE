import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { SwipeBackContainer } from '@/components/navigation/SwipeBackContainer';
import { useCurrentOrg } from '@/hooks/useOrg';
import { useResponsive } from '@/lib/responsive';
import { useCelebration } from '@/components/motion/Celebration';
import { fetchTasks, updateTask, addComment, fetchComments } from '@/services/api';
import { fmtDate, taskLabel, taskTone, priorityTone, logActivity, notify, timeAgo } from '@/lib/format';
import { spacing } from '@/lib/design-tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons/ActionIcons';

export default function TaskDetail() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const r = useRouter();
  const qc = useQueryClient();
  const { data: org } = useCurrentOrg();
  const { colors, isDark } = useTheme();
  const { topInset, bottomInset, hPad, maxContent } = useResponsive();
  const celebrate = useCelebration();

  const [saving, setSaving] = useState(false);
  const [comment, setComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  // Rejection modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    enabled: !!org?.orgId,
    queryKey: ['tasks', org?.orgId],
    queryFn: () => fetchTasks(org!.orgId),
  });
  const task = (tasks ?? []).find((t: any) => t.id === taskId) as any;

  const { data: comments, refetch: refetchComments } = useQuery({
    enabled: !!taskId,
    queryKey: ['comments', taskId],
    queryFn: () => fetchComments(taskId!),
  });

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

  const act = async (fields: any, action: string) => {
    if (!task || !org) return;
    setSaving(true);
    try {
      await updateTask(task.id, fields);
      await logActivity(org.orgId, action, 'task', task.id, { title: task.title, ...fields });
      if (fields.status === 'pending_review' && task.created_by && task.created_by !== org.userId) {
        await notify(
          task.created_by,
          org.orgId,
          'approval',
          'Task awaiting your review',
          task.title,
          'task',
          task.id,
        );
      }
      if (fields.status === 'done') {
        celebrate({ title: 'Task closed', subtitle: task.title });
      } else if (fields.status === 'approved') {
        celebrate({ title: 'Task approved', subtitle: task.title });
      }
      qc.invalidateQueries({ queryKey: ['tasks'] });
    } catch (e: any) {
      Alert.alert('Update failed', e?.message ?? 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const post = async () => {
    if (!comment.trim() || !org) return;
    setPostingComment(true);
    try {
      await addComment(taskId!, org.userId, comment.trim());
      setComment('');
      refetchComments();
    } catch (e: any) {
      Alert.alert('Comment failed', e?.message ?? 'Could not post comment.');
    } finally {
      setPostingComment(false);
    }
  };

  const handleConfirmReject = async () => {
    setRejectModalOpen(false);
    await act(
      { status: 'in_progress', review_note: rejectReason.trim() || 'Changes requested' },
      'task_rejected',
    );
    setRejectReason('');
  };

  if (!task) {
    return (
      <Screen>
        <SwipeBackContainer onBack={goBackToTasks}>
          <View style={{ flex: 1, padding: spacing.lg, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 16, color: colors.textMuted, textAlign: 'center' }}>
              {tasksLoading ? 'Loading task details…' : 'This task was not found or has been removed.'}
            </Text>
            <Button title="‹ Back to Tasks" variant="secondary" onPress={goBackToTasks} />
          </View>
        </SwipeBackContainer>
      </Screen>
    );
  }

  const isReviewer = ['super_admin', 'org_admin', 'grc_analyst', 'auditor'].includes(org?.role ?? '');
  const isAssignee = task.assigned_to === org?.userId;
  const s = task.status;

  return (
    <Screen>
      <SwipeBackContainer onBack={goBackToTasks}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 44 : 0}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingTop: 8,
              paddingBottom: Math.max(bottomInset + 120, 160),
              paddingHorizontal: hPad,
              gap: spacing.md,
              maxWidth: maxContent ?? 760,
              width: '100%',
              alignSelf: 'center',
            }}
          >
            {/* Top Navigation Row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Pressable
                onPress={goBackToTasks}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Back to tasks list"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 }}
              >
                <ChevronLeftIcon color={colors.textMuted} size={20} />
                <Text style={{ color: colors.textMuted, fontWeight: '700', fontSize: 14 }}>
                  Tasks
                </Text>
              </Pressable>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Badge label={task.priority?.toUpperCase() ?? 'MEDIUM'} tone={priorityTone(task.priority)} />
                <Badge label={taskLabel(s)} tone={taskTone(s)} />
              </View>
            </View>

            {/* Task Header & Metadata Card */}
            <Card style={{ padding: 16, gap: 10 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.heading, lineHeight: 26 }}>
                {task.title}
              </Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                    backgroundColor: colors.surfaceAlt,
                  }}
                >
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>Assigned:</Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.heading }}>
                    {task.assignee?.full_name ?? 'Unassigned'}
                  </Text>
                </View>

                {task.due_date ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 6,
                      backgroundColor: colors.surfaceAlt,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>Due:</Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.heading }}>
                      {fmtDate(task.due_date)}
                    </Text>
                  </View>
                ) : null}

                {task.created_at ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 6,
                      backgroundColor: colors.surfaceAlt,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>Created:</Text>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text }}>
                      {fmtDate(task.created_at)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Card>

            {/* Review Note Banner */}
            {task.review_note ? (
              <Card
                style={{
                  padding: 12,
                  gap: 4,
                  backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : '#FEF3C7',
                  borderColor: isDark ? 'rgba(245,158,11,0.3)' : '#FDE68A',
                  borderWidth: 1,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '800', color: isDark ? '#FBBF24' : '#B45309' }}>
                  Review Note
                </Text>
                <Text style={{ fontSize: 13, lineHeight: 19, color: isDark ? '#FDE68A' : '#78350F' }}>
                  {task.review_note}
                </Text>
              </Card>
            ) : null}

            {/* Workflow Action Panel */}
            <Card style={{ padding: 14, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: colors.heading }}>Workflow</Text>
                <Text style={{ fontSize: 11, color: colors.textMuted }}>
                  Current: {taskLabel(s)}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                {s === 'todo' && (
                  <Button
                    title="▶ Start Work"
                    loading={saving}
                    onPress={() => act({ status: 'in_progress' }, 'task_started')}
                  />
                )}

                {s === 'in_progress' && (
                  <>
                    <Button
                      title="Submit for Review"
                      loading={saving}
                      onPress={() =>
                        act(
                          { status: 'pending_review', review_requested_at: new Date().toISOString() },
                          'task_submitted',
                        )
                      }
                    />
                    <Button
                      title="Block"
                      variant="secondary"
                      loading={saving}
                      onPress={() => act({ status: 'blocked' }, 'task_blocked')}
                    />
                  </>
                )}

                {s === 'pending_review' && isReviewer && (
                  <>
                    <Button
                      title="✓ Approve"
                      loading={saving}
                      onPress={() => act({ status: 'approved', review_note: 'Approved' }, 'task_approved')}
                    />
                    <Button
                      title="✕ Reject"
                      variant="secondary"
                      loading={saving}
                      onPress={() => setRejectModalOpen(true)}
                    />
                  </>
                )}

                {s === 'pending_review' && !isReviewer && (
                  <View
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: 8,
                      backgroundColor: colors.surfaceAlt,
                    }}
                  >
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                      ⏳ Waiting for administrator or analyst review…
                    </Text>
                  </View>
                )}

                {s === 'approved' && (
                  <Button
                    title="✓ Close Task"
                    loading={saving}
                    onPress={() => act({ status: 'done' }, 'task_closed')}
                  />
                )}

                {s === 'blocked' && (
                  <Button
                    title="Resume Work"
                    loading={saving}
                    onPress={() => act({ status: 'in_progress' }, 'task_resumed')}
                  />
                )}

                {s === 'done' && (
                  <View
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: 8,
                      backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : '#ECFDF5',
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#34D399' : '#059669' }}>
                      ✓ Task closed and verified.
                    </Text>
                  </View>
                )}
              </View>
            </Card>

            {/* Linked Control or Linked Risk */}
            {(task.assessment?.framework_controls || task.risk) ? (
              <Card style={{ padding: 14, gap: 10 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: colors.heading }}>
                  Linked Items
                </Text>

                <View style={{ gap: 8 }}>
                  {task.assessment?.framework_controls ? (
                    <Pressable
                      onPress={() =>
                        task.assessment.framework_controls.framework_id &&
                        r.push(
                          `/(tabs)/frameworks/${task.assessment.framework_controls.framework_id}/${task.assessment.framework_controls.id}` as any,
                        )
                      }
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 10,
                        borderRadius: 8,
                        backgroundColor: colors.surfaceAlt,
                        borderWidth: 1,
                        borderColor: colors.border,
                        gap: 8,
                      }}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: isDark ? colors.teal : '#0284C7' }}>
                          CONTROL {task.assessment.framework_controls.control_id}
                        </Text>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
                          {task.assessment.framework_controls.title}
                        </Text>
                      </View>
                      <ChevronRightIcon color={colors.textMuted} size={16} />
                    </Pressable>
                  ) : null}

                  {task.risk ? (
                    <Pressable
                      onPress={() => r.push(`/(tabs)/risks/${task.linked_risk_id}` as any)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 10,
                        borderRadius: 8,
                        backgroundColor: colors.surfaceAlt,
                        borderWidth: 1,
                        borderColor: colors.border,
                        gap: 8,
                      }}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#F97316' }}>
                          LINKED RISK
                        </Text>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
                          {task.risk.title}
                        </Text>
                      </View>
                      <ChevronRightIcon color={colors.textMuted} size={16} />
                    </Pressable>
                  ) : null}
                </View>
              </Card>
            ) : null}

            {/* Task Description */}
            {task.description ? (
              <Card style={{ padding: 14, gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: colors.heading }}>Description</Text>
                <Text style={{ fontSize: 14, lineHeight: 22, color: colors.text }}>
                  {task.description}
                </Text>
              </Card>
            ) : null}

            {/* Comments Thread */}
            <Card style={{ padding: 14, gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: colors.heading }}>
                  Discussion & Comments ({comments?.length ?? 0})
                </Text>
              </View>

              {/* Comment Input */}
              <View style={{ gap: 8 }}>
                <Input
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Add a comment to this task…"
                  multiline
                  numberOfLines={2}
                />
                <Button
                  title="Post Comment"
                  size="sm"
                  loading={postingComment}
                  disabled={!comment.trim()}
                  onPress={post}
                  style={{ alignSelf: 'flex-end' }}
                />
              </View>

              {/* Comments List */}
              <View style={{ gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 12 }}>
                {comments?.length ? (
                  comments.map((c: any) => (
                    <View
                      key={c.id}
                      style={{
                        padding: 10,
                        borderRadius: 8,
                        backgroundColor: colors.surfaceAlt,
                        borderWidth: 1,
                        borderColor: colors.border,
                        gap: 4,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: colors.heading }}>
                          {c.user?.full_name ?? 'Staff member'}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.textMuted }}>
                          {timeAgo(c.created_at)}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 13, lineHeight: 19, color: colors.text }}>
                        {c.comment}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center', paddingVertical: 8 }}>
                    No comments yet. Start the conversation above.
                  </Text>
                )}
              </View>
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Reject Modal */}
        <Modal
          visible={rejectModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setRejectModalOpen(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.5)',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 20,
            }}
          >
            <View
              style={{
                width: '100%',
                maxWidth: 400,
                backgroundColor: colors.surface,
                borderRadius: 14,
                padding: 18,
                gap: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.heading }}>
                Reject Task
              </Text>
              <Text style={{ fontSize: 13, color: colors.textMuted }}>
                Provide feedback or instructions explaining why this task is being rejected back to in-progress.
              </Text>
              <Input
                value={rejectReason}
                onChangeText={setRejectReason}
                multiline
                numberOfLines={3}
                placeholder="Reason for rejection (optional)…"
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <Button
                  title="Cancel"
                  variant="secondary"
                  size="sm"
                  onPress={() => setRejectModalOpen(false)}
                />
                <Button
                  title="Confirm Reject"
                  size="sm"
                  onPress={handleConfirmReject}
                />
              </View>
            </View>
          </View>
        </Modal>
      </SwipeBackContainer>
    </Screen>
  );
}
