/**
 * Scms — SPORTS CLUB MANAGEMENT SYSTEM
 * SP SPORTDATA SOLUTION
 * Comprehensive Core Domain Types
 */

// ==========================================
// 1. SYSTEM ROLES & PERMISSIONS
// ==========================================

export type SystemRole =
  // Platform Level
  | 'SUPERADMIN'
  | 'SYSTEM_ADMIN'
  | 'OBSERVER'
  // Club Level
  | 'CLUB_ADMIN'
  | 'CLUB_CO_ADMIN'
  // Branch Level
  | 'BRANCH_MANAGER'
  | 'BRANCH_CO_ADMIN'
  // Operational Level
  | 'COACH'
  | 'ASSISTANT_COACH'
  | 'FINANCE'
  | 'REGISTRATION_OFFICER'
  | 'STAFF'
  // Member Level
  | 'MEMBER'
  | 'ATHLETE'
  | 'VOLUNTEER'
  | 'PARENT';

export interface UserRoleAssignment {
  role: SystemRole;
  clubId?: string;       // Optional if Platform level
  branchId?: string;     // Optional if Platform or Club level
  grantedAt: string;
}

export interface User {
  id: string; // Auth User ID (UUID)
  email: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  icPassport?: string;
  residentialAddress?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  preferredNadiCentre?: string;
  onboardingCompleted?: boolean;
  preferredLanguage?: 'en' | 'ms';
  photoVisibility?: 'PUBLIC' | 'CLUB_ONLY' | 'ADMIN_ONLY' | 'PRIVATE';
  otherInfo?: string;
  roles: UserRoleAssignment[];
  activeRole: SystemRole;
  activeClubId?: string;
  activeBranchId?: string;
  status: 'Active' | 'Inactive' | 'Suspended';
  createdAt: string;
  lastLoginAt?: string;
}

// ==========================================
// 2. MULTI-CLUB & MULTI-BRANCH ENTITIES
// ==========================================

export type ClubStatus =
  | 'Draft'
  | 'Submitted'
  | 'Pending Approval'
  | 'Active'
  | 'Suspended'
  | 'Rejected'
  | 'Archived';

export interface Club {
  id: string; // e.g. "Scms-CLUB-000001"
  name: string;
  displayName?: string; // Transmitted as club-name to KarateTech 3.0 (max 30 chars)
  shortName: string;
  scoreboardAbbreviation?: string;
  sport: string; // e.g. "Karate", "Football", "Swimming", "Kabaddi"
  registrationNo: string;
  establishedYear: number;
  address: string;
  district?: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  phone: string;
  email: string;
  website?: string;
  logoUrl?: string;
  description?: string;
  internalNotes?: string;
  status: ClubStatus;
  primaryAdminId?: string;
  primaryAdminName?: string;
  primaryAdminEmail?: string;
  primaryAdminPhone?: string;
  onboardingStep?: number; // 1-10
  onboardingCompleted?: boolean;
  createdAt: string;
  updatedAt: string;
  branchCount?: number;
  memberCount?: number;
}

export interface ClubBranch {
  id: string; // e.g. "Scms-CLUB-000001-B001"
  clubId: string; // FK to Club
  name: string;
  displayName?: string;
  district?: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  phone: string;
  email: string;
  managerId?: string;
  managerName?: string;
  venueName: string;
  operatingHours?: string;
  status: 'Active' | 'Inactive' | 'Archived';
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
}

// ==========================================
// 3. SPORT CONFIGURATION ENGINE
// ==========================================

export interface SportFieldDefinition {
  id: string;
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean' | 'date';
  required: boolean;
  options?: string[]; // For select types
  unit?: string;     // e.g. "kg", "cm", "sec"
  description?: string;
}

export interface SportConfiguration {
  id: string;
  sportCode: string; // "KARATE" | "FOOTBALL" | "SWIMMING" | "KABADDI" | "CUSTOM"
  sportName: string;
  icon: string;
  categoryHierarchy: string[]; // e.g. ["Discipline", "Age Group", "Weight Category"]
  gradeScale?: { rank: number; name: string; beltColor?: string }[];
  customFields: SportFieldDefinition[];
  karateTechIntegrationSupported: boolean;
}

// ==========================================
// 4. MEMBERS & ATHLETES
// ==========================================

