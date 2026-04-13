const BASE = '/api';

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => req<T>('GET', path),
  post: <T>(path: string, body: unknown) => req<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => req<T>('PUT', path, body),
  delete: <T>(path: string) => req<T>('DELETE', path),
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Repo {
  id: string;
  name: string;
  gitlab_path: string;
  project_id: string | null;
  enabled: number;
  added_at: string;
}

export interface Release {
  id: string;
  name: string;
  branch_name: string;
  status: string;
  created_at: string;
  completed_at: string | null;
}

export interface ReleaseRepo {
  rr: { id: string; release_id: string; repo_id: string; deploy_status: string; risk_level: string; notes: string | null };
  repo: Repo;
}

export interface DocTicket {
  id: string;
  title: string;
  assignee: string;
  priority: string;
  risk: string;
  notes: string;
  excluded: boolean;
}

export interface DocSection {
  title: string;
  body: string;
}

export interface DocRepo {
  repoId: string;
  name: string;
  path: string;
  commitCount: number;
  ticketCount: number;
  deployStatus: string;
  riskLevel: string;
  notes: string;
  sections: DocSection[];
  tickets: DocTicket[];
}

export interface LibraryVersion {
  library: string;
  currentVersion: string;
  deployVersion: string;
  description: string;
  breakingChanges: boolean;
}

export interface ExternalDependency {
  dependency: string;
  affectedProjects: string;
  description: string;
  breakingChanges: boolean;
}

export interface DbMigration {
  migration: string;
  affectedDb: string;
  description: string;
  rollbackScript: string;
}

export interface EnvVarUpdate {
  variable: string;
  affectedProjects: string;
  oldValue: string;
  newValue: string;
  description: string;
}

export interface RiskFactors {
  dbMigrations: boolean;
  breakingApiChanges: boolean;
  infrastructureChanges: boolean;
  thirdPartyDeps: boolean;
  securityPatches: boolean;
  featureFlags: boolean;
  rollbackPlan: boolean;
}

export interface ReleaseDoc {
  // Release info
  release: { name: string; date: string; branch: string };
  releaseLead: string;
  releaseBackup: string;

  // Risk
  overallRisk: string;   // Low | Medium | High | Critical
  riskFactors: RiskFactors;
  riskNotes: string[];   // bullet points

  // Description
  summary: { totalCommits: number; totalTickets: number; reposModified: number; reposTotal: number };
  overview: string;

  // Repos + tickets (generated from GitLab)
  repos: DocRepo[];
  excludedTickets: string[];

  // Library versions (manual)
  libraryVersions: LibraryVersion[];
  externalDependencies: ExternalDependency[];

  // Migrations (manual)
  dbMigrations: DbMigration[];

  // Env vars (manual)
  envVarUpdates: EnvVarUpdate[];

  // Deployment plan
  deploymentOrder: string[];          // ordered list of repos/services
  preDeployChecklist: { item: string; checked: boolean }[];
  postDeployChecklist: { item: string; checked: boolean }[];

  // Rollback
  rollbackTriggers: string[];
  rollbackSteps: string[];
  rollbackTime: string;

  // Known issues
  knownIssues: string[];

  // Additional notes (for additional context)
  additionalNotes: string;

  // Communication
  stakeholders: { item: string; checked: boolean }[];
  deploymentWindow: { start: string; end: string; estimatedDowntime: string };

  // Sign-off
  signOff: { releaseLead: string; technicalLead: string; qaLead: string };

  // Legacy — kept for backward compat
  highlights: string[];
}

