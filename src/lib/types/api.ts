// ============================================================================
// SIORG API Response Types
// Standardized response format for all API endpoints
// ============================================================================

// ----------------------------------------------------------------------------
// Standard API Response Envelope
// ----------------------------------------------------------------------------

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface ApiMeta {
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  /** Role user aktif, dikirim pada response tertentu (misal katalog laporan). */
  userRole?: string;
}

// ----------------------------------------------------------------------------
// Pagination Query Params
// ----------------------------------------------------------------------------

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
}

// ----------------------------------------------------------------------------
// Auth Types
// ----------------------------------------------------------------------------

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: {
    id: string;
    email: string;
  };
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
}

export interface SignupRequest {
  email: string;
  password: string;
  full_name: string;
  nim: string;
  phone_number?: string;
  division_id?: string;
  role?: string;
}

// Profile Types
export interface UpdateProfileRequest {
  full_name?: string;
  phone_number?: string;
  avatar_url?: string;
}

export interface AdminUpdateProfileRequest extends UpdateProfileRequest {
  role?: string;
  division_id?: string;
  status?: string;
}

// Program Types
export interface CreateProgramRequest {
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  budget_estimate?: number;
  division_id?: string;
  proposal_url?: string;
}

export interface UpdateProgramRequest extends Partial<CreateProgramRequest> {
  status?: string;
  lpj_url?: string;
}

// Task Types
export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority?: string;
  due_date?: string;
  assigned_to?: string;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  due_date?: string;
  assigned_to?: string;
}

// Program Member Types
export interface AddProgramMemberRequest {
  user_id: string;
  role_in_program: string;
}

// Finance Types
export interface CreateFinanceRequest {
  type: "INCOME" | "EXPENSE";
  amount: number;
  description: string;
  date: string;
  program_id?: string;
  project_id?: string;
  receipt_url: string;
  wallet_id?: string;
  bank_id?: string;
  cash_account_id?: string;
}

// Dues Types
export interface CreateDuesTemplateRequest {
  title: string;
  amount: number;
  due_date: string;
}

export interface PayDuesRequest {
  payment_date: string;
  proof_url: string;
}

export interface VerifyDuesRequest {
  status: "PAID" | "UNPAID";
  feedback?: string;
}

// Letter Types
export interface CreateLetterRequest {
  type: "INCOMING" | "OUTGOING";
  title: string;
  sender: string;
  date_received_sent: string;
  classification?: string;
  document_url: string;
  handover_id?: string;
  reference_number?: string;
}

export type UpdateLetterRequest = Partial<CreateLetterRequest>;

// Handover Types
export interface CreateHandoverRequest {
  period_from: string;
  period_to: string;
  handover_date: string;
  document_url?: string | null;
  witnesses: Array<{ name: string; nim: string; role: string }>;
}

export interface UpdateHandoverRequest {
  period_from?: string;
  period_to?: string;
  handover_date?: string;
  witnesses?: Array<{ name: string; nim: string; role: string }>;
  document_url?: string;
  status?: string;
}

// Achievement Types
export interface CreateAchievementRequest {
  title: string;
  description?: string;
  type: "ORGANIZATION" | "INDIVIDUAL";
  category: string;
  level: string;
  organizer?: string;
  achievement_date: string;
  proof_url?: string;
  handover_id?: string;
  participants?: {
    user_id: string;
    juara: string;
    keterangan?: string;
  }[];
}

export interface VerifyAchievementRequest {
  status: "APPROVED" | "REJECTED";
  rejection_reason?: string;
}

// Athletic Types
export interface CreateMetricRequest {
  name: string;
  type: "QUANTITATIVE" | "QUALITATIVE";
  unit?: string;
}

export interface CreateTrainingRequest {
  name: string;
  category: string;
}

export interface CreateTrainingSessionRequest {
  dates: string[];
  training_id?: string;
  session_type?: string;
  start_time?: string;
  duration_minutes?: number;
  intensity?: string;
  athlete_ids?: string[];
  handover_id?: string;
}

export interface CreateAssessmentRequest {
  athlete_id: string;
  metric_id: string;
  value: number;
  notes?: string;
}

export interface CreateAthleteTargetRequest {
  athlete_id: string;
  metric_id: string;
  target_value: number;
}

// Incidental Project Types
export interface CreateIncidentalProjectRequest {
  name: string;
  description?: string;
  urgency_level?: string;
  start_date: string;
  end_date?: string;
  budget_source?: string;
  handover_id?: string;
}

export interface UpdateIncidentalProjectRequest
  extends Partial<CreateIncidentalProjectRequest> {
  status?: string;
}

export interface CreateProjectFundRequest {
  type: "INCOME" | "EXPENSE";
  amount: number;
  source?: string;
  description?: string;
  date: string;
  receipt_url?: string;
}

export interface AddProjectTeamRequest {
  user_id: string;
  project_role?: string;
}

export interface CreateProjectMilestoneRequest {
  title: string;
  description?: string;
  due_date?: string;
}

// Settings Types
export interface UpdateOrganizationSettingsRequest {
  org_name?: string;
  org_description?: string;
  org_email?: string;
  org_logo_url?: string;
  period_year?: string;
  is_maintenance?: boolean;
  org_address?: string;
  org_phone_number?: string;
}

// ----------------------------------------------------------------------------
// Report (A13) Types
// ----------------------------------------------------------------------------

export interface ReportColumn {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
}

export interface ReportSummaryItem {
  label: string;
  value: string;
}

export interface ReportData {
  type: string;
  title: string;
  subtitle?: string;
  columns: ReportColumn[];
  rows: Record<string, string | number | null>[];
  summary: ReportSummaryItem[];
  params?: Record<string, string>;
}

export interface CreateBankRequest {
  name: string;
  account_number: string;
  account_holder: string;
  description?: string;
}

export interface UpdateBankRequest {
  name?: string;
  account_number?: string;
  account_holder?: string;
  description?: string;
}

export interface CreateCashAccountRequest {
  name: string;
  description?: string;
}

export interface UpdateCashAccountRequest {
  name?: string;
  description?: string;
}

export interface CreateWalletRequest {
  name: string;
  description?: string;
  bank_id?: string;
  cash_account_id?: string;
  is_active?: boolean;
}

export interface UpdateWalletRequest {
  name?: string;
  description?: string;
  bank_id?: string;
  cash_account_id?: string;
  is_active?: boolean;
}

export interface CreateDivisionRequest {
  name: string;
  description?: string;
}

export interface UpdateDivisionRequest {
  name?: string;
  description?: string;
}

// Inventory Purchase Types
export interface CreateInventoryPurchaseRequest {
  amount: number;
  date: string;
  wallet_id?: string;
  bank_id?: string;
  cash_account_id?: string;
  description?: string;
}

export interface CreateFakultasRequest {
  name: string;
  description?: string;
}

export interface UpdateFakultasRequest {
  name?: string;
  description?: string;
}

export interface CreateJurusanRequest {
  name: string;
  description?: string;
  fakultas_id?: string;
}

export interface UpdateJurusanRequest {
  name?: string;
  description?: string;
  fakultas_id?: string;
}
