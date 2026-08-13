// ============================================================================
// SIORG Database Types
// Auto-generated type definitions matching schema.sql
// ============================================================================

export type UserRole = "ADMIN" | "KETUA_UMUM" | "WAKIL_KETUA" | "PENGURUS_INTI" | "SEKRETARIS" | "BENDAHARA" | "KABID" | "PELATIH" | "PEMBINA" | "ANGGOTA";
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
export type HandoverStatus = "NOT_STARTED" | "ONGOING" | "COMPLETED";

export type MetricType = "QUANTITATIVE" | "QUALITATIVE";
export type IntensityLevel = "LOW" | "MEDIUM" | "HIGH";
export type TrainingCategory = "STRENGTH" | "POWER" | "SPEED" | "AGILITY" | "ENDURANCE" | "FLEXIBILITY" | "TEKNIK" | "MENTAL" | "GAME_INTELLIGENCE";
export type AttendanceMethod = "MANUAL" | "QR";

export type AchievementType = "ORGANIZATION" | "INDIVIDUAL";
export type AchievementStatus = "PENDING" | "APPROVED" | "REJECTED";
export type AchievementJuara = "JUARA_I" | "JUARA_II" | "JUARA_III" | "JUARA_HARAPAN";

export type ProjectStatus = "PROPOSED" | "APPROVED" | "ONGOING" | "CLOSED";

export type InventoryItemCategory = "ELECTRONICS" | "FURNITURE" | "STATIONERY" | "DOCUMENTS" | "OTHER";
export type InventoryItemCondition = "GOOD" | "DAMAGED_LIGHT" | "DAMAGED_HEAVY" | "LOST";
export type InventoryLoanStatus = "PENDING" | "APPROVED" | "REJECTED" | "RETURNED" | "OVERDUE";
export type InventoryDamageType = "DAMAGE" | "LOSS" | "MAINTENANCE";

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
  theme: string;
  fakultas_id: string | null;
  jurusan_id: string | null;
  joined_at: string;
  updated_at: string;
}

export interface ProfileWithDivision extends Profile {
  divisions: Pick<Division, "id" | "name"> | null;
  fakultas: Pick<Fakultas, "id" | "name"> | null;
  jurusan: Pick<Jurusan, "id" | "name"> | null;
}

export interface OrgSocialLink {
  platform: string;
  url: string;
}

export interface OrganizationSettings {
  id: string;
  org_name: string;
  org_description: string;
  org_email: string | null;
  org_logo_url: string | null;
  period_year: string;
  is_maintenance: boolean;
  org_address: string | null;
  org_phone_number: string | null;
  org_university: string;
  org_social_media: OrgSocialLink[] | null;
  org_est_year: string;
  updated_at: string;
}

// A13: Pelaporan
export interface ReportFile {
  id: string;
  report_type: string;
  report_title: string;
  format: string;
  file_url: string;
  filters: Record<string, unknown>;
  status: string;
  created_by: string | null;
  created_at: string;
}