export function emptyDoc(releaseName: string, releaseDate: string, branchName: string): ReleaseDoc {
  return {
    release: { name: releaseName, date: releaseDate, branch: branchName },
    releaseLead: '',
    releaseBackup: '',
    overallRisk: 'Medium',
    riskFactors: {
      dbMigrations: false,
      breakingApiChanges: false,
      infrastructureChanges: false,
      thirdPartyDeps: false,
      securityPatches: false,
      featureFlags: false,
      rollbackPlan: false,
    },
    riskNotes: [],
    summary: { totalCommits: 0, totalTickets: 0, reposModified: 0, reposTotal: 0 },
    overview: '',
    repos: [],
    excludedTickets: [],
    libraryVersions: [],
    externalDependencies: [],
    dbMigrations: [],
    envVarUpdates: [],
    deploymentOrder: [],
    preDeployChecklist: [
      { item: 'All tests passing (unit, integration, e2e)', checked: false },
      { item: 'Code reviews completed and approved', checked: false },
      { item: 'Configuration files reviewed', checked: false },
      { item: 'Environment variables verified', checked: false },
      { item: 'Rollback plan documented', checked: false },
      { item: 'Stakeholders notified', checked: false },
    ],
    postDeployChecklist: [
      { item: 'All services healthy', checked: false },
      { item: 'Error rates normal', checked: false },
      { item: 'Response times within SLA', checked: false },
      { item: 'No critical alerts', checked: false },
      { item: 'User reports monitored', checked: false },
    ],
    rollbackTriggers: [
      'Critical functionality broken',
      'Data corruption detected',
      'Security vulnerability exposed',
      'Performance degradation > 50%',
    ],
    rollbackSteps: [
      'Stop new deployments immediately',
      'Restore previous Docker images/artifacts',
      'Rollback database migrations (if applicable)',
      'Verify system stability',
      'Notify stakeholders',
    ],
    rollbackTime: '',
    knownIssues: [],
    additionalNotes: '',
    stakeholders: [
      { item: 'Development team notified', checked: false },
      { item: 'QA team notified', checked: false },
      { item: 'Product team notified', checked: false },
      { item: 'Operations team notified', checked: false },
      { item: 'Customer support notified', checked: false },
    ],
    deploymentWindow: { start: '', end: '', estimatedDowntime: '' },
    signOff: { releaseLead: '', technicalLead: '', qaLead: '' },
    highlights: [],
  };
}

export interface PipelineRepo {
  repo: string;
  path: string;
  commits: { id: string; title: string; author: string; date: string; url: string; tickets: string[]; onMainVia?: string | null }[];
  error?: string;
}

export interface HotfixRepo {
  repo: string;
  path: string;
  mrs: { iid: number; title: string; author: string; merged_at: string | null; url: string; source_branch: string; tickets: string[] }[];
  error?: string;
}

// ─── Executive Documents ─────────────────────────────────────────────────────

export interface ExecDeliverable {
  name: string;
  description: string;
}

export interface ExecDoc {
  // Release info (pre-filled from release doc)
  releaseName: string;
  releaseDate: string;
  releaseLead: string;

  // Executive Summary
  executiveSummary: string;

  // Key Deliverables
  features: ExecDeliverable[];
  improvements: ExecDeliverable[];
  fixes: ExecDeliverable[];

  // Business Impact
  customerExperience: string;
  operationalEfficiency: string;
  revenueGrowth: string;
  riskMitigation: string;

  // Release Scope
  totalChanges: string;
  projectsUpdated: string;
  keyIntegrations: string;

  // Risk Assessment
  overallRisk: string;
  riskFactors: string[];
  mitigationStrategies: string[];

  // Ticket Summaries (plain-language per ticket)
  ticketSummaries: { id: string; summary: string }[];
}

export function emptyExecDoc(releaseName: string, releaseDate: string, releaseLead: string): ExecDoc {
  return {
    releaseName, releaseDate, releaseLead,
    executiveSummary: '',
    features: [], improvements: [], fixes: [],
    customerExperience: '', operationalEfficiency: '', revenueGrowth: '', riskMitigation: '',
    totalChanges: '', projectsUpdated: '', keyIntegrations: '',
    overallRisk: 'Low', riskFactors: [], mitigationStrategies: [],
    ticketSummaries: [],
  };
}
