export interface Todo {
  id: string
  user_id: string
  title: string
  description: string
  status: "pending" | "in_progress" | "done"
  priority: "low" | "medium" | "high"
  due_date?: string
  tags: string[]
  created_at: string
  updated_at: string
}

export interface Note {
  id: string
  user_id: string
  title: string
  content: string
  tags: string[]
  created_at: string
  updated_at: string
}

export interface ApiKey {
  id: string
  name: string
  key?: string
  created_at: string
}

export interface User {
  id: string
  email: string
}

export interface Report {
  id: string
  user_id: string
  title: string
  content?: string
  format: "md" | "html"
  tags: string[]
  source: string
  source_key_id?: string
  created_at: string
  updated_at: string
}

export interface PublicReport {
  id: string
  title: string
  content?: string
  format: "md" | "html"
  tags: string[]
  source: string
  created_at: string
  updated_at: string
}

export interface PublicReportSource {
  source: string
  count: number
}

export interface Bookmark {
  id: string
  user_id: string
  url: string
  title: string
  summary: string
  content?: string
  tags: string[]
  source: string
  is_read: boolean
  created_at: string
  updated_at: string
}

export interface Expense {
  id: string
  user_id: string
  amount: number
  currency: string
  description: string
  tags: string[]
  source: string
  happened_at: string
  created_at: string
  updated_at: string
}

export interface ExpenseSummary {
  total: number
  count: number
  currency: string
  by_tag: Record<string, number>
}

export type SkillOutcome = 'success' | 'failure' | 'partial' | 'user_corrected'

export interface SkillLog {
  id: string
  user_id: string
  skill_name: string
  skill_version: string
  agent_id: string
  session_id: string
  trigger_text: string
  was_triggered: boolean
  outcome: SkillOutcome
  failure_reason?: string
  user_correction?: string
  tool_calls?: unknown
  duration_ms?: number
  created_at: string
}

export interface SkillStats {
  skill_name: string
  total_runs: number
  success_rate: number
  failure_rate: number
  correction_rate: number
}

export interface SkillVersion {
  id: string
  skill_name: string
  version: string
  content_hash: string
  package_hash?: string
  source_id?: string
  source_revision_id?: string
  content: string
  agent_id: string
  change_summary: string
  eval_pass_rate?: number
  is_active: boolean
  published_at: string
}

export type SkillSourceType = "git" | "local"
export type SkillSyncMode = "server_pull" | "client_push"
export type SkillVisibility = "private" | "shared" | "public"
export type SkillSourceStatus = "active" | "disabled" | "error"

export interface GitSourceSyncState {
  status: "succeeded" | "failed"
  provider?: "github" | "gitlab"
  ref?: string
  commit_sha?: string
  package_hash?: string
  error?: string
  synced_at: string
}

export interface SkillSourceMetadata {
  git_sync?: GitSourceSyncState
  [key: string]: unknown
}

export interface SkillSource {
  id: string
  user_id?: string
  name: string
  type: SkillSourceType
  repository_url: string
  package_path: string
  default_ref: string
  sync_mode: SkillSyncMode
  visibility: SkillVisibility
  status: SkillSourceStatus
  metadata?: SkillSourceMetadata
  created_at: string
  updated_at: string
}

export interface SyncGitSourceRequest {
  ref?: string
  activate?: boolean
  index?: boolean
}

export interface SyncGitSourceResponse {
  source: SkillSource
  provider: "github" | "gitlab"
  ref: string
  commit_sha: string
  revision: SkillSourceRevision
  version: SkillVersion
  files: SkillVersionFile[]
  index?: IndexSkillsResponse
}

export interface SkillSourceRevision {
  id: string
  user_id?: string
  source_id: string
  skill_version_id?: string
  commit_sha: string
  local_snapshot_id: string
  tree_hash: string
  package_hash: string
  status: string
  error?: string
  created_at: string
}

export interface SkillVersionFile {
  id: string
  user_id?: string
  source_revision_id: string
  version_id?: string
  path: string
  kind: string
  sha256: string
  size_bytes: number
  mime_type: string
  indexable: boolean
  content_snapshot?: string
  created_at: string
}

export interface CreateSkillSourceRequest {
  name?: string
  type: SkillSourceType
  repository_url: string
  package_path?: string
  default_ref?: string
  sync_mode?: SkillSyncMode
  visibility?: SkillVisibility
  status?: SkillSourceStatus
}

export type SkillSignal = SkillLog

export interface CreateSkillVersionRequest {
  skill_name: string
  version: string
  content: string
  agent_id?: string
  change_summary?: string
  eval_pass_rate?: number
  activate?: boolean
}

export interface IndexedSkill {
  skill_name: string
  version: string
  version_id: string
  document_id: string
}

export interface SkillIndexError {
  skill_name: string
  error: string
}

export interface IndexSkillsResponse {
  indexed: IndexedSkill[]
  errors: SkillIndexError[]
}

