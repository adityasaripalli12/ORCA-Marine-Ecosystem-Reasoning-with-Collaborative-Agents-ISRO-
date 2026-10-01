export type UserRole = 'Admin' | 'Government' | 'Researcher' | 'Student' | 'Shipping' | 'Coastal Guard';

/** Central role configuration — single source of truth for badge styles, labels, and permissions */
export const ROLE_CONFIG = {
  Admin: {
    label: 'System Administrator',
    emoji: '🔴',
    color: 'rose',
    bgClass:     'bg-rose-500/10',
    textClass:   'text-rose-400',
    borderClass: 'border-rose-500/30',
    permissions: [
      'Full Platform Access',
      'User Management',
      'Dataset Management',
      'Security Dashboard',
      'Audit Logs',
      'System Settings',
      'AI Access',
      'Advanced Visualization',
      'All Role Management',
    ],
    navAccess: ['dashboard', 'flowchat-ai', 'research-chat', 'upload', 'datasets', 'visualization', 'security', 'audit-logs', 'user-management', 'settings'],
  },
  Government: {
    label: 'Government Agency',
    emoji: '🟢',
    color: 'emerald',
    bgClass:     'bg-emerald-500/10',
    textClass:   'text-emerald-400',
    borderClass: 'border-emerald-500/30',
    permissions: [
      'Regional Ocean Intelligence',
      'Dataset Read Access',
      'Ocean Condition Analysis',
      'Environmental Anomaly Analysis',
      'Alerts & Warnings',
      'Visualization',
      'Report Generation',
      'AI Research / Chat',
    ],
    navAccess: ['dashboard', 'ocean-intel', 'flowchat-ai', 'regional-analysis', 'alerts', 'visualization', 'reports'],
  },
  Researcher: {
    label: 'Research Scientist',
    emoji: '🔵',
    color: 'cyan',
    bgClass:     'bg-cyan-500/10',
    textClass:   'text-cyan-400',
    borderClass: 'border-cyan-500/30',
    permissions: [
      'Full Scientific Dataset Access',
      'Dataset Upload',
      'Advanced AI Queries',
      'Advanced Visualization',
      'SQL / Query Inspection',
      'Dataset Comparison',
      'Statistical Analysis',
      'Research Report Generation',
    ],
    navAccess: ['dashboard', 'research-chat', 'flowchat-ai', 'upload', 'datasets', 'visualization', 'reports'],
  },
  Student: {
    label: 'Student / Public Access',
    emoji: '🟣',
    color: 'violet',
    bgClass:     'bg-violet-500/10',
    textClass:   'text-violet-400',
    borderClass: 'border-violet-500/30',
    permissions: [
      'Basic Dataset Access',
      'Educational AI Chat',
      'Basic Visualization',
      'Guided Questions',
      'Voice Input',
      'Multilingual Interaction',
    ],
    navAccess: ['dashboard', 'learn-ocean', 'flowchat-ai', 'visualization'],
  },
  Shipping: {
    label: 'Shipping & Maritime',
    emoji: '🚢',
    color: 'amber',
    bgClass:     'bg-amber-500/10',
    textClass:   'text-amber-400',
    borderClass: 'border-amber-500/30',
    permissions: [
      'Maritime Ocean Condition Info',
      'Regional Ocean Analysis',
      'Maritime Operational Map',
      'Temperature & Salinity',
      'Pressure & Depth',
      'Current-related Data',
      'Maritime AI Assistant',
      'Maritime Operations Alerts',
    ],
    navAccess: ['dashboard', 'maritime-intel', 'flowchat-ai', 'ocean-conditions', 'operational-map', 'alerts', 'visualization', 'reports'],
  },
  'Coastal Guard': {
    label: 'Coastal Guard Safety',
    emoji: '🛡️',
    color: 'orange',
    bgClass:     'bg-orange-500/10',
    textClass:   'text-orange-400',
    borderClass: 'border-orange-500/30',
    permissions: [
      'Maritime Safety Information',
      'Ocean Anomaly Alerts',
      'Coastal Alerts Dashboard',
      'Regional Visualization',
      'Operational Safety Map',
      'Safety AI Assistant',
      'Report Generation',
    ],
    navAccess: ['dashboard', 'maritime-safety', 'flowchat-ai', 'ocean-conditions', 'coastal-alerts', 'operational-map', 'visualization', 'reports'],
  },
} as const satisfies Record<UserRole, {
  label: string; emoji: string; color: string;
  bgClass: string; textClass: string; borderClass: string;
  permissions: readonly string[];
  navAccess: readonly string[];
}>;

export type UserStatus = 'Active' | 'Pending Approval' | 'Suspended' | 'Disabled' | 'Deleted';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organization?: string;
  avatar?: string;
  status: UserStatus;
  lastLogin: string;
  mfaEnabled?: boolean;
}

export interface GovAccessKey {
  id: string;
  key: string;
  organization: string;
  issuedTo: string;
  createdAt: string;
  expiresAt: string;
  status: 'Active' | 'Expired' | 'Deactivated';
}

