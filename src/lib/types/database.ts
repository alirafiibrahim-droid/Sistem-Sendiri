// ============================================================================
// SIORG Database Types
// Auto-generated type definitions matching schema.sql
// ============================================================================

export type UserRole = "ADMIN" | "PENGURUS_INTI" | "KABID" | "ANGGOTA";
export type UserStatus = "AKTIF" | "CUTI" | "ALUMNI" | "NONAKTIF";

export type ProgramStatus = "PLANNED" | "ONGOING" | "COMPLETED" | "CANCELLED";
export type FinanceType = "INCOME" | "EXPENSE";
export type TaskStatus = "TO_DO" | "IN_PROGRESS" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";
export type AttendanceStatus = "PRESENT" | "ABSENT" | "SICK" | "PERMIT";

export type DuesPaymentStatus =
  | "UNPAID"
  | "PENDING_VERIFICATION"
  | "PAID";

export type LetterType = "INCOMING" | "OUTGOING";
export type LetterClassification = "PUBLIC" | "CONFIDENTIAL";
export type HandoverStatus = "DRAFT" | "SIGNED" | "COMPLETED";

export type MetricType = "QUANTITATIVE" | "QUALITATIVE";
export type IntensityLevel = "LOW" | "MEDIUM" | "HIGH";

export type AchievementType = "ORGANIZATION" | "INDIVIDUAL";
export type AchievementStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ProjectStatus = "PROPOSED" | "APPROVED" | "ONGOING" | "CLOSED";

// ----------------------------------------------------------------------------
// Table Row Types
// ----------------------------------------------------------------------------

export interface Division {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  nim: string;
  role: UserRole;
  division_id: string | null;
  phone_number: string | null;
  status: UserStatus;
  avatar_url: string | null;
  joined_at: string;
  updated_at: string;
}

export interface ProfileWithDivision extends Profile {
  divisions: Pick<Division, "id" | "name"> | null;
}