export type MemberStatus = 'Active' | 'Inactive' | 'Suspended' | 'Archived' | 'Transferred';

export interface Member {
  id: string; // e.g. "Scms-MEM-000001"
  clubId: string;
  branchId: string;
  userId?: string; // Linked system user if has login
  fullName: string;
  preferredName?: string;
  gender: 'Male' | 'Female' | 'Other';
  dob: string; // YYYY-MM-DD
  icPassport: string;
  nationality: string;
  email?: string;
  phone?: string;
  photoUrl?: string;
  address?: string;
  city?: string;
  state?: string;
  postcode?: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  status: MemberStatus;
  roles?: string[];
  isAthlete: boolean;
  isVolunteer: boolean;
  guardianId?: string; // FK to Member or User if minor
  guardianName?: string;
  trainingGroupId?: string;
  assignedCoachId?: string;
  assignedCoachName?: string;
  sportData: Record<string, any>; // Sport-specific fields (rank, weight, belt, position, etc.)
  medicalNotes?: string;
  bloodType?: string;
  joinedDate: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 5. VOLUNTEER SYSTEM
// ==========================================

export type VolunteerStatus = 'Pending' | 'Active' | 'Inactive' | 'Suspended' | 'Archived';

export type VolunteerDuty =
  | 'Club Activities'
  | 'Training Support'
  | 'Camps & Seminars'
  | 'Registration Desk'
  | 'Participant Support'
  | 'Equipment & Logistics'
  | 'Hospitality'
  | 'Administration'
  | 'Media & Photography'
  | 'Tournament Support'
  | 'Custom';

export type VolunteerAssignmentStatus =
  | 'Draft'
  | 'Assigned'
  | 'Confirmed'
  | 'Checked In'
  | 'Completed'
  | 'Cancelled';

export interface Volunteer {
  id: string; // e.g. "Scms-VOL-000001"
  memberId: string; // FK to Member (strictly member-level)
  clubId: string;
  branchId: string;
  skills: string[];
  experienceYears?: number;
  availability: string[]; // e.g. ["Weekend Mornings", "Friday Evenings"]
  preferredDuties: VolunteerDuty[];
  trainingCertifications?: string[];
  startDate: string;
  endDate?: string;
  status: VolunteerStatus;
  totalHours: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VolunteerAssignment {
  id: string;
  volunteerId: string;
  volunteerName: string;
  clubId: string;
  branchId: string;
  eventId?: string;
  eventName?: string;
  dutyType: VolunteerDuty;
  scheduledStartTime: string;
  scheduledEndTime: string;
  actualCheckInTime?: string;
  actualCheckOutTime?: string;
  actualHours?: number;
  supervisorName?: string;
  instructions?: string;
  status: VolunteerAssignmentStatus;
  createdAt: string;
}

// ==========================================
// 6. ATTENDANCE & TRAINING
// ==========================================

export interface TrainingGroup {
  id: string;
  clubId: string;
  branchId: string;
  name: string;
  ageGroup: string;
  skillLevel: string;
  coachId: string;
  coachName: string;
  assistantCoachName?: string;
  venueName: string;
  capacity: number;
  scheduleDescription: string;
  createdAt: string;
}

export interface TrainingClassSession {
  id: string;
  clubId: string;
  branchId: string;
  trainingGroupId: string;
  groupName: string;
  coachId: string;
  coachName: string;
  sessionDate: string; // YYYY-MM-DD
  startTime: string;   // HH:mm
  endTime: string;     // HH:mm
  venue: string;
  topic?: string;
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';
  totalAttendees?: number;
}

export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused';

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  memberId: string;
  memberName: string;
  clubId: string;
  branchId: string;
  status: AttendanceStatus;
  checkInTime?: string;
  remarks?: string;
  recordedBy: string;
  updatedAt: string;
}

// ==========================================
// 7. MEMBERSHIP & FINANCE
// ==========================================

export interface MembershipPlan {
  id: string;
  clubId: string;
  name: string;
  description?: string;
  frequency: 'Monthly' | 'Quarterly' | 'Biannual' | 'Annual' | 'Lifetime';
  fee: number;
  currency: string;
  status: 'Active' | 'Archived';
}

export interface MemberSubscription {
  id: string;
  memberId: string;
  clubId: string;
  branchId: string;
  planId: string;
  planName: string;
  startDate: string;
  endDate: string;
  status: 'Active' | 'Expiring' | 'Expired' | 'Suspended';
  autoRenew: boolean;
  fee: number;
}

export type InvoiceStatus =
  | 'Draft'
  | 'Pending'
  | 'Partially Paid'
  | 'Paid'
  | 'Overdue'
  | 'Waived'
  | 'Cancelled';

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id: string; // e.g. "Scms-INV-000001"
  invoiceNumber: string;
  clubId: string;
  branchId: string;
  memberId: string;
  memberName: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  dueDate: string;
  issueDate: string;
  status: InvoiceStatus;
  notes?: string;
  createdAt: string;
}