export interface DatasetMetadata {
  latitude?: number;
  longitude?: number;
  temperature?: number; // °C
  pressure?: number;    // dbar
  salinity?: number;    // PSU
  depth?: number;       // meters
  record_count?: number;
  [key: string]: any;
}

export interface DatasetItem {
  id: string;
  filename: string;
  fileSize: string;
  format: '.nc' | '.csv' | '.json';
  sha256: string;
  verificationStatus: 'Verified' | 'Pending' | 'Failed' | 'Invalid' | 'Requires Review' | 'VALID' | 'INVALID' | 'QUARANTINED';
  duplicateStatus: 'Unique' | 'Duplicate' | 'Possible Duplicate' | 'Under Review' | 'Quarantined' | 'Invalid' | 'Processing...';
  similarityScore?: number;
  contentFingerprint?: string;
  duplicateOfId?: string;
  aiAnalysis?: any;
  validationDetails?: any;
  uploadedBy: string;
  uploadDate: string;
  rowCount: number;
  metadata: DatasetMetadata;
}

export interface SecurityEvent {
  id: string;
  time: string;
  user: string;
  action: string;
  source?: string;
  riskScore?: number;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  actionTaken?: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Blocked' | 'Allowed' | 'Flagged' | 'Denied' | string;
  deviceId?: string;
  latitude?: number;
  longitude?: number;
  userRole?: string;
  details: string;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  username: string;
  role: UserRole;
  organization?: string;
  action: string;
  status: 'Success' | 'Failed' | 'Denied' | 'Blocked';
  severity?: 'Low' | 'Medium' | 'High' | 'Critical';
  ipAddress: string;
  browser?: string;
  os?: string;
  description: string;
}

export interface ChatMessageLocation {
  name: string;
  deviceId?: string;
  latitude: number;
  longitude: number;
  depth?: number;
  temp?: number;
  battery?: number;
  signal?: number;
  salinity?: number;
  pressure?: number;
  ph?: number;
  do?: number;
  status?: string;
  last_updated?: string;
  anomalies?: string[];
  details?: string;
  type?: string;
}

export interface ObservationData {
  title: string;
  value_display: string;
  subtitle?: string;
  parameter?: string;
  value?: number;
  unit?: string;
  region?: string;
  wmo_id?: string;
  depth?: number;
  latitude?: number;
  longitude?: number;
  observation_time?: string;
  quality_flag?: string;
  source?: string;
  dataset?: string;
  stats?: {
    count?: number;
    mean?: number;
    min?: number;
    max?: number;
    time_range?: string;
    max_z_score?: number;
    [key: string]: any;
  };
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  intent?: string;
  mapAction?: 'SHOW_DEVICE' | 'SHOW_ALL_DEVICES' | 'SHOW_CRITICAL_DEVICES' | 'SHOW_ANOMALIES' | 'SHOW_LOCATION' | 'ASK_DEVICE' | 'NONE' | string;
  deviceId?: string;
  location?: { latitude: number; longitude: number };
  sqlQuery?: string;
  confidenceScore?: number;
  confidenceLabel?: string;
  observationData?: ObservationData;
  provenance?: {
    source: string;
    dataset?: string;
    wmo_id?: string;
    observation_time?: string;
    data_age?: string;
    quality_flag?: string;
    confidence_label?: string;
    evidence_score?: number;
  };
  retrievedDocs?: { title: string; floatId: string; relevance: string }[];
  executionTimeMs?: number;
  isBlocked?: boolean;
  hasGeoData?: boolean;
  requiresMap?: boolean;
  requiresConfirmation?: boolean;
  confirmationAction?: string;
  riskScore?: number;
  riskLevel?: string;
  locations?: ChatMessageLocation[];
  sources?: string[];
  datasetUsed?: string;
  recordsRetrieved?: number;
  suggestions?: string[];
  inputMode?: 'voice' | 'text';
  detectedLanguage?: string;
  translatedQuery?: string;
}



export interface ChatConversation {
  id: string;
  title: string;
  lastUpdated: string;
  isPinned?: boolean;
  messages: ChatMessage[];
}

export interface ArgoFloat {
  id: string;
  floatId: string;
  oceanRegion: string;
  latitude: number;
  longitude: number;
  temperature: number;
  salinity: number;
  pressure: number;
  depth: number;
  lastTransmission: string;
  status: 'Active' | 'Maintenance' | 'Historical';
}

export interface OceanAlertItem {
  id: string;
  hazard_event_id?: string;
  alert_level: 'NORMAL' | 'ADVISORY' | 'WARNING' | 'CRITICAL';
  hazard_type: string;
  title: string;
  message: string;
  action_guidance?: string;
  confidence_score: number;
  confidence_label: string;
  latitude?: number;
  longitude?: number;
  region?: string;
  sources?: string;
  fingerprint: string;
  escalation_count?: number;
  created_at: string;
  updated_at: string;
  expires_at: string;
  status: string;
}

export interface HazardSummary {
  overall_status: 'NORMAL' | 'ADVISORY' | 'WARNING' | 'CRITICAL';
  active_alerts_total: number;
  critical_alerts: number;
  warning_alerts: number;
  advisory_alerts: number;
  recent_alerts: OceanAlertItem[];
}