export interface OrganizationSettings {
  id: string;
  org_name: string;
  org_description: string;
  org_email: string | null;
  org_logo_url: string | null;
  period_year: string;
  is_maintenance: boolean;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

// A9: Program Kerja
export interface Program {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  budget_estimate: number;
  status: ProgramStatus;
  proposal_url: string | null;
  lpj_url: string | null;
  division_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProgramWithDetails extends Program {
  divisions: Pick<Division, "id" | "name"> | null;
  program_members: ProgramMember[];
  _count?: { tasks: number; done_tasks: number };
}

export interface ProgramMember {
  id: string;
  program_id: string;
  user_id: string;
  role_in_program: string;
  joined_at: string;
}

export interface ProgramMemberWithProfile extends ProgramMember {
  profiles: Pick<Profile, "id" | "full_name" | "nim" | "avatar_url">;
}

export interface Task {
  id: string;
  program_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskWithAssignee extends Task {
  profiles: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
}

// A4: Keuangan
export interface Finance {
  id: string;
  type: FinanceType;
  amount: number;
  description: string;
  date: string;
  program_id: string | null;
  receipt_url: string;
  created_by: string | null;
  created_at: string;
}

export interface FinanceWithDetails extends Finance {
  profiles: Pick<Profile, "id" | "full_name"> | null;
  programs: Pick<Program, "id" | "name"> | null;
}

export interface DuesTemplate {
  id: string;
  title: string;
  amount: number;
  due_date: string;
  created_by: string | null;
  created_at: string;
}

export interface DuesPayment {
  id: string;
  due_template_id: string;
  user_id: string;
  status: DuesPaymentStatus;
  payment_date: string | null;
  proof_url: string | null;
  feedback: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
}

export interface DuesPaymentWithDetails extends DuesPayment {
  profiles: Pick<Profile, "id" | "full_name" | "nim">;
  dues_templates: Pick<DuesTemplate, "id" | "title" | "amount" | "due_date">;
}

// A5: Presensi
export interface Attendance {
  id: string;
  program_id: string;
  user_id: string;
  status: AttendanceStatus;
  timestamp: string;
}

export interface AttendanceWithProfile extends Attendance {
  profiles: Pick<Profile, "id" | "full_name" | "nim" | "avatar_url">;
}

// A7: Persuratan
export interface Letter {
  id: string;
  type: LetterType;
  reference_number: string;
  title: string;
  sender: string;
  date_received_sent: string;
  classification: LetterClassification;
  document_url: string;
  created_by: string | null;
  created_at: string;
}

export interface LetterWithCreator extends Letter {
  profiles: Pick<Profile, "id" | "full_name"> | null;
}

// A11: Sertijab
export interface Handover {
  id: string;
  period_from: string;
  period_to: string;
  handover_date: string;
  document_url: string | null;
  witnesses: HandoverWitness[];
  status: HandoverStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HandoverWitness {
  name: string;
  nim: string;
  role: string;
}

export interface HandoverWithCreator extends Handover {
  profiles: Pick<Profile, "id" | "full_name"> | null;
}

// A3: Keatletan
export interface AthleticMetric {
  id: string;
  name: string;
  type: MetricType;
  unit: string | null;
  created_at: string;
}

export interface AthleteCoachMapping {
  id: string;
  coach_id: string;
  athlete_id: string;
  created_at: string;
}

export interface TrainingSession {
  id: string;
  coach_id: string | null;
  date: string;
  session_type: string | null;
  duration_minutes: number | null;
  intensity: IntensityLevel | null;
  created_at: string;
}

export interface TrainingSessionWithCoach extends TrainingSession {
  profiles: Pick<Profile, "id" | "full_name"> | null;
  training_session_attendants: TrainingSessionAttendant[];
}

export interface TrainingSessionAttendant {
  id: string;
  session_id: string;
  athlete_id: string;
}

export interface Assessment {
  id: string;
  session_id: string | null;
  athlete_id: string;
  metric_id: string;
  value: number;
  notes: string | null;
  created_at: string;
}

export interface AssessmentWithDetails extends Assessment {
  athletic_metrics: Pick<AthleticMetric, "id" | "name" | "type" | "unit">;
  profiles: Pick<Profile, "id" | "full_name" | "nim">;
}

export interface AthleteTarget {
  id: string;
  athlete_id: string;
  metric_id: string;
  target_value: number;
  is_active: boolean;
  created_at: string;
}

export interface AthleteTargetWithDetails extends AthleteTarget {
  athletic_metrics: Pick<AthleticMetric, "id" | "name" | "type" | "unit">;
}

// A8: Prestasi
export interface Achievement {
  id: string;
  title: string;
  description: string | null;
  type: AchievementType;
  category: string;
  level: string;
  organizer: string | null;
  achievement_date: string;
  proof_url: string | null;
  status: AchievementStatus;
  rejection_reason: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AchievementWithParticipants extends Achievement {
  profiles: Pick<Profile, "id" | "full_name"> | null;
  achievement_participants: AchievementParticipantWithProfile[];
}

export interface AchievementParticipant {
  id: string;
  achievement_id: string;
  user_id: string;
  role_in_achievement: string | null;
}

export interface AchievementParticipantWithProfile
  extends AchievementParticipant {
  profiles: Pick<Profile, "id" | "full_name" | "nim" | "avatar_url">;
}

// A10: Proyek Insidental
export interface IncidentalProject {
  id: string;
  name: string;
  description: string | null;
  urgency_level: string;
  start_date: string;
  end_date: string | null;
  budget_source: string | null;
  status: ProjectStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectFund {
  id: string;
  project_id: string;
  type: FinanceType;
  amount: number;
  source: string | null;
  description: string | null;
  date: string;
  receipt_url: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ProjectTeam {
  id: string;
  project_id: string;
  user_id: string;
  project_role: string | null;
  joined_at: string;
}

export interface ProjectTeamWithProfile extends ProjectTeam {
  profiles: Pick<Profile, "id" | "full_name" | "nim" | "avatar_url">;
}

export interface ProjectMilestone {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
}