export interface PaymentReceipt {
  id: string; // e.g. "Scms-REC-000001"
  receiptNumber: string;
  invoiceId: string;
  clubId: string;
  branchId: string;
  memberId: string;
  memberName: string;
  amount: number;
  paymentMethod: 'FPX' | 'DuitNow QR' | 'Credit Card' | 'Cash' | 'Bank Transfer';
  referenceNo?: string;
  paymentDate: string;
  receivedBy: string;
  notes?: string;
}

// ==========================================
// 8. EVENTS & DOCUMENTS
// ==========================================

export interface ClubEvent {
  id: string; // e.g. "Scms-EVT-000001"
  clubId: string;
  branchId?: string; // Optional if club-wide
  title: string;
  eventType: 'Camp' | 'Seminar' | 'Grading' | 'Tournament Preparation' | 'Social' | 'Meeting';
  startDate: string;
  endDate: string;
  venue: string;
  description?: string;
  capacity?: number;
  participantCount?: number;
  volunteerCount?: number;
  status: 'Upcoming' | 'Ongoing' | 'Completed' | 'Cancelled';
  createdAt: string;
}

export interface SystemDocument {
  id: string; // e.g. "Scms-DOC-000001"
  clubId: string;
  branchId?: string;
  memberId?: string; // Optional if attached to member
  title: string;
  docType: 'Club Policy' | 'Medical Clearance' | 'Guardian Waiver' | 'Identity' | 'Certificate' | 'Other';
  fileUrl: string;
  fileName: string;
  fileSize?: string;
  expiryDate?: string;
  uploadedBy: string;
  createdAt: string;
}

// ==========================================
// 9. TASKS & APPROVAL WORKFLOWS
// ==========================================

export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type TaskStatus = 'Open' | 'In Progress' | 'Completed' | 'Cancelled';

export interface SystemTask {
  id: string; // e.g. "Scms-TSK-000001"
  title: string;
  description?: string;
  assignedToUserId?: string;
  assignedToName?: string;
  clubId?: string;
  branchId?: string;
  relatedMemberId?: string;
  relatedMemberName?: string;
  relatedEventId?: string;
  priority: TaskPriority;
  dueDate: string;
  status: TaskStatus;
  createdBy: string;
  createdAt: string;
}

export type ApprovalRequestType =
  | 'Club Registration'
  | 'Club Profile Change'
  | 'Branch Creation'
  | 'User Invitation'
  | 'Role Elevation'
  | 'Member Transfer'
  | 'Volunteer Approval'
  | 'Membership Exception'
  | 'Payment Adjustment'
  | 'Tournament Registration'
  | 'Integration Issue';

export type ApprovalStatus = 'Pending' | 'Under Review' | 'Approved' | 'Rejected';

export interface ApprovalRequest {
  id: string; // e.g. "Scms-APP-000001"
  type: ApprovalRequestType;
  title: string;
  clubId?: string;
  clubName?: string;
  branchId?: string;
  branchName?: string;
  submittedByUserId: string;
  submittedByName: string;
  submittedAt: string;
  status: ApprovalStatus;
  reviewedByUserId?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  decisionNotes?: string;
  payload: Record<string, any>;
}

// ==========================================
// 10. AUTOMATION ENGINE
// ==========================================

export interface AutomationRule {
  id: string;
  clubId: string;
  name: string;
  triggerEvent:
    | 'MEMBERSHIP_EXPIRING_DAYS'
    | 'ATTENDANCE_MISSED_CONSECUTIVE'
    | 'TOURNAMENT_DEADLINE_APPROACHING'
    | 'VOLUNTEER_ASSIGNMENT_CONFIRMED'
    | 'INVOICE_OVERDUE';
  triggerConditionValue: number; // e.g. 14 (days), 3 (sessions)
  actionType: 'NOTIFY_MEMBER' | 'NOTIFY_COACH' | 'NOTIFY_ADMIN' | 'CREATE_TASK';
  actionTemplate: string;
  enabled: boolean;
  createdAt: string;
}