export interface Fakultas {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Jurusan {
  id: string;
  name: string;
  description: string;
  fakultas_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface JurusanWithFakultas extends Jurusan {
  fakultas: Pick<Fakultas, "id" | "name"> | null;
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
  handover_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProgramWithDetails extends Program {
  divisions: Pick<Division, "id" | "name"> | null;
  handovers: Pick<Handover, "id" | "period_from" | "period_to" | "status"> | null;
  program_members: ProgramMember[];
  average_score?: number | null;
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

// A6: Kas & Bank
export interface Bank {
  id: string;
  name: string;
  account_number: string;
  account_holder: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface CashAccount {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Wallet {
  id: string;
  name: string;
  description: string;
  bank_id: string | null;
  cash_account_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WalletWithOwner extends Wallet {
  banks: Pick<Bank, "id" | "name"> | null;
  cash_accounts: Pick<CashAccount, "id" | "name"> | null;
}

// A4: Keuangan
export interface Finance {
  id: string;
  type: FinanceType;
  amount: number;
  description: string;
  date: string;
  program_id: string | null;
  project_id: string | null;
  handover_id: string | null;
  receipt_url: string;
  wallet_id: string | null;
  bank_id: string | null;
  cash_account_id: string | null;
  created_by: string | null;
  created_at: string;
  source: string | null;
}

export interface FinanceWithDetails extends Finance {
  profiles: Pick<Profile, "id" | "full_name"> | null;
  programs: Pick<Program, "id" | "name"> | null;
  incidental_projects: Pick<IncidentalProject, "id" | "name"> | null;
  wallets: Pick<Wallet, "id" | "name"> | null;
  banks: Pick<Bank, "id" | "name"> | null;
  cash_accounts: Pick<CashAccount, "id" | "name"> | null;
  handovers: Pick<Handover, "id" | "period_from" | "period_to" | "status"> | null;
  is_external?: boolean;
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
  method: AttendanceMethod;
  timestamp: string;
  scanned_at: string | null;
}

export interface AttendanceWithProfile extends Attendance {
  profiles: Pick<Profile, "id" | "full_name" | "nim" | "avatar_url">;
  programs?: Pick<ProgramWithDetails, "id" | "name">;
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
  handover_id: string | null;
  handovers?: Pick<Handover, "id" | "period_from" | "period_to" | "status"> | null;
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
  category: TrainingCategory | null;
  created_at: string;
}

export interface AthleteCoachMapping {
  id: string;
  coach_id: string;
  athlete_id: string;
  created_at: string;
}

export interface Training {
  id: string;
  name: string;
  category: TrainingCategory;
  created_at: string;
}

export interface TrainingSession {
  id: string;
  coach_id: string | null;
  training_id: string | null;
  name: string | null;
  date: string;
  session_code: string | null;
  session_type: string | null;
  duration_minutes: number | null;
  intensity: IntensityLevel | null;
  created_at: string;
}

export interface TrainingSessionWithCoach extends TrainingSession {
  profiles: Pick<Profile, "id" | "full_name"> | null;
  trainings: Array<Pick<Training, "id" | "name" | "category">>;
  training_session_attendants: TrainingSessionAttendant[];
}

export interface TrainingSessionAttendant {
  id: string;
  session_id: string;
  athlete_id: string;
  method: AttendanceMethod;
  scanned_at: string | null;
  profiles?: Pick<Profile, "id" | "full_name" | "nim" | "avatar_url"> | null;
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
  juara: AchievementJuara | null;
  proof_url: string | null;
  status: AchievementStatus;
  rejection_reason: string | null;
  handover_id: string | null;
  handovers?: Pick<Handover, "id" | "period_from" | "period_to" | "status"> | null;
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
  juara: AchievementJuara;
  keterangan: string | null;
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
  handover_id: string | null;
  handovers?: Pick<Handover, "id" | "period_from" | "period_to" | "status"> | null;
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

// A9/A10: Pos Anggaran (Budget Items) Program Kerja & Proyek Insidental
export interface BudgetItem {
  id: string;
  program_id: string | null;
  project_id: string | null;
  parent_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetItemWithChildren extends BudgetItem {
  children: BudgetItem[];
}

// A12: Inventarisasi
export interface InventoryItem {
  id: string;
  code: string;
  name: string;
  category: InventoryItemCategory;
  stock: number;
  unit_price: number;
  condition: InventoryItemCondition;
  location: string;
  description: string;
  photo_url: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryDisposal {
  id: string;
  item_id: string;
  quantity: number;
  reason: string;
  disposal_date: string;
  value_removed: number;
  created_by: string | null;
  created_at: string;
}

export interface InventoryDisposalWithDetails extends InventoryDisposal {
  inventory_items: Pick<InventoryItem, "id" | "code" | "name"> | null;
  profiles: Pick<Profile, "id" | "full_name"> | null;
}

export interface InventoryLoan {
  id: string;
  item_id: string;
  borrower_id: string;
  quantity: number;
  borrow_date: string;
  return_date: string;
  actual_return: string | null;
  purpose: string;
  status: InventoryLoanStatus;
  approved_by: string | null;
  approved_at: string | null;
  return_condition: InventoryItemCondition | null;
  return_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryLoanWithDetails extends InventoryLoan {
  inventory_items: Pick<InventoryItem, "id" | "code" | "name" | "category">;
  profiles: Pick<Profile, "id" | "full_name" | "nim">;
}

export interface InventoryDamageLog {
  id: string;
  item_id: string;
  reported_by: string;
  incident_date: string;
  type: InventoryDamageType;
  description: string;
  estimated_cost: number;
  created_at: string;
}

export interface InventoryDamageLogWithDetails extends InventoryDamageLog {
  inventory_items: Pick<InventoryItem, "id" | "code" | "name">;
  profiles: Pick<Profile, "id" | "full_name">;
}

// A12: Pembelian Barang Inventaris
export interface InventoryPurchase {
  id: string;
  item_id: string;
  quantity: number;
  amount: number;
  subtotal: number;
  date: string;
  wallet_id: string | null;
  bank_id: string | null;
  cash_account_id: string | null;
  description: string;
  finance_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface InventoryPurchaseWithDetails extends InventoryPurchase {
  inventory_items: Pick<InventoryItem, "id" | "code" | "name">;
  wallets: Pick<Wallet, "id" | "name"> | null;
  banks: Pick<Bank, "id" | "name"> | null;
  cash_accounts: Pick<CashAccount, "id" | "name"> | null;
  profiles: Pick<Profile, "id" | "full_name"> | null;
}
