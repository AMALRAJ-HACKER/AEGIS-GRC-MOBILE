
export type Role = 'super_admin' | 'org_admin' | 'grc_analyst' | 'it_security' | 'auditor' | 'management' | 'staff';
export type ControlStatus = 'not_started' | 'in_progress' | 'implemented' | 'needs_review' | 'non_compliant' | 'not_applicable';
export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low';
export type EvidenceStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type TaskStatus = 'todo' | 'in_progress' | 'pending_review' | 'approved' | 'done' | 'blocked';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Framework { id: string; name: string; slug: string; version: string; description: string; category: string; }
export interface Control { id: string; framework_id: string; control_id: string; title: string; description: string; category: string; }
export interface Risk { id: string; title: string; severity: RiskSeverity; likelihood: number; impact: number; residual_score: number; status: string; }