export interface AutomationLog {
  id: string;
  ruleId: string;
  ruleName: string;
  clubId: string;
  triggeredAt: string;
  targetEntityId: string;
  result: 'Success' | 'Failed';
  message: string;
}

// ==========================================
// 11. AUDIT & ACTIVITY FEEDS
// ==========================================

export interface ActivityFeedItem {
  id: string;
  clubId?: string;
  branchId?: string;
  userId?: string;
  userName: string;
  action: string;
  details: string;
  module:
    | 'CLUB'
    | 'MEMBER'
    | 'VOLUNTEER'
    | 'ATTENDANCE'
    | 'FINANCE'
    | 'TOURNAMENT'
    | 'APPROVAL'
    | 'SECURITY';
  timestamp: string;
}

// ==========================================
// 12. KARATETECH 3.0 INTEGRATION LAYER
// ==========================================

export interface KarateTechClubMapping {
  scmsClubId: string;
  karateTechClubId: string;
  karateTechClubName: string;
  connectionStatus: 'Connected' | 'Disconnected' | 'Error';
  lastSyncedAt?: string;
  syncErrors?: string[];
}

export interface KarateTechParticipantMapping {
  scmsMemberId: string;
  scmsClubId: string;
  scmsBranchId: string;
  karateTechParticipantId: string;
  lastSyncedAt: string;
}

export type TournamentRegistrationStatus =
  | 'DRAFT'
  | 'READY'
  | 'VALIDATION_FAILED'
  | 'SUBMITTING'
  | 'SUBMITTED'
  | 'ACKNOWLEDGED'
  | 'PARTIALLY_FAILED'
  | 'FAILED'
  | 'CANCELLED';

export interface TournamentRegistrationItem {
  scmsMemberId: string;
  memberName: string;
  discipline: 'Kata' | 'Kumite' | 'Both';
  targetCategoryId: string;
  targetCategoryName: string;
  ageAtTournament: number;
  weightKg: number;
  gender: string;
  eligibilityPassed: boolean;
  validationError?: string;
}

export interface TournamentRegistrationDraft {
  id: string; // e.g. "Scms-TREG-000001"
  tournamentId: string;
  tournamentName: string;
  tournamentDate: string;
  clubId: string;
  branchId?: string;
  participants: TournamentRegistrationItem[];
  idempotencyKey: string;
  status: TournamentRegistrationStatus;
  submissionResponse?: any;
  acknowledgedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 12. PARENT/GUARDIAN CONTACTS & VOLUNTEERS
// ==========================================

export interface ParentContact {
  id: string; // "Scms-PCON-..."
  clubId: string;
  fullName: string;
  contactNumber: string;
  email?: string;
  isVolunteerEligible: boolean;
  volunteerCommunicationConsent: boolean;
  volunteerConsentTimestamp?: string;
  volunteerInterests?: string[];
  availabilityNotes?: string;
  isActive: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export type GuardianRelationshipType = 'Father' | 'Mother' | 'Guardian' | 'Spouse' | 'Other';

export interface AthleteGuardianRelationship {
  id: string; // "Scms-AGR-..."
  athleteId: string; // member ID
  guardianContactId: string;
  relationship: GuardianRelationshipType;
  relationshipDescription?: string; // If 'Other'
  isPrimaryContact: boolean;
  isEmergencyContact: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NewVolunteerAssignment {
  id: string; // "Scms-VASS-..."
  clubId: string;
  branchId?: string;
  title: string;
  eventName: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  location: string;
  generalDuty: string;
  volunteersRequired: number;
  instructions?: string;
  status: 'Draft' | 'Open' | 'Assigned' | 'Completed' | 'Cancelled';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface VolunteerAssignmentMember {
  assignmentId: string;
  guardianContactId: string;
  individualDuty?: string;
  status: 'Pending Confirmation' | 'Confirmed' | 'Declined' | 'Completed' | 'Cancelled';
  attendanceStatus?: 'Present' | 'Absent' | 'Late';
  assignedBy: string;
  assignedAt: string;
  notes?: string;
}
