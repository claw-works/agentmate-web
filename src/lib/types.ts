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
  role?: string
}

export interface AdminTenant {
  id: string
  name: string
  account_count: number
  created_at: string
  revoked_at?: string
}

export interface AdminTenantSummary {
  tenant_id: string
  name: string
  accounts: number
  sessions: number
  memories: number
  pending_memories: number
  ontology_spaces: number
  actions: number
  pending_actions: number
  failed_actions: number
}

export interface AdminAccount {
  id: string
  name: string
  external_ref?: string
  key_count: number
  created_at: string
}

export interface AdminRecord {
  id: string
  account_id: string
  account_name: string
  status?: string
  title?: string
  [key: string]: unknown
}

export interface AdminRecordPage {
  items: AdminRecord[]
  total: number
  limit: number
  offset: number
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

// ─── Knowledge Registry (K1/K2) DTOs，与 backend/internal/knowledge/model.go 一致 ───

export type KnowledgeSourceType = "git" | "local"

export interface KnowledgeGitSyncState {
  status: "succeeded" | "failed"
  provider?: string
  ref?: string
  commit_sha?: string
  package_hash?: string
  error?: string
  synced_at: string
}

export interface KnowledgeSourceMetadata {
  git_sync?: KnowledgeGitSyncState
  [key: string]: unknown
}

export interface KnowledgeSource {
  id: string
  account_id: string
  user_id?: string
  key_id?: string
  name: string
  type: KnowledgeSourceType
  repository_url: string
  package_path: string
  default_ref: string
  sync_mode: string
  status: string
  active_revision_id?: string
  metadata?: KnowledgeSourceMetadata
  created_at: string
  updated_at: string
}

export interface KnowledgeSourceRevision {
  id: string
  account_id: string
  source_id: string
  revision_key: string
  commit_sha: string
  local_snapshot_id: string
  tree_hash: string
  package_hash: string
  manifest?: KnowledgeManifest
  status: string
  error?: string
  created_at: string
}

export interface KnowledgeManifest {
  name: string
  description?: string
  profile?: string
  language?: string
  include?: string[]
  exclude?: string[]
  citation_policy?: string
}

export interface KnowledgeDocumentSummary {
  id: string
  source_id: string
  revision_id: string
  path: string
  sha256: string
  size_bytes: number
  mime_type: string
  indexable: boolean
  created_at: string
}

export interface KnowledgeDocument {
  id: string
  account_id: string
  source_id: string
  revision_id: string
  path: string
  sha256: string
  size_bytes: number
  mime_type: string
  indexable: boolean
  content_snapshot?: string
  created_at: string
}

export interface CreateKnowledgeSourceRequest {
  name?: string
  type: KnowledgeSourceType
  repository_url: string
  package_path?: string
  default_ref?: string
}

export interface SyncKnowledgeSourceRequest {
  ref?: string
}

export interface SyncKnowledgeSourceResponse {
  source: KnowledgeSource
  provider: string
  ref: string
  commit_sha: string
  revision: KnowledgeSourceRevision
  manifest: KnowledgeManifest
  documents: KnowledgeDocumentSummary[]
}

export interface KnowledgeDocumentListResponse {
  revision_id: string
  items: KnowledgeDocumentSummary[]
  total: number
  limit: number
  offset: number
}

export interface KnowledgeDocumentLinkItem {
  direction: "out" | "in"
  document_id?: string
  path: string
}

export interface KnowledgeDocumentLinksResponse {
  document_id: string
  revision_id: string
  items: KnowledgeDocumentLinkItem[]
  total: number
  limit: number
  offset: number
}

export interface KnowledgeCatalogItem {
  source_id: string
  name: string
  domain?: string
  description?: string
  profile?: string
  language?: string
  citation_policy?: string
  // 声明的匹配面：Skill knowledge contract 的 discovery 就是对这两个列表做匹配。
  capabilities?: string[]
  languages?: string[]
  type: string
  active_revision_id: string
  package_hash: string
  document_count: number
  indexed_chunks: number
  failed_chunks: number
  pending_chunks: number
  index_status: "indexed" | "partial" | "failed" | "not_indexed"
}

export interface KnowledgeCatalogResponse {
  items: KnowledgeCatalogItem[]
  total: number
  limit: number
  offset: number
}

export interface IndexedKnowledgeSource {
  source_id: string
  name: string
  revision_id: string
  documents: number
  chunks_indexed: number
  chunks_failed: number
  links_rebuilt: number
  stale_deleted: number
  truncated_documents: number
}

export interface KnowledgeIndexError {
  source_id: string
  error: string
}

export interface IndexKnowledgeResponse {
  indexed: IndexedKnowledgeSource[]
  errors: KnowledgeIndexError[]
}

export interface SearchKnowledgeRequest {
  query: string
  top_k?: number
  source_ids?: string[]
  include_content?: boolean
}

export interface KnowledgeSearchHit {
  document_id: string
  source_id: string
  revision_id: string
  path: string
  heading_path?: string
  chunk_key: string
  knowledge_base?: string
  score: number
  rank: number
  snippet: string
  content?: string
  neighbors: KnowledgeDocumentLinkItem[]
}

export interface SearchKnowledgeResponse {
  items: KnowledgeSearchHit[]
  total: number
}

// ─── Memory Plane (M1–M3) DTOs，与 backend/internal/memory/model.go 一致 ───

export interface MemoryEntry {
  id: string
  scope_type: string
  scope_key: string
  memory_type: string
  title: string
  content: string
  summary: string
  confidence: number
  importance: number
  status: string
  valid_from: string
  valid_to?: string
  superseded_by?: string
  source_event_id?: string
  /** 产出这条候选的蒸馏运行；只有 extraction_method='llm' 的条目才有值。 */
  distill_run_id?: string
  extraction_method: string
  /** 抽取器标识，形如 "<model>/prompt-<版本>"。审核时用来判断"这批候选出自哪个配置"。 */
  extractor_version: string
  access_count: number
  useful_count: number
  harmful_count: number
  created_at: string
  updated_at: string
}

export interface MemoryEvidence {
  id: string
  memory_id: string
  source_type: string
  source_id: string
  excerpt: string
  created_at: string
}

export interface MemoryEntryDetail extends MemoryEntry {
  evidence: MemoryEvidence[]
  indexing?: { status: string; error?: string }
}

export interface MemorySearchItem {
  entry: MemoryEntryDetail | null
  rank: number
  score: number
  retrieval_score: number
  feedback_adjustment: number
  channels: string[]
  hit_reason: string
}

export interface MemorySearchRequest {
  query: string
  top_k?: number
  scope_type?: string
  scope_key?: string
  memory_type?: string
  status?: string
}

export interface MemoryFeedback {
  id: string
  memory_id: string
  signal: string
  reason?: string
  session_id?: string
  skill_version_id?: string
  observed_at: string
  created_at: string
}

export interface MemoryTimelineItem {
  kind: "skill_log" | "memory_event"
  id: string
  occurred_at: string
  session_id?: string
  skill_version_id?: string
  skill_name?: string
  skill_version?: string
  outcome?: string
  was_triggered?: boolean
  failure_reason?: string
  duration_ms?: number
  event_type?: string
  attributed: boolean
}

export interface MemoryTimelineResponse {
  session_id: string
  items: MemoryTimelineItem[]
  total: number
  skill_log_count: number
  memory_event_count: number
  unattributed_count: number
  truncated: boolean
}

export interface MemoryEntryAttribution {
  entry_id: string
  source_event_id?: string
  session_id?: string
  skill_version_id?: string
  skill_name?: string
  skill_version?: string
  resolution: "skill_version" | "session_only" | "event_only" | "none"
  session_timeline?: MemoryTimelineItem[]
}

export interface MemoryEntryListResponse {
  items: MemoryEntry[]
  total: number
  limit: number
  offset: number
}


// ─── Working memory（会话级原始记录），与 backend/internal/memory/working_model.go 一致 ───
//
// 这一层保存的是会话原文：对话消息、工具结果、草稿。它不进检索索引，只按
// 服务端分配的 seq 顺序回放，所以前端能做的是审计（看）和删除，不做搜索。

export type WorkingSessionStatus = "active" | "archived"
export type WorkingItemType = "message" | "tool_result" | "draft"
export type WorkingItemRole = "system" | "user" | "assistant" | "tool"

export interface WorkingSession {
  id: string
  account_id: string
  user_id: string
  key_id?: string
  title: string
  agent: string
  /** 会话当前的执行引擎（kiro-cli / claude-code / codex / pi 等）。与 agent 正交：
   *  agent 是产品，engine 是它底下跑的执行器，会话进行中可以切换。 */
  engine: string
  /** 这段对话关于什么，通常是 project:<key>。蒸馏据此把项目规矩归到项目、个人偏好升到
   *  global。它不控制可见性（那只由 account 决定），控制的是相关性。 */
  scope_type: string
  scope_key: string
  status: string
  metadata: unknown
  /** 已分配的最高序号，只增不减；删条目会留下空洞。 */
  last_seq: number
  /** 已蒸馏到的序号。与 last_seq 的差就是还有多少原文没被抽取过。 */
  distilled_seq: number
  created_at: string
  updated_at: string
}

export interface WorkingItem {
  id: string
  account_id: string
  user_id: string
  key_id?: string
  session_id: string
  seq: number
  item_type: string
  role?: string
  /** 产出这一条的引擎，写入时固化。会话之后切换引擎不会改变已写入的条目。 */
  engine?: string
  content: string
  metadata: unknown
  idempotency_key: string
  content_hash: string
  created_at: string
}

/** 本账号已在用的 engine 值及用量。engine 是自由文本，靠它防拼写漂移。 */
export interface WorkingEngineUsage {
  engine: string
  session_count: number
  item_count: number
}

export interface WorkingSessionListResponse {
  items: WorkingSession[]
  total: number
  limit: number
  offset: number
}

export interface WorkingReplayResponse {
  session_id: string
  items: WorkingItem[]
  after_seq: number
  last_seq: number
  /** 服务端精确判定，不要用 items.length === limit 推断：删条目会留下序号空洞。 */
  has_more: boolean
}

export interface DeleteWorkingSessionResponse {
  deleted: boolean
  items_deleted: number
}

export interface UpdateWorkingSessionRequest {
  title?: string
  status?: string
  /** 改 engine 就是"从现在起切到这个引擎"：已写入的条目保持原样，之后追加的继承新值。 */
  engine?: string
  /** 改 scope 就是"从现在起这段对话属于这个项目"：已抽出的候选保持原有 scope。 */
  scope_type?: string
  scope_key?: string
  metadata?: Record<string, unknown>
}

// ─── 蒸馏（对话原文 → durable memory 候选），与 backend/internal/memory/distill_model.go 一致 ───
//
// 候选一律以 pending 落库、不参与检索，要经人工放行才进召回。所以审核界面是这套机制
// 的必要组成部分，不是可选增强。

export type DistillRunStatus = "queued" | "running" | "succeeded" | "failed" | "skipped"

export interface DistillRun {
  id: string
  account_id: string
  user_id: string
  key_id?: string
  session_id: string
  from_seq: number
  to_seq: number
  /** 覆盖率显式记录：读了多少 / 一共有多少。不靠推断，否则"没抽出东西"无从解释。 */
  items_examined: number
  items_available: number
  candidates_written: number
  candidates_duplicate: number
  trigger: "on_demand" | "sweep"
  status: string
  model: string
  prompt_version: string
  input_tokens: number
  output_tokens: number
  cost_micros: number
  /** false 表示"没人告诉我们单价"，区别于"真的没花钱"。 */
  cost_priced: boolean
  error?: string
  note?: string
  attempt: number
  max_attempts: number
  queued_at: string
  started_at?: string
  finished_at?: string
  created_at: string
  updated_at: string
}

export interface DistillRunDetail extends DistillRun {
  candidates: MemoryEntry[]
}

export interface DistillRunListResponse {
  items: DistillRun[]
  total: number
  limit: number
  offset: number
}

export interface PromoteEntryResponse {
  entry: MemoryEntry
  /** 放行是候选第一次进检索索引，失败了必须报出来——否则会有一条"已放行却搜不到"的记忆。 */
  indexing?: { status: string; document_id?: string; error?: string }
}

export type ActionRunStatus =
  | "proposed"
  | "awaiting_confirmation"
  | "running"
  | "succeeded"
  | "failed"
  | "partial"
  | "cancelled"

export interface ActionRunStep {
  id: string
  action_run_id: string
  step_kind: string
  status: string
  public_summary?: string
  sequence: number
  details: Record<string, unknown>
  created_at: string
}

export interface ActionRun {
  id: string
  account_id: string
  space_id: string
  action_type_id: string
  action_binding_id: string
  capability_version_id: string
  target_object_id: string
  session_id?: string
  idempotency_key: string
  input: Record<string, unknown>
  precondition_result: Record<string, unknown>
  output: Record<string, unknown>
  verification_result: Record<string, unknown>
  confirmation_state: string
  status: ActionRunStatus
  error?: string
  execution_mode: "sync" | "async"
  attempt: number
  max_attempts: number
  cancel_requested: boolean
  requested_by_user_id?: string
  requested_by_key_id?: string
  created_at: string
  updated_at: string
  confirmed_at?: string
  started_at?: string
  finished_at?: string
  steps?: ActionRunStep[]
}

export interface ActionRunListResponse {
  items: ActionRun[]
  total: number
  limit: number
  offset: number
}

export interface ActionRunStats {
  total: number
  by_status: Record<string, number>
  average_latency_millis: number
  average_attempts: number
  stale_running: number
  awaiting_confirmation: number
  verification_attention: number
}

export interface ActionRunHealth {
  status: "healthy" | "warning" | "critical"
  stats: ActionRunStats
  alerts: { code: string; severity: string; message: string; value: unknown }[]
}