export interface SkillSearchItem {
  skill_name: string
  version: string
  version_id: string
  title: string
  description: string
  score: number
  rank: number
  document_id: string
  content?: string
  published_at?: string
  change_summary?: string
}

export interface SearchSkillsResponse {
  items: SkillSearchItem[]
  total: number
}


// Phase 3 progressive skill delivery DTOs.
export interface SkillCatalogItemDTO {
  skill_name: string
  description: string
  version: string
  version_id: string
  package_hash: string
  source_id?: string
  triggers: string[]
  capabilities: string[]
  constraints: string[]
  dependencies: string[]
  resource_count: number
  resource_kinds: string[]
  compiler_name: string
  compiler_version: string
  artifact_available: boolean
  compiled_at: string
  published_at: string
}

export interface SkillCatalogResponseDTO {
  items: SkillCatalogItemDTO[]
  total: number
  limit: number
  offset: number
}

export interface CompileSkillsRequestDTO {
  version_id?: string
}

export interface CompileSkillErrorDTO {
  skill_name: string
  error: string
}

export interface CompileSkillsResponseDTO {
  items: SkillCatalogItemDTO[]
  errors: CompileSkillErrorDTO[]
}

export interface SkillInstructionsDTO {
  version_id: string
  skill_name: string
  version: string
  instructions: string
  content_hash: string
  published_at: string
}

export interface SkillResourceManifestItemDTO {
  file_id: string
  path: string
  kind: string
  sha256: string
  size_bytes: number
  mime_type: string
  indexable: boolean
  text_available: boolean
}

export interface SkillResourcesResponseDTO {
  version_id: string
  skill_name: string
  version: string
  items: SkillResourceManifestItemDTO[]
  total: number
  limit: number
  offset: number
}

export interface SkillResourceDTO {
  version_id: string
  file_id: string
  path: string
  kind: string
  sha256: string
  size_bytes: number
  mime_type: string
  content: string
}

// Phase 4 离线确定性质量报告 DTO，与 backend/internal/skills/quality_model.go 一致。
export interface SkillQualityPackageRefDTO {
  version_id: string
  skill_name: string
  version: string
  package_hash: string
}

export type SkillQualitySeverityDTO = "blocker" | "error" | "warning"

export interface SkillQualityCheckDTO {
  id: string
  severity: SkillQualitySeverityDTO
  passed: boolean
  applicable: boolean
  evidence: Record<string, unknown>
}

export interface SkillQualityFileChangeDTO {
  path: string
  before_hash?: string
  after_hash?: string
}

export interface SkillQualityRoutingDiffDTO {
  field: string
  before: string[]
  after: string[]
}

export interface SkillQualityComparisonDTO {
  status: string
  baseline_version_id?: string
  package_hash_changed: boolean
  resource_manifest_changed: boolean
  files_added: SkillQualityFileChangeDTO[]
  files_removed: SkillQualityFileChangeDTO[]
  files_modified: SkillQualityFileChangeDTO[]
  routing_diffs: SkillQualityRoutingDiffDTO[]
  lint_regressions: string[]
  eval_regressions: string[]
}

export interface SkillQualityOutcomeCountsDTO {
  success: number
  failure: number
  partial: number
  user_corrected: number
  other: number
}

export interface SkillQualitySuggestionDTO {
  category: string
  count: number
  denominator: number
  rate: number
  fingerprint: string
  log_ids: string[]
}

export interface SkillQualityTelemetryDTO {
  status: string
  cutoff: string
  considered: number
  triggered: number
  bypass: number
  outcome_denominator: number
  outcomes: SkillQualityOutcomeCountsDTO
  suggestions: SkillQualitySuggestionDTO[]
}

export interface SkillQualityReportDTO {
  schema_version: string
  engine_version: string
  checkset_version: string
  input: SkillQualityPackageRefDTO
  lint: SkillQualityCheckDTO[]
  eval: SkillQualityCheckDTO[]
  comparison: SkillQualityComparisonDTO
  telemetry: SkillQualityTelemetryDTO
}

export interface SkillQualityRunDTO {
  id: string
  skill_version_id: string
  baseline_version_id?: string
  engine_version: string
  checkset_version: string
  input_package_hash: string
  baseline_package_hash?: string
  telemetry_cutoff: string
  status: string
  report: SkillQualityReportDTO
  failure_message?: string
  created_at: string
  completed_at?: string
}

export interface SkillQualityRunSummaryDTO {
  id: string
  skill_version_id: string
  baseline_version_id?: string
  engine_version: string
  checkset_version: string
  input_package_hash: string
  baseline_package_hash?: string
  telemetry_cutoff: string
  status: string
  failure_message?: string
  created_at: string
  completed_at?: string
}

export interface SkillQualityRunsResponseDTO {
  items: SkillQualityRunSummaryDTO[]
  total: number
  limit: number
  offset: number
}

export interface CreateSkillQualityRunRequestDTO {
  baseline_version_id?: string
}
