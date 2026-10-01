export interface ResearcherProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  organization?: string;
  phone_number?: string;
  is_active: boolean;
  last_login?: string;
  research_interests?: string[];
  online_status?: 'online' | 'away' | 'offline';
}

export interface ConversationMember {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  user_role: string;
  joined_at: string;
  last_read_at?: string;
}

export interface Attachment {
  id: string;
  filename: string;
  file_path: string;
  file_size: string;
  file_type: string;
  sha256_hash: string;
  duplicate_status: string;
  uploaded_by: string;
  uploaded_by_name?: string;
  created_at: string;
}

export interface DatasetRef {
  id: string;
  dataset_id: string;
  dataset_name: string;
  dataset_type?: string;
  file_size?: string;
  verification_status?: string;
  duplicate_status?: string;
  shared_by: string;
  shared_by_name?: string;
  meta_data?: Record<string, any>;
  created_at: string;
}

export interface PinnedFinding {
  id: string;
  conversation_id: string;
  message_id?: string;
  author_id: string;
  author_name: string;
  finding_text: string;
  related_dataset_id?: string;
  related_dataset_name?: string;
  pinned_by_id: string;
  pinned_by_name: string;
  created_at: string;
}

export interface ResearchMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  message_type: 'text' | 'file' | 'dataset' | 'ai_response' | 'system';
  parent_message_id?: string;
  parent_message_preview?: string;
  is_edited: boolean;
  is_pinned: boolean;
  reactions: Record<string, string[]>;
  attachments: Attachment[];
  dataset_refs: DatasetRef[];
  created_at: string;
  updated_at: string;
}

export interface ResearchConversation {
  id: string;
  type: 'direct' | 'group';
  title: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  unread_count: number;
  last_message?: ResearchMessage;
  members: ConversationMember[];
  direct_target_user?: ResearcherProfile;
}

export interface ConversationDetail {
  conversation: ResearchConversation;
  members: ConversationMember[];
  pinned_findings: PinnedFinding[];
  shared_files: Attachment[];
  shared_datasets: DatasetRef[];
  total_messages: number;
}

export interface AIResearchResponse {
  blocked: boolean;
  command?: string;
  ai_response: string;
  confidence_score: number;
  context_sources: string[];
  suggested_actions: string[];
  execution_time_ms: number;
}

export interface ResearchNotification {
  id: string;
  type: 'direct_message' | 'group_message' | 'group_invite' | 'file_shared' | 'dataset_shared' | 'mention' | 'reply';
  title: string;
  content: string;
  conversation_id?: string;
  message_id?: string;
  is_read: boolean;
  created_at: string;
}

export interface SearchResult {
  messages: ResearchMessage[];
  researchers: ResearcherProfile[];
  groups: ResearchConversation[];
  files: Attachment[];
  datasets: DatasetRef[];
  findings: PinnedFinding[];
}
