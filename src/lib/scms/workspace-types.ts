import type { Assignment } from "./access";
export type Row = { id: string; [key: string]: any };
export type OpRecord = Row & {
  kind: string;
  club_id: string;
  branch_id: string | null;
  member_id: string | null;
  data: Record<string, any>;
  version: number;
  created_at: string;
  updated_at: string;
};
export type Workspace = {
  user: Row;
  roles: Assignment[];
  approval_requests: Row[];
  clubs: Row[];
  club_branches: Row[];
  members: Row[];
  member_roles: Row[];
  guardian_relationships: Row[];
  volunteer_profiles: Row[];
  scms_records: OpRecord[];
  scms_karatetech_participant_links: Row[];
  sync_history: Row[];
  audit_logs: Row[];
  scms_payment_attempts: Row[];
};
