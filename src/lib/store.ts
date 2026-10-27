/**
 * Scms In-Memory & Persistent Data Store
 * Fully normalized, multi-tenant, auditable data store with mock seed data
 */

import {
  Club,
  ClubBranch,
  Member,
  Volunteer,
  VolunteerAssignment,
  TrainingGroup,
  TrainingClassSession,
  AttendanceRecord,
  MembershipPlan,
  Invoice,
  PaymentReceipt,
  ClubEvent,
  SystemDocument,
  SystemTask,
  ApprovalRequest,
  AutomationRule,
  AutomationLog,
  ActivityFeedItem,
  KarateTechClubMapping,
  TournamentRegistrationDraft,
  User,
  SystemRole,
  ParentContact,
  AthleteGuardianRelationship,
  NewVolunteerAssignment,
  VolunteerAssignmentMember
} from '@/types';
import { generateImmutableId, generateIdempotencyKey } from './idGenerator';

// ==========================================
// SEED DATA
// ==========================================

export const INITIAL_CLUBS: Club[] = [
  {
    id: 'Scms-CLUB-000001',
    name: 'Senshi Goju-Ryu Karate-Do Academy',
    displayName: 'Senshi Goju-Ryu',
    shortName: 'Senshi Karate',
    sport: 'Karate',
    registrationNo: 'C SGR-13884',
    establishedYear: 2008,
    address: 'No. 23, Jalan SP8/14, Saujana Puchong',
    district: 'Petaling',
    city: 'Puchong',
    state: 'Selangor',
    postcode: '47100',
    country: 'Malaysia',
    phone: '+6012-3456789',
    email: 'admin@senshikarate.org',
    website: 'https://senshikarate.org',
    logoUrl: '/logos/senshi.png',
    description: 'Premier Traditional & Sport Karate Academy focusing on WKF Kata & Kumite excellence.',
    status: 'Active',
    primaryAdminName: 'Shihan Kannan',
    primaryAdminEmail: 'kannan@senshikarate.org',
    primaryAdminPhone: '+6012-3456789',
    onboardingStep: 10,
    onboardingCompleted: true,
    branchCount: 3,
    memberCount: 142,
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-03-01T10:00:00Z',
  },
  {
    id: 'Scms-CLUB-000002',
    name: 'Harimau FC Sports Club',
    displayName: 'Harimau FC',
    shortName: 'Harimau FC',
    sport: 'Football',
    registrationNo: 'C SGR-99412',
    establishedYear: 2015,
    address: 'Seksyen 13 Sports Park',
    district: 'Petaling',
    city: 'Shah Alam',
    state: 'Selangor',
    postcode: '40100',
    country: 'Malaysia',
    phone: '+6019-8765432',
    email: 'admin@harimaufc.my',
    website: 'https://harimaufc.my',
    description: 'Youth and competitive football development academy competing in regional youth leagues.',
    status: 'Active',
    primaryAdminName: 'Coach Razak',
    primaryAdminEmail: 'razak@harimaufc.my',
    primaryAdminPhone: '+6019-8765432',
    onboardingStep: 10,
    onboardingCompleted: true,
    branchCount: 1,
    memberCount: 50,
    createdAt: '2026-01-15T09:00:00Z',
    updatedAt: '2026-03-01T10:00:00Z',
  },
  {
    id: 'Scms-CLUB-000003',
    name: 'Penang Titans Badminton Academy',
    displayName: 'Penang Titans',
    shortName: 'Penang Titans',
    sport: 'Badminton',
    registrationNo: 'C PNG-44821',
    establishedYear: 2018,
    address: '12, Jalan Kelawai',
    district: 'Timur Laut',
    city: 'Georgetown',
    state: 'Penang',
    postcode: '10250',
    country: 'Malaysia',
    phone: '+6014-9988776',
    email: 'info@penangtitans.my',
    website: 'https://penangtitans.my',
    description: 'High performance badminton coaching and junior development center.',
    status: 'Active',
    primaryAdminName: 'Coach Lee Wei',
    primaryAdminEmail: 'lee@penangtitans.my',
    primaryAdminPhone: '+6014-9988776',
    onboardingStep: 10,
    onboardingCompleted: true,
    branchCount: 1,
    memberCount: 35,
    createdAt: '2026-01-18T10:00:00Z',
    updatedAt: '2026-03-01T10:00:00Z',
  },
  {
    id: 'Scms-CLUB-000004',
    name: 'Wira Kabaddi Association',
    displayName: 'Wira Kabaddi',
    shortName: 'Wira Kabaddi',
    sport: 'Kabaddi',
    registrationNo: 'KAB-KL-2022',
    establishedYear: 2022,
    address: 'Kompleks Sukan Brickfields',
    district: 'Lembah Pantai',
    city: 'Kuala Lumpur',
    state: 'Kuala Lumpur',
    postcode: '50470',
    country: 'Malaysia',
    phone: '+6017-3344556',
    email: 'admin@wirakabaddi.org',
    website: 'https://wirakabaddi.org',
    description: 'Traditional and competitive Kabaddi academy fostering grassroots athleticism.',
    status: 'Pending Approval',
    primaryAdminName: 'Ravi Chandran',
    primaryAdminEmail: 'ravi@wirakabaddi.org',
    primaryAdminPhone: '+6017-3344556',
    onboardingStep: 8,
    onboardingCompleted: false,
    branchCount: 1,
    memberCount: 18,
    createdAt: '2026-03-01T12:00:00Z',
    updatedAt: '2026-03-01T12:00:00Z',
  },
];

export const INITIAL_BRANCHES: ClubBranch[] = [
  // Branches for Senshi Karate
  {
    id: 'Scms-CLUB-000001-B001',
    clubId: 'Scms-CLUB-000001',
    name: 'Dojo Saujana Puchong (HQ)',
    displayName: 'Senshi Puchong HQ',
    district: 'Petaling',
    address: 'No. 23, Jalan SP8/14, Saujana Puchong',
    city: 'Puchong',
    state: 'Selangor',
    postcode: '47100',
    country: 'Malaysia',
    phone: '+6012-3456789',
    email: 'puchong@senshikarate.org',
    managerId: 'usr-clubadmin-senshi',
    managerName: 'Shihan Kannan',
    venueName: 'Honbu Dojo Tatami Arena',
    operatingHours: 'Mon-Fri: 17:00-22:00, Sat: 08:00-13:00',
    status: 'Active',
    memberCount: 75,
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'Scms-CLUB-000001-B002',
    clubId: 'Scms-CLUB-000001',
    name: 'Dojo USJ Subang Jaya',
    displayName: 'Senshi USJ Dojo',
    district: 'Petaling',
    address: 'Kompleks Sukan USJ 7',
    city: 'Subang Jaya',
    state: 'Selangor',
    postcode: '47610',
    country: 'Malaysia',
    phone: '+6012-9988112',
    email: 'usj@senshikarate.org',
    managerId: 'usr-branchmgr-usj',
    managerName: 'Sensei Mohan',
    venueName: 'USJ Multipurpose Martial Hall',
    operatingHours: 'Tue & Thu: 19:30-21:30, Sun: 09:00-12:00',
    status: 'Active',
    memberCount: 42,
    createdAt: '2026-01-12T08:00:00Z',
    updatedAt: '2026-01-12T08:00:00Z',
  },
  {
    id: 'Scms-CLUB-000001-B003',
    clubId: 'Scms-CLUB-000001',
    name: 'Dojo Cyberjaya Tech',
    displayName: 'Senshi Cyberjaya',
    district: 'Sepang',
    address: 'Cyberjaya Community Clubhouse',
    city: 'Cyberjaya',
    state: 'Selangor',
    postcode: '63000',
    country: 'Malaysia',
    phone: '+6013-1122334',
    email: 'cyber@senshikarate.org',
    managerId: 'usr-branchmgr-cyber',
    managerName: 'Sensei Bala',
    venueName: 'Cyberjaya Tatami Studio',
    operatingHours: 'Sat: 15:00-18:00',
    status: 'Active',
    memberCount: 25,
    createdAt: '2026-01-20T08:00:00Z',
    updatedAt: '2026-01-20T08:00:00Z',
  },
  // Branches for Harimau FC
  {
    id: 'Scms-CLUB-000002-B001',
    clubId: 'Scms-CLUB-000002',
    name: 'Shah Alam Football Field A',
    address: 'Seksyen 13 Sports Park',
    city: 'Shah Alam',
    state: 'Selangor',
    postcode: '40100',
    country: 'Malaysia',
    phone: '+6019-8765432',
    email: 'sa@harimaufc.my',
    managerName: 'Coach Razak',
    venueName: 'Padang Sintetik Seksyen 13',
    operatingHours: 'Sat & Sun: 07:30-11:30',
    status: 'Active',
    memberCount: 50,
    createdAt: '2026-01-15T09:00:00Z',
    updatedAt: '2026-01-15T09:00:00Z',
  },
  // Branches for Penang Titans
  {
    id: 'Scms-CLUB-000003-B001',
    clubId: 'Scms-CLUB-000003',
    name: 'Georgetown Badminton Arena',
    address: '12, Jalan Kelawai',
    city: 'Georgetown',
    state: 'Penang',
    postcode: '10250',
    country: 'Malaysia',
    phone: '+6014-9988776',
    email: 'arena@penangtitans.my',
    managerName: 'Coach Lee Wei',
    venueName: 'Titans Court 1 & 2',
    operatingHours: 'Daily: 08:00-22:00',
    status: 'Active',
    memberCount: 35,
    createdAt: '2026-01-18T10:00:00Z',
    updatedAt: '2026-01-18T10:00:00Z',
  },
  // Branches for Wira Kabaddi
  {
    id: 'Scms-CLUB-000004-B001',
    clubId: 'Scms-CLUB-000004',
    name: 'Brickfields Kabaddi Court',
    address: 'Kompleks Sukan Brickfields',
    city: 'Kuala Lumpur',
    state: 'Kuala Lumpur',
    postcode: '50470',
    country: 'Malaysia',
    phone: '+6017-3344556',
    email: 'brickfields@wirakabaddi.org',
    managerName: 'Ravi Chandran',
    venueName: 'Court A (Outdoor Synthetic)',
    operatingHours: 'Mon, Wed, Fri: 17:00-19:30',
    status: 'Active',
    memberCount: 18,
    createdAt: '2026-03-01T12:00:00Z',
    updatedAt: '2026-03-01T12:00:00Z',
  },
];

export const INITIAL_USERS: User[] = [
  {
    id: 'usr-superadmin-01',
    email: 'superadmin@spsportdata.org',
    fullName: 'Dato’ Sri Shanker',
    roles: [{ role: 'SUPERADMIN', grantedAt: '2026-01-01T00:00:00Z' }],
    activeRole: 'SUPERADMIN',
    status: 'Active',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'usr-clubadmin-senshi',
    email: 'kannan@senshikarate.org',
    fullName: 'Shihan Kannan',
    roles: [
      { role: 'CLUB_ADMIN', clubId: 'Scms-CLUB-000001', grantedAt: '2026-01-10T08:00:00Z' },
      { role: 'COACH', clubId: 'Scms-CLUB-000001', branchId: 'Scms-CLUB-000001-B001', grantedAt: '2026-01-10T08:00:00Z' },
    ],
    activeRole: 'CLUB_ADMIN',
    activeClubId: 'Scms-CLUB-000001',
    activeBranchId: 'Scms-CLUB-000001-B001',
    status: 'Active',
    createdAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'usr-branchmgr-usj',
    email: 'mohan@senshikarate.org',
    fullName: 'Sensei Mohan',
    roles: [
      { role: 'BRANCH_MANAGER', clubId: 'Scms-CLUB-000001', branchId: 'Scms-CLUB-000001-B002', grantedAt: '2026-01-12T08:00:00Z' },
      { role: 'COACH', clubId: 'Scms-CLUB-000001', branchId: 'Scms-CLUB-000001-B002', grantedAt: '2026-01-12T08:00:00Z' },
    ],
    activeRole: 'BRANCH_MANAGER',
    activeClubId: 'Scms-CLUB-000001',
    activeBranchId: 'Scms-CLUB-000001-B002',
    status: 'Active',
    createdAt: '2026-01-12T08:00:00Z',
  },
  {
    id: 'usr-volunteer-ahmad',
    email: 'ahmad.daniel@example.com',
    fullName: 'Ahmad Daniel',
    roles: [
      { role: 'MEMBER', clubId: 'Scms-CLUB-000001', branchId: 'Scms-CLUB-000001-B001', grantedAt: '2026-01-15T00:00:00Z' },
      { role: 'ATHLETE', clubId: 'Scms-CLUB-000001', branchId: 'Scms-CLUB-000001-B001', grantedAt: '2026-01-15T00:00:00Z' },
      { role: 'VOLUNTEER', clubId: 'Scms-CLUB-000001', branchId: 'Scms-CLUB-000001-B001', grantedAt: '2026-01-15T00:00:00Z' },
    ],
    activeRole: 'VOLUNTEER',
    activeClubId: 'Scms-CLUB-000001',
    activeBranchId: 'Scms-CLUB-000001-B001',
    status: 'Active',
    createdAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'usr-parent-fatimah',
    email: 'fatimah.ali@example.com',
    fullName: 'Puan Fatimah Ali',
    roles: [
      { role: 'PARENT', clubId: 'Scms-CLUB-000001', branchId: 'Scms-CLUB-000001-B001', grantedAt: '2026-01-15T00:00:00Z' },
    ],
    activeRole: 'PARENT',
    activeClubId: 'Scms-CLUB-000001',
    activeBranchId: 'Scms-CLUB-000001-B001',
    status: 'Active',
    createdAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'usr-clubadmin-sam',
    email: 'svanathan@gmail.com',
    fullName: 'Sam Selva',
    roles: [
      { role: 'CLUB_ADMIN', clubId: 'Scms-CLUB-000001', branchId: 'Scms-CLUB-000001-B001', grantedAt: '2026-01-10T08:00:00Z' },
    ],
    activeRole: 'CLUB_ADMIN',
    activeClubId: 'Scms-CLUB-000001',
    activeBranchId: 'Scms-CLUB-000001-B001',
    phone: '+6012-6273691',
    status: 'Active',
    createdAt: '2026-01-10T08:00:00Z',
  },
];

export const INITIAL_MEMBERS: Member[] = [
  {
    id: 'Scms-MEM-000000-KAN',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    userId: 'usr-clubadmin-senshi',
    fullName: 'Shihan Kannan',
    preferredName: 'Shihan Kannan',
    gender: 'Male',
    dob: '1975-06-15',
    icPassport: '750615-10-5555',
    nationality: 'Malaysian',
    email: 'kannan@senshikarate.org',
    phone: '+6012-3456789',
    emergencyContactName: 'Club Admin Office',
    emergencyContactPhone: '+6012-3456789',
    emergencyContactRelation: 'Office',
    status: 'Active',
    roles: ['CLUB_ADMIN', 'COACH'],
    isAthlete: false,
    isVolunteer: false,
    assignedCoachName: 'Shihan Kannan',
    sportData: {
      beltRank: 'Black Belt (7th Dan)',
      preferredDiscipline: 'Both (Kata & Kumite)',
    },
    joinedDate: '2010-01-01',
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'Scms-MEM-000000-MOH',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B002',
    userId: 'usr-branchmgr-usj',
    fullName: 'Sensei Mohan',
    preferredName: 'Sensei Mohan',
    gender: 'Male',
    dob: '1982-08-20',
    icPassport: '820820-10-6666',
    nationality: 'Malaysian',
    email: 'mohan@senshikarate.org',
    phone: '+6012-9876543',
    emergencyContactName: 'Club Admin Office',
    emergencyContactPhone: '+6012-9876543',
    emergencyContactRelation: 'Office',
    status: 'Active',
    roles: ['BRANCH_MANAGER', 'COACH'],
    isAthlete: false,
    isVolunteer: false,
    assignedCoachName: 'Sensei Mohan',
    sportData: {
      beltRank: 'Black Belt (5th Dan)',
      preferredDiscipline: 'Both (Kata & Kumite)',
    },
    joinedDate: '2015-05-01',
    createdAt: '2026-01-12T08:00:00Z',
    updatedAt: '2026-01-12T08:00:00Z',
  },
  {
    id: 'Scms-MEM-000000-SAM',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    userId: 'usr-clubadmin-sam',
    fullName: 'Sam Selva',
    preferredName: 'Sam Selva',
    gender: 'Male',
    dob: '1980-01-01',
    icPassport: '800101-10-1234',
    nationality: 'Malaysian',
    email: 'svanathan@gmail.com',
    phone: '+6012-6273691',
    emergencyContactName: 'Primary Contact',
    emergencyContactPhone: '+6012-6273691',
    emergencyContactRelation: 'Self',
    status: 'Active',
    roles: ['CLUB_ADMIN'],
    isAthlete: false,
    isVolunteer: false,
    sportData: {
      beltRank: 'Black Belt (3rd Dan)',
      preferredDiscipline: 'Both (Kata & Kumite)',
    },
    joinedDate: '2020-01-01',
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'Scms-MEM-000000-SEL',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    userId: 'usr-athlete-selva',
    fullName: 'Selva Vanathan',
    preferredName: 'Selva',
    gender: 'Male',
    dob: '1995-05-15',
    icPassport: '950515-10-4321',
    nationality: 'Malaysian',
    email: 'svanathan@yahoo.com',
    phone: '+6012-6273691',
    emergencyContactName: 'Sam Selva',
    emergencyContactPhone: '+6012-6273691',
    emergencyContactRelation: 'Family',
    status: 'Active',
    roles: ['ATHLETE'],
    isAthlete: true,
    isVolunteer: false,
    assignedCoachName: 'Shihan Kannan',
    sportData: {
      beltRank: 'Brown Belt (1st Kyu)',
      preferredDiscipline: 'Kumite Only',
      weightKg: 75.0,
      heightCm: 175,
    },
    joinedDate: '2022-01-01',
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'Scms-MEM-000001',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    userId: 'usr-volunteer-ahmad',
    fullName: 'Ahmad Daniel bin Razak',
    preferredName: 'Daniel',
    gender: 'Male',
    dob: '2005-04-12',
    icPassport: '050412-14-1235',
    nationality: 'Malaysian',
    email: 'ahmad.daniel@example.com',
    phone: '+6017-1234567',
    emergencyContactName: 'Fatimah Ali (Mother)',
    emergencyContactPhone: '+6017-9999999',
    emergencyContactRelation: 'Mother',
    status: 'Active',
    isAthlete: true,
    isVolunteer: true,
    assignedCoachName: 'Shihan Kannan',
    trainingGroupId: 'tg-01',
    sportData: {
      beltRank: 'Black Belt (1st Dan+)',
      preferredDiscipline: 'Kumite Only',
      competitionCategory: 'Male Kumite -67kg (18+)',
      competitionEvents: ['Kumite'],
      weightKg: 64.5,
      heightCm: 172,
      lastGradingDate: '2025-11-20',
    },
    medicalNotes: 'Fully cleared for combat contact sport. No known allergies.',
    bloodType: 'O+',
    joinedDate: '2022-03-01',
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-02-10T00:00:00Z',
  },
  {
    id: 'Scms-MEM-000002',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    fullName: 'Chloe Tan Jia Xin',
    preferredName: 'Chloe',
    gender: 'Female',
    dob: '2004-09-22',
    icPassport: '040922-10-8888',
    nationality: 'Malaysian',
    email: 'chloe.tan@example.com',
    phone: '+6012-9876543',
    emergencyContactName: 'Tan Kok Wai',
    emergencyContactPhone: '+6012-1112222',
    emergencyContactRelation: 'Father',
    status: 'Active',
    isAthlete: true,
    isVolunteer: false,
    assignedCoachName: 'Shihan Kannan',
    trainingGroupId: 'tg-01',
    sportData: {
      beltRank: 'Brown Belt (4th-1st Kyu)',
      preferredDiscipline: 'Both (Kata & Kumite)',
      competitionCategory: 'Female Kata & Kumite -55kg (18+)',
      competitionEvents: ['Kata', 'Kumite'],
      weightKg: 52.0,
      heightCm: 161,
      lastGradingDate: '2025-10-15',
    },
    medicalNotes: 'Mild exercise-induced asthma. Inhaler kept on sidelines.',
    bloodType: 'A+',
    joinedDate: '2023-01-15',
    createdAt: '2026-01-16T00:00:00Z',
    updatedAt: '2026-02-12T00:00:00Z',
  },
  {
    id: 'Scms-MEM-000003',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    fullName: 'Muhammad Ryan bin Abdullah',
    preferredName: 'Ryan',
    gender: 'Male',
    dob: '2012-08-30',
    icPassport: '120830-14-1111',
    nationality: 'Malaysian',
    emergencyContactName: 'Puan Fatimah Ali',
    emergencyContactPhone: '+6017-9999999',
    emergencyContactRelation: 'Mother',
    status: 'Active',
    isAthlete: true,
    isVolunteer: false,
    guardianId: 'usr-parent-fatimah',
    guardianName: 'Puan Fatimah Ali',
    assignedCoachName: 'Sensei Mohan',
    trainingGroupId: 'tg-02',
    sportData: {
      beltRank: 'Green Belt (7th Kyu)',
      preferredDiscipline: 'Kata Only',
      competitionCategory: 'Male Cadet Individual Kata',
      competitionEvents: ['Kata'],
      weightKg: 42.0,
      heightCm: 148,
    },
    joinedDate: '2024-06-01',
    createdAt: '2026-01-20T00:00:00Z',
    updatedAt: '2026-02-15T00:00:00Z',
  },
  {
    id: 'Scms-MEM-000004',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B002',
    fullName: 'Subramaniam Krishnan',
    preferredName: 'Subra',
    gender: 'Male',
    dob: '2000-01-15',
    icPassport: '000115-08-5431',
    nationality: 'Malaysian',
    email: 'subra@example.com',
    phone: '+6011-2223334',
    emergencyContactName: 'Krishnan Murugan',
    emergencyContactPhone: '+6011-8889999',
    emergencyContactRelation: 'Father',
    status: 'Active',
    isAthlete: true,
    isVolunteer: true,
    assignedCoachName: 'Sensei Mohan',
    trainingGroupId: 'tg-03',
    sportData: {
      beltRank: 'Black Belt (1st Dan+)',
      preferredDiscipline: 'Kumite Only',
      competitionCategory: 'Male Kumite -84kg (18+)',
      competitionEvents: ['Kumite'],
      weightKg: 78.2,
      heightCm: 178,
    },
    joinedDate: '2021-05-10',
    createdAt: '2026-01-25T00:00:00Z',
    updatedAt: '2026-02-20T00:00:00Z',
  },
  {
    id: 'Scms-MEM-000005',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    fullName: 'Lucas Wong Kai Le',
    preferredName: 'Lucas',
    gender: 'Male',
    dob: '2016-05-18',
    icPassport: '160518-10-5543',
    nationality: 'Malaysian',
    emergencyContactName: 'Mrs. Linda Wong',
    emergencyContactPhone: '+6017-7778888',
    emergencyContactRelation: 'Mother',
    status: 'Active',
    isAthlete: true,
    isVolunteer: false,
    guardianId: 'Scms-PCON-000005',
    guardianName: 'Mrs. Linda Wong',
    assignedCoachName: 'Sensei Mohan',
    trainingGroupId: 'tg-02',
    sportData: {
      beltRank: 'Yellow Belt (8th Kyu)',
      preferredDiscipline: 'Both (Kata & Kumite)',
      competitionCategory: 'U-10 Boys Individual Kata & Kumite',
      competitionEvents: ['Kata', 'Kumite'],
      weightKg: 28.5,
      heightCm: 132,
      lastGradingDate: '2025-12-10',
    },
    medicalNotes: 'No known allergies or chronic conditions. Good general fitness.',
    bloodType: 'B+',
    joinedDate: '2025-01-10',
    createdAt: '2026-01-28T00:00:00Z',
    updatedAt: '2026-02-20T00:00:00Z',
  },
  {
    id: 'Scms-MEM-000006',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    fullName: 'Nur Aisyah binti Abdullah',
    preferredName: 'Aisyah',
    gender: 'Female',
    dob: '2015-11-04',
    icPassport: '151104-14-3322',
    nationality: 'Malaysian',
    emergencyContactName: 'Puan Fatimah Ali',
    emergencyContactPhone: '+6017-9999999',
    emergencyContactRelation: 'Mother',
    status: 'Active',
    isAthlete: true,
    isVolunteer: false,
    guardianId: 'Scms-PCON-000003',
    guardianName: 'Puan Fatimah Ali',
    assignedCoachName: 'Sensei Mohan',
    trainingGroupId: 'tg-02',
    sportData: {
      beltRank: 'Yellow Belt (8th Kyu)',
      preferredDiscipline: 'Kata Only',
      competitionCategory: 'U-12 Girls Individual Kata',
      competitionEvents: ['Kata'],
      weightKg: 33.0,
      heightCm: 138,
      lastGradingDate: '2025-11-15',
    },
    medicalNotes: 'No medical restrictions. High discipline in dojo training.',
    bloodType: 'O+',
    joinedDate: '2025-02-01',
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-25T00:00:00Z',
  },
];

export const INITIAL_VOLUNTEERS: Volunteer[] = [
  {
    id: 'Scms-VOL-000001',
    memberId: 'Scms-MEM-000001',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    skills: ['First Aid Certified', 'Weigh-in Marshalling', 'Tatami Runner', 'Photography'],
    experienceYears: 3,
    availability: ['Saturday Morning', 'Sunday Full Day', 'Tournament Weekends'],
    preferredDuties: ['Tournament Support', 'Equipment & Logistics', 'Media & Photography'],
    trainingCertifications: ['St John First Aid CPR 2025', 'Scms Volunteer Orientation'],
    startDate: '2025-01-01',
    status: 'Active',
    totalHours: 42.5,
    notes: 'Very dependable senior youth volunteer. Excellent tournament marshal.',
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-02-28T00:00:00Z',
  },
  {
    id: 'Scms-VOL-000002',
    memberId: 'Scms-MEM-000004',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B002',
    skills: ['Logistics', 'Audio/Visual Setup', 'Scoreboard Operator'],
    experienceYears: 2,
    availability: ['Friday Evening', 'Saturday Afternoon'],
    preferredDuties: ['Equipment & Logistics', 'Administration', 'Tournament Support'],
    startDate: '2025-06-01',
    status: 'Active',
    totalHours: 28.0,
    createdAt: '2026-01-26T00:00:00Z',
    updatedAt: '2026-02-20T00:00:00Z',
  },
];

export const INITIAL_VOLUNTEER_ASSIGNMENTS: VolunteerAssignment[] = [
  {
    id: 'vas-01',
    volunteerId: 'Scms-VOL-000001',
    volunteerName: 'Ahmad Daniel',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    eventName: 'Annual Goju-Ryu Junior Kata Championship 2026',
    dutyType: 'Tournament Support',
    scheduledStartTime: '2026-04-18T08:00:00Z',
    scheduledEndTime: '2026-04-18T17:00:00Z',
    supervisorName: 'Shihan Kannan',
    instructions: 'Report to Tatami 1 score table for marshalling and competitor call-out.',
    status: 'Confirmed',
    createdAt: '2026-02-20T10:00:00Z',
  },
  {
    id: 'vas-02',
    volunteerId: 'Scms-VOL-000001',
    volunteerName: 'Ahmad Daniel',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    eventName: 'Saturday Belt Grading Session',
    dutyType: 'Equipment & Logistics',
    scheduledStartTime: '2026-03-07T08:30:00Z',
    scheduledEndTime: '2026-03-07T12:30:00Z',
    actualCheckInTime: '2026-03-07T08:25:00Z',
    actualCheckOutTime: '2026-03-07T12:35:00Z',
    actualHours: 4.0,
    supervisorName: 'Sensei Mohan',
    instructions: 'Assist with tatami hygiene sanitization and certificate arrangement.',
    status: 'Completed',
    createdAt: '2026-03-01T09:00:00Z',
  },
];

export const INITIAL_TRAINING_GROUPS: TrainingGroup[] = [
  {
    id: 'tg-01',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    name: 'Elite Kumite Squad (16+)',
    ageGroup: '16 Years & Above',
    skillLevel: 'Advanced / Dan Grade',
    coachId: 'usr-clubadmin-senshi',
    coachName: 'Shihan Kannan',
    assistantCoachName: 'Sensei Tan',
    venueName: 'Honbu Tatami Hall A',
    capacity: 25,
    scheduleDescription: 'Monday & Wednesday 19:30 - 21:30',
    createdAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'tg-02',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    name: 'Junior Kata Development (U-14)',
    ageGroup: '8 - 14 Years Old',
    skillLevel: 'Beginner to Intermediate',
    coachId: 'usr-branchmgr-usj',
    coachName: 'Sensei Mohan',
    venueName: 'Honbu Tatami Hall B',
    capacity: 30,
    scheduleDescription: 'Tuesday & Thursday 17:00 - 18:30',
    createdAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'tg-03',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B002',
    name: 'USJ Adult General Karate',
    ageGroup: 'All Ages',
    skillLevel: 'All Ranks',
    coachId: 'usr-branchmgr-usj',
    coachName: 'Sensei Mohan',
    venueName: 'USJ Sports Hall',
    capacity: 20,
    scheduleDescription: 'Sunday Morning 09:00 - 11:00',
    createdAt: '2026-01-12T08:00:00Z',
  },
];

export const INITIAL_SESSIONS: TrainingClassSession[] = [
  {
    id: 'sess-01',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    trainingGroupId: 'tg-01',
    groupName: 'Elite Kumite Squad (16+)',
    coachId: 'usr-clubadmin-senshi',
    coachName: 'Shihan Kannan',
    sessionDate: '2026-03-02',
    startTime: '19:30',
    endTime: '21:30',
    venue: 'Honbu Tatami Hall A',
    topic: 'Senshu & Counter-attack Strategy drills',
    status: 'Completed',
    totalAttendees: 18,
  },
  {
    id: 'sess-02',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    trainingGroupId: 'tg-02',
    groupName: 'Junior Kata Development (U-14)',
    coachId: 'usr-branchmgr-usj',
    coachName: 'Sensei Mohan',
    sessionDate: '2026-03-03',
    startTime: '17:00',
    endTime: '18:30',
    venue: 'Honbu Tatami Hall B',
    topic: 'Gekisai Dai Ichi rhythm and stance stability',
    status: 'Scheduled',
    totalAttendees: 15,
  },
];

export const INITIAL_ATTENDANCE: AttendanceRecord[] = [
  {
    id: 'att-01',
    sessionId: 'sess-01',
    memberId: 'Scms-MEM-000001',
    memberName: 'Ahmad Daniel',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    status: 'Present',
    checkInTime: '19:25',
    remarks: 'Good physical form and sparring focus',
    recordedBy: 'Shihan Kannan',
    updatedAt: '2026-03-02T21:35:00Z',
  },
  {
    id: 'att-02',
    sessionId: 'sess-01',
    memberId: 'Scms-MEM-000002',
    memberName: 'Chloe Tan',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    status: 'Present',
    checkInTime: '19:30',
    recordedBy: 'Shihan Kannan',
    updatedAt: '2026-03-02T21:35:00Z',
  },
  {
    id: 'att-03',
    sessionId: 'sess-01',
    memberId: 'Scms-MEM-000004',
    memberName: 'Subramaniam Krishnan',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    status: 'Late',
    checkInTime: '19:45',
    remarks: 'Traffic congestion at Puchong toll',
    recordedBy: 'Shihan Kannan',
    updatedAt: '2026-03-02T21:35:00Z',
  },
  {
    id: 'att-04',
    sessionId: 'sess-02',
    memberId: 'Scms-MEM-000003',
    memberName: 'Muhammad Ryan',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    status: 'Present',
    checkInTime: '17:00',
    remarks: 'Cadet kata mastery - Heian Godan sharp execution',
    recordedBy: 'Sensei Mohan',
    updatedAt: '2026-03-03T18:30:00Z',
  },
  {
    id: 'att-05',
    sessionId: 'sess-02',
    memberId: 'Scms-MEM-000006',
    memberName: 'Nur Aisyah',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    status: 'Present',
    checkInTime: '17:02',
    remarks: 'Junior kata foundation drills',
    recordedBy: 'Sensei Mohan',
    updatedAt: '2026-03-03T18:30:00Z',
  },
  {
    id: 'att-06',
    sessionId: 'sess-02',
    memberId: 'Scms-MEM-000005',
    memberName: 'Lucas Wong',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    status: 'Present',
    checkInTime: '17:05',
    remarks: 'Yellow belt kihon and basic stances practiced well',
    recordedBy: 'Sensei Mohan',
    updatedAt: '2026-03-03T18:30:00Z',
  },
  {
    id: 'att-07',
    sessionId: 'sess-03',
    memberId: 'Scms-MEM-000003',
    memberName: 'Muhammad Ryan',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    status: 'Present',
    checkInTime: '09:28',
    remarks: 'Weekend squad training attendance recorded',
    recordedBy: 'Sensei Mohan',
    updatedAt: '2026-03-07T11:00:00Z',
  },
];

export const INITIAL_PLANS: MembershipPlan[] = [
  {
    id: 'plan-01',
    clubId: 'Scms-CLUB-000001',
    name: 'Standard Monthly Training (Adult)',
    description: 'Access to 3 training sessions per week at all authorized branches.',
    frequency: 'Monthly',
    fee: 150.0,
    currency: 'MYR',
    status: 'Active',
  },
  {
    id: 'plan-02',
    clubId: 'Scms-CLUB-000001',
    name: 'Junior Cadet Academy (U-16)',
    description: 'Weekly 2 sessions including development belt progression modules.',
    frequency: 'Monthly',
    fee: 120.0,
    currency: 'MYR',
    status: 'Active',
  },
  {
    id: 'plan-03',
    clubId: 'Scms-CLUB-000001',
    name: 'Annual National Competitor Pass',
    description: 'Full year unlimited squad training + tournament coaching coverage.',
    frequency: 'Annual',
    fee: 1500.0,
    currency: 'MYR',
    status: 'Active',
  },
];

export const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'Scms-INV-000001',
    invoiceNumber: 'INV-2026-0001',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    memberId: 'Scms-MEM-000001',
    memberName: 'Ahmad Daniel',
    items: [
      { id: 'i1', description: 'Monthly Training Fee - March 2026', quantity: 1, unitPrice: 150.0, amount: 150.0 },
      { id: 'i2', description: 'Annual Club Re-affiliation 2026', quantity: 1, unitPrice: 50.0, amount: 50.0 },
    ],
    subtotal: 200.0,
    discount: 0,
    total: 200.0,
    amountPaid: 200.0,
    balanceDue: 0,
    dueDate: '2026-03-07',
    issueDate: '2026-03-01',
    status: 'Paid',
    createdAt: '2026-03-01T08:00:00Z',
  },
  {
    id: 'Scms-INV-000002',
    invoiceNumber: 'INV-2026-0002',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    memberId: 'Scms-MEM-000003',
    memberName: 'Muhammad Ryan',
    items: [
      { id: 'i3', description: 'Junior Cadet Academy Fee - March 2026', quantity: 1, unitPrice: 120.0, amount: 120.0 },
    ],
    subtotal: 120.0,
    discount: 0,
    total: 120.0,
    amountPaid: 0,
    balanceDue: 120.0,
    dueDate: '2026-03-10',
    issueDate: '2026-03-01',
    status: 'Pending',
    createdAt: '2026-03-01T08:00:00Z',
  },
  {
    id: 'Scms-INV-000003',
    invoiceNumber: 'INV-2026-0003',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    memberId: 'Scms-MEM-000002',
    memberName: 'Chloe Tan',
    items: [
      { id: 'i4', description: 'Monthly Squad Training Fee - March 2026', quantity: 1, unitPrice: 150.0, amount: 150.0 },
    ],
    subtotal: 150.0,
    discount: 0,
    total: 150.0,
    amountPaid: 150.0,
    balanceDue: 0,
    dueDate: '2026-03-05',
    issueDate: '2026-03-01',
    status: 'Paid',
    createdAt: '2026-03-01T08:00:00Z',
  },
  {
    id: 'Scms-INV-000004',
    invoiceNumber: 'INV-2026-0004',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    memberId: 'Scms-MEM-000006',
    memberName: 'Nur Aisyah',
    items: [
      { id: 'i5', description: 'Junior Development Monthly Fee - March 2026', quantity: 1, unitPrice: 120.0, amount: 120.0 },
      { id: 'i6', description: 'Junior Karate Gi Uniform Package', quantity: 1, unitPrice: 90.0, amount: 90.0 },
    ],
    subtotal: 210.0,
    discount: 10.0,
    total: 200.0,
    amountPaid: 200.0,
    balanceDue: 0,
    dueDate: '2026-03-05',
    issueDate: '2026-03-01',
    status: 'Paid',
    createdAt: '2026-03-01T08:00:00Z',
  },
  {
    id: 'Scms-INV-000005',
    invoiceNumber: 'INV-2026-0005',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    memberId: 'Scms-MEM-000005',
    memberName: 'Lucas Wong',
    items: [
      { id: 'i7', description: 'Junior Cadet Academy Fee - March 2026', quantity: 1, unitPrice: 120.0, amount: 120.0 },
    ],
    subtotal: 120.0,
    discount: 0,
    total: 120.0,
    amountPaid: 120.0,
    balanceDue: 0,
    dueDate: '2026-03-05',
    issueDate: '2026-03-01',
    status: 'Paid',
    createdAt: '2026-03-01T08:00:00Z',
  },
];

export const INITIAL_RECEIPTS: PaymentReceipt[] = [
  {
    id: 'Scms-REC-000001',
    receiptNumber: 'REC-2026-0001',
    invoiceId: 'Scms-INV-000001',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    memberId: 'Scms-MEM-000001',
    memberName: 'Ahmad Daniel',
    amount: 200.0,
    paymentMethod: 'DuitNow QR',
    referenceNo: 'DN-99882211',
    paymentDate: '2026-03-01 14:22:10',
    receivedBy: 'Shihan Kannan',
  },
];

export const INITIAL_EVENTS: ClubEvent[] = [
  {
    id: 'Scms-EVT-000001',
    clubId: 'Scms-CLUB-000001',
    title: 'Goju-Ryu Sanchin & Tensho Kata Masterclass',
    eventType: 'Seminar',
    startDate: '2026-03-28T09:00:00Z',
    endDate: '2026-03-28T16:00:00Z',
    venue: 'Honbu Dojo Main Arena',
    description: 'Deep breathing kinetics and IBUSUKI principles led by visiting 8th Dan Grandmaster.',
    capacity: 60,
    participantCount: 45,
    volunteerCount: 6,
    status: 'Upcoming',
    createdAt: '2026-02-15T09:00:00Z',
  },
  {
    id: 'Scms-EVT-000002',
    clubId: 'Scms-CLUB-000001',
    title: 'State Junior Selection Camp 2026',
    eventType: 'Camp',
    startDate: '2026-04-10T08:00:00Z',
    endDate: '2026-04-12T17:00:00Z',
    venue: 'Kompleks Sukan MSN Saujana',
    description: 'Three-day intensive conditioning, tactical sparring, and video replay analysis.',
    capacity: 40,
    participantCount: 32,
    volunteerCount: 8,
    status: 'Upcoming',
    createdAt: '2026-02-20T10:00:00Z',
  },
];

export const INITIAL_TASKS: SystemTask[] = [
  {
    id: 'Scms-TSK-000001',
    title: 'Review and approve new club registration for Wira Kabaddi',
    description: 'Verify registration documents and primary administrator identity credentials.',
    assignedToName: 'Dato’ Sri Shanker',
    priority: 'High',
    dueDate: '2026-03-08',
    status: 'Open',
    createdBy: 'System Engine',
    createdAt: '2026-03-01T12:00:00Z',
  },
  {
    id: 'Scms-TSK-000002',
    title: 'Finalize KarateTech 3.0 draft entry for Senshi Open Championship',
    description: 'Check participant weigh-in compliance and submit final club roster.',
    assignedToName: 'Shihan Kannan',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    priority: 'Urgent',
    dueDate: '2026-03-15',
    status: 'In Progress',
    createdBy: 'Shihan Kannan',
    createdAt: '2026-03-02T10:00:00Z',
  },
];

export const INITIAL_APPROVALS: ApprovalRequest[] = [
  {
    id: 'Scms-APP-000001',
    type: 'Club Registration',
    title: 'New Club Registration: Wira Kabaddi Association',
    clubId: 'Scms-CLUB-000004',
    clubName: 'Wira Kabaddi Association',
    submittedByUserId: 'usr-wira-ravi',
    submittedByName: 'Ravi Chandran',
    submittedAt: '2026-03-01T12:00:00Z',
    status: 'Pending',
    payload: {
      sport: 'Kabaddi',
      city: 'Kuala Lumpur',
      registrationNo: 'KAB-KL-2022',
    },
  },
  {
    id: 'Scms-APP-000002',
    type: 'Branch Creation',
    title: 'New Branch Application: Dojo Cyberjaya Tech',
    clubId: 'Scms-CLUB-000001',
    clubName: 'Senshi Karate',
    branchName: 'Dojo Cyberjaya Tech',
    submittedByUserId: 'usr-clubadmin-senshi',
    submittedByName: 'Shihan Kannan',
    submittedAt: '2026-01-20T08:00:00Z',
    status: 'Approved',
    reviewedByName: 'Dato’ Sri Shanker',
    reviewedAt: '2026-01-21T10:00:00Z',
    decisionNotes: 'Approved. Complies with safety regulations and coach qualifications.',
    payload: {},
  },
  {
    id: 'Scms-APP-000003',
    type: 'Club Registration',
    title: 'Club Affiliation & Governance: Senshi Goju-Ryu Karate-Do Academy',
    clubId: 'Scms-CLUB-000001',
    clubName: 'Senshi Goju-Ryu Karate-Do Academy',
    submittedByUserId: 'usr-clubadmin-senshi',
    submittedByName: 'Shihan Kannan',
    submittedAt: '2026-01-10T08:00:00Z',
    status: 'Approved',
    reviewedByName: 'Dato’ Sri Shanker',
    reviewedAt: '2026-01-11T09:00:00Z',
    decisionNotes: 'Official club charter verified with Selangor Sports Commission.',
    payload: {
      registrationNo: 'C SGR-13884',
      sport: 'Karate',
    },
  },
];

export const INITIAL_AUTOMATION_RULES: AutomationRule[] = [
  {
    id: 'rule-01',
    clubId: 'Scms-CLUB-000001',
    name: '14-Day Membership Expiry Warning',
    triggerEvent: 'MEMBERSHIP_EXPIRING_DAYS',
    triggerConditionValue: 14,
    actionType: 'NOTIFY_MEMBER',
    actionTemplate: 'Dear {member_name}, your membership at {club_name} expires in 14 days. Please renew to keep your training spot active.',
    enabled: true,
    createdAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'rule-02',
    clubId: 'Scms-CLUB-000001',
    name: 'Consecutive Absenteeism Coach Alert',
    triggerEvent: 'ATTENDANCE_MISSED_CONSECUTIVE',
    triggerConditionValue: 3,
    actionType: 'NOTIFY_COACH',
    actionTemplate: 'Notice: {member_name} has missed 3 consecutive training sessions in {training_group}. Please follow up.',
    enabled: true,
    createdAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'rule-03',
    clubId: 'Scms-CLUB-000001',
    name: 'Tournament Registration Deadline Reminder',
    triggerEvent: 'TOURNAMENT_DEADLINE_APPROACHING',
    triggerConditionValue: 7,
    actionType: 'NOTIFY_ADMIN',
    actionTemplate: 'Urgent: Registration for tournament {tournament_name} closes in 7 days. {draft_count} athletes still in draft.',
    enabled: true,
    createdAt: '2026-01-10T08:00:00Z',
  },
];

export const INITIAL_ACTIVITY_LOGS: ActivityFeedItem[] = [
  {
    id: 'act-01',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    userName: 'Shihan Kannan',
    action: 'Payment Logged',
    details: 'Received MYR 200.00 from Ahmad Daniel (INV-2026-0001) via DuitNow QR.',
    module: 'FINANCE',
    timestamp: '2026-03-01T14:22:10Z',
  },
  {
    id: 'act-02',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    userName: 'Shihan Kannan',
    action: 'Attendance Recorded',
    details: 'Completed attendance roll for Elite Kumite Squad (18 athletes present).',
    module: 'ATTENDANCE',
    timestamp: '2026-03-02T21:35:00Z',
  },
  {
    id: 'act-03',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    userName: 'Ahmad Daniel',
    action: 'Volunteer Check-In',
    details: 'Checked in for Saturday Belt Grading Session at Honbu Dojo.',
    module: 'VOLUNTEER',
    timestamp: '2026-03-07T08:25:00Z',
  },
];

export const INITIAL_KARATETECH_MAPPINGS: KarateTechClubMapping[] = [
  {
    scmsClubId: 'Scms-CLUB-000001',
    karateTechClubId: '9a5e8b4e-1a2b-3c4d-5e6f-7a8b9c0d1e2f',
    karateTechClubName: 'Senshi Karate Academy',
    connectionStatus: 'Connected',
    lastSyncedAt: '2026-03-03T11:15:00Z',
  },
];

export const INITIAL_TOURNAMENT_DRAFTS: TournamentRegistrationDraft[] = [
  {
    id: 'Scms-TREG-000001',
    tournamentId: 'aa5e8b4e-1a2b-3c4d-5e6f-7a8b9c0d1e2f',
    tournamentName: 'Kelab Senshi Goju-Ryu Open Karate Championship 2026',
    tournamentDate: '15–16 August 2026',
    clubId: 'Scms-CLUB-000001',
    branchId: 'Scms-CLUB-000001-B001',
    idempotencyKey: 'idem-senshi-2026-0001-reg',
    status: 'READY',
    participants: [
      {
        scmsMemberId: 'Scms-MEM-000001',
        memberName: 'Ahmad Daniel bin Razak',
        discipline: 'Kumite',
        targetCategoryId: 'e25e8b4e-1a2b-3c4d-5e6f-7a8b9c0d1e2f',
        targetCategoryName: 'Male Kumite -67kg (18+)',
        ageAtTournament: 21,
        weightKg: 64.5,
        gender: 'Male',
        eligibilityPassed: true,
      },
      {
        scmsMemberId: 'Scms-MEM-000002',
        memberName: 'Chloe Tan Jia Xin',
        discipline: 'Kumite',
        targetCategoryId: 'e65e8b4e-1a2b-3c4d-5e6f-7a8b9c0d1e2f',
        targetCategoryName: 'Female Kumite -55kg (18+)',
        ageAtTournament: 21,
        weightKg: 52.0,
        gender: 'Female',
        eligibilityPassed: true,
      },
    ],
    createdAt: '2026-02-28T10:00:00Z',
    updatedAt: '2026-03-02T16:00:00Z',
  },
];

const INITIAL_PARENT_CONTACTS: ParentContact[] = [
  {
    id: 'Scms-PCON-000001',
    clubId: 'Scms-CLUB-000001',
    fullName: 'Tan Kok Wai',
    contactNumber: '+6012-1112222',
    email: 'kokwai.tan@example.com',
    isVolunteerEligible: true,
    volunteerCommunicationConsent: true,
    volunteerConsentTimestamp: '2026-01-20T10:00:00Z',
    volunteerInterests: ['Event Marshall', 'Logistics', 'First Aid Support'],
    availabilityNotes: 'Available on weekend mornings and tournament days.',
    isActive: true,
    createdBy: 'SUPERADMIN',
    updatedBy: 'SUPERADMIN',
    createdAt: '2026-01-20T10:00:00Z',
    updatedAt: '2026-01-20T10:00:00Z',
  },
  {
    id: 'Scms-PCON-000002',
    clubId: 'Scms-CLUB-000001',
    fullName: 'Puan Siti Zubaidah',
    contactNumber: '+6013-3334444',
    email: 'siti.zubaidah@example.com',
    isVolunteerEligible: true,
    volunteerCommunicationConsent: true,
    volunteerConsentTimestamp: '2026-01-22T09:30:00Z',
    volunteerInterests: ['Hospitality', 'Scorekeeping Assistant'],
    availabilityNotes: 'Can assist during Saturday afternoon sessions.',
    isActive: true,
    createdBy: 'SUPERADMIN',
    updatedBy: 'SUPERADMIN',
    createdAt: '2026-01-22T09:30:00Z',
    updatedAt: '2026-01-22T09:30:00Z',
  },
  {
    id: 'Scms-PCON-000003',
    clubId: 'Scms-CLUB-000001',
    fullName: 'Puan Fatimah Ali',
    contactNumber: '+6017-9999999',
    email: 'fatimah.ali@example.com',
    isVolunteerEligible: true,
    volunteerCommunicationConsent: true,
    volunteerConsentTimestamp: '2026-01-25T14:15:00Z',
    volunteerInterests: ['Event Marshall', 'Check-in Desk'],
    availabilityNotes: 'Available for youth tournaments and belt gradings.',
    isActive: true,
    createdBy: 'SUPERADMIN',
    updatedBy: 'SUPERADMIN',
    createdAt: '2026-01-25T14:15:00Z',
    updatedAt: '2026-01-25T14:15:00Z',
  },
  {
    id: 'Scms-PCON-000004',
    clubId: 'Scms-CLUB-000001',
    fullName: 'Krishnan Murugan',
    contactNumber: '+6011-8889999',
    email: 'krishnan.m@example.com',
    isVolunteerEligible: false,
    volunteerCommunicationConsent: false,
    availabilityNotes: 'Emergency contacts only.',
    isActive: true,
    createdBy: 'SUPERADMIN',
    updatedBy: 'SUPERADMIN',
    createdAt: '2026-02-01T11:00:00Z',
    updatedAt: '2026-02-01T11:00:00Z',
  },
  {
    id: 'Scms-PCON-000005',
    clubId: 'Scms-CLUB-000001',
    fullName: 'Mrs. Linda Wong',
    contactNumber: '+6017-7778888',
    email: 'linda.wong@example.com',
    isVolunteerEligible: true,
    volunteerCommunicationConsent: true,
    volunteerConsentTimestamp: '2026-02-05T08:00:00Z',
    volunteerInterests: ['Media & Photography', 'Refreshments'],
    availabilityNotes: 'Specializes in tournament photography and media coverage.',
    isActive: true,
    createdBy: 'SUPERADMIN',
    updatedBy: 'SUPERADMIN',
    createdAt: '2026-02-05T08:00:00Z',
    updatedAt: '2026-02-05T08:00:00Z',
  },
];

const INITIAL_ATHLETE_GUARDIAN_RELATIONSHIPS: AthleteGuardianRelationship[] = [
  {
    id: 'Scms-AGR-000001',
    athleteId: 'Scms-MEM-000002', // Chloe Tan Jia Xin
    guardianContactId: 'Scms-PCON-000001', // Tan Kok Wai
    relationship: 'Father',
    isPrimaryContact: true,
    isEmergencyContact: true,
    createdAt: '2026-01-20T10:00:00Z',
    updatedAt: '2026-01-20T10:00:00Z',
  },
  {
    id: 'Scms-AGR-000002',
    athleteId: 'Scms-MEM-000001', // Ahmad Danial
    guardianContactId: 'Scms-PCON-000002', // Puan Siti Zubaidah
    relationship: 'Mother',
    isPrimaryContact: true,
    isEmergencyContact: true,
    createdAt: '2026-01-22T09:30:00Z',
    updatedAt: '2026-01-22T09:30:00Z',
  },
  {
    id: 'Scms-AGR-000003',
    athleteId: 'Scms-MEM-000003', // Muhammad Ryan
    guardianContactId: 'Scms-PCON-000003', // Puan Fatimah Ali
    relationship: 'Mother',
    isPrimaryContact: true,
    isEmergencyContact: true,
    createdAt: '2026-01-25T14:15:00Z',
    updatedAt: '2026-01-25T14:15:00Z',
  },
  {
    id: 'Scms-AGR-000004',
    athleteId: 'Scms-MEM-000004', // Subramaniam Krishnan
    guardianContactId: 'Scms-PCON-000004', // Krishnan Murugan
    relationship: 'Father',
    isPrimaryContact: true,
    isEmergencyContact: true,
    createdAt: '2026-02-01T11:00:00Z',
    updatedAt: '2026-02-01T11:00:00Z',
  },
  {
    id: 'Scms-AGR-000005',
    athleteId: 'Scms-MEM-000006', // Nur Aisyah binti Abdullah
    guardianContactId: 'Scms-PCON-000003', // Puan Fatimah Ali
    relationship: 'Mother',
    isPrimaryContact: true,
    isEmergencyContact: true,
    createdAt: '2026-02-01T11:00:00Z',
    updatedAt: '2026-02-01T11:00:00Z',
  },
  {
    id: 'Scms-AGR-000006',
    athleteId: 'Scms-MEM-000005', // Lucas Wong Kai Le
    guardianContactId: 'Scms-PCON-000005', // Mrs. Linda Wong
    relationship: 'Mother',
    isPrimaryContact: true,
    isEmergencyContact: true,
    createdAt: '2026-02-05T08:00:00Z',
    updatedAt: '2026-02-05T08:00:00Z',
  },
];

// ==========================================
// Scms MASTER STORE CLASS
// ==========================================

class ScmsStore {
  clubs: Club[];
  branches: ClubBranch[];
  users: User[];
  members: Member[];
  volunteers: Volunteer[] = [...INITIAL_VOLUNTEERS];
  volunteerAssignments: VolunteerAssignment[] = [...INITIAL_VOLUNTEER_ASSIGNMENTS];
  trainingGroups: TrainingGroup[] = [...INITIAL_TRAINING_GROUPS];
  sessions: TrainingClassSession[] = [...INITIAL_SESSIONS];

  constructor() {
    // Attempt to load mock data from localStorage to persist edits across refreshes
    if (typeof window !== 'undefined') {
      try {
        const savedUsers = localStorage.getItem('scms_mock_users');
        if (savedUsers) {
          try {
            const parsedUsers: User[] = JSON.parse(savedUsers);
            const userMap = new Map<string, User>();
            INITIAL_USERS.forEach(u => userMap.set(u.id, u));
            parsedUsers.forEach(u => {
              if (u && u.id) {
                userMap.set(u.id, { ...userMap.get(u.id), ...u });
              }
            });
            this.users = Array.from(userMap.values());
          } catch (e) {
            this.users = [...INITIAL_USERS];
          }
        } else {
          this.users = [...INITIAL_USERS];
        }
        
        const savedClubs = localStorage.getItem('scms_mock_clubs');
        if (savedClubs) {
          const parsedClubs: Club[] = JSON.parse(savedClubs);
          const clubMap = new Map<string, Club>();
          INITIAL_CLUBS.forEach(c => clubMap.set(c.id, c));
          parsedClubs.forEach(c => clubMap.set(c.id, { ...clubMap.get(c.id), ...c }));
          this.clubs = Array.from(clubMap.values()).map(c => {
            if (!c.displayName || c.displayName.trim() === '' || c.displayName.length > 30) {
              const initial = INITIAL_CLUBS.find(init => init.id === c.id);
              if (initial?.displayName) {
                c.displayName = initial.displayName;
              } else if (c.name.toLowerCase().includes('senshi')) {
                c.displayName = 'Senshi Goju-Ryu';
              } else if (c.name.length <= 30) {
                c.displayName = c.name.trim();
              } else {
                c.displayName = c.name.trim().substring(0, 30);
              }
            }
            return c;
          });
        } else {
          this.clubs = [...INITIAL_CLUBS];
        }
        
        const savedBranches = localStorage.getItem('scms_mock_branches');
        if (savedBranches) {
          const parsedBranches: ClubBranch[] = JSON.parse(savedBranches);
          const branchMap = new Map<string, ClubBranch>();
          INITIAL_BRANCHES.forEach(b => branchMap.set(b.id, b));
          parsedBranches.forEach(b => {
            if (b.name === 'Dojo Puchong Perdana' && b.id === 'Scms-CLUB-000001-B001') {
              b.name = 'Dojo Saujana Puchong (HQ)';
            }
            branchMap.set(b.id, { ...branchMap.get(b.id), ...b });
          });
          this.branches = Array.from(branchMap.values());
        } else {
          this.branches = [...INITIAL_BRANCHES];
        }

        const savedApprovals = localStorage.getItem('scms_mock_approvals');
        if (savedApprovals) {
          const parsedApprovals: ApprovalRequest[] = JSON.parse(savedApprovals);
          const appMap = new Map<string, ApprovalRequest>();
          INITIAL_APPROVALS.forEach(a => appMap.set(a.id, a));
          parsedApprovals.forEach(a => appMap.set(a.id, { ...appMap.get(a.id), ...a }));
          this.approvals = Array.from(appMap.values());
        } else {
          this.approvals = [...INITIAL_APPROVALS];
        }

        const savedMembers = localStorage.getItem('scms_mock_members');
        const memberMap = new Map<string, Member>();
        INITIAL_MEMBERS.forEach(m => memberMap.set(m.id, m));
        if (savedMembers) {
          try {
            const parsedMembers: Member[] = JSON.parse(savedMembers);
            parsedMembers.forEach(m => {
              if (m && m.id) {
                memberMap.set(m.id, { ...memberMap.get(m.id), ...m });
              }
            });
          } catch (e) {
            console.error('Failed to parse saved members', e);
          }
        }
        this.members = Array.from(memberMap.values());

        const savedParentContacts = localStorage.getItem('scms_mock_parent_contacts');
        const pMap = new Map<string, ParentContact>();
        INITIAL_PARENT_CONTACTS.forEach(p => pMap.set(p.id, p));
        if (savedParentContacts) {
          try {
            const parsed = JSON.parse(savedParentContacts);
            parsed.forEach((p: ParentContact) => { if (p && p.id) pMap.set(p.id, { ...pMap.get(p.id), ...p }); });
          } catch (e) {}
        }
        this.parentContacts = Array.from(pMap.values());

        const savedAthleteGuardianRelationships = localStorage.getItem('scms_mock_athlete_guardian_relationships');
        const relMap = new Map<string, AthleteGuardianRelationship>();
        INITIAL_ATHLETE_GUARDIAN_RELATIONSHIPS.forEach(r => relMap.set(r.id, r));
        if (savedAthleteGuardianRelationships) {
          try {
            const parsed = JSON.parse(savedAthleteGuardianRelationships);
            parsed.forEach((r: AthleteGuardianRelationship) => { if (r && r.id) relMap.set(r.id, { ...relMap.get(r.id), ...r }); });
          } catch (e) {}
        }
        this.athleteGuardianRelationships = Array.from(relMap.values());

        const savedNewVolunteerAssignments = localStorage.getItem('scms_mock_new_volunteer_assignments');
        this.newVolunteerAssignments = savedNewVolunteerAssignments ? JSON.parse(savedNewVolunteerAssignments) : [];

        const savedVolunteerAssignmentMembers = localStorage.getItem('scms_mock_volunteer_assignment_members');
        this.volunteerAssignmentMembers = savedVolunteerAssignmentMembers ? JSON.parse(savedVolunteerAssignmentMembers) : [];
      } catch (e) {
        this.users = [...INITIAL_USERS];
        this.clubs = [...INITIAL_CLUBS];
        this.branches = [...INITIAL_BRANCHES];
        this.members = [...INITIAL_MEMBERS];
        this.approvals = [...INITIAL_APPROVALS];
        this.parentContacts = [...INITIAL_PARENT_CONTACTS];
        this.athleteGuardianRelationships = [...INITIAL_ATHLETE_GUARDIAN_RELATIONSHIPS];
        this.newVolunteerAssignments = [];
        this.volunteerAssignmentMembers = [];
      }
    } else {
      this.users = [...INITIAL_USERS];
      this.clubs = [...INITIAL_CLUBS];
      this.branches = [...INITIAL_BRANCHES];
      this.members = [...INITIAL_MEMBERS];
      this.approvals = [...INITIAL_APPROVALS];
      this.parentContacts = [...INITIAL_PARENT_CONTACTS];
      this.athleteGuardianRelationships = [...INITIAL_ATHLETE_GUARDIAN_RELATIONSHIPS];
      this.newVolunteerAssignments = [];
      this.volunteerAssignmentMembers = [];
    }
  }

  private saveState() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('scms_mock_users', JSON.stringify(this.users));
      localStorage.setItem('scms_mock_clubs', JSON.stringify(this.clubs));
      localStorage.setItem('scms_mock_branches', JSON.stringify(this.branches));
      localStorage.setItem('scms_mock_members', JSON.stringify(this.members));
      localStorage.setItem('scms_mock_approvals', JSON.stringify(this.approvals));
      localStorage.setItem('scms_mock_parent_contacts', JSON.stringify(this.parentContacts));
      localStorage.setItem('scms_mock_athlete_guardian_relationships', JSON.stringify(this.athleteGuardianRelationships));
      localStorage.setItem('scms_mock_new_volunteer_assignments', JSON.stringify(this.newVolunteerAssignments));
      localStorage.setItem('scms_mock_volunteer_assignment_members', JSON.stringify(this.volunteerAssignmentMembers));
    }
  }
  attendance: AttendanceRecord[] = [...INITIAL_ATTENDANCE];
  plans: MembershipPlan[] = [...INITIAL_PLANS];
  invoices: Invoice[] = [...INITIAL_INVOICES];
  receipts: PaymentReceipt[] = [...INITIAL_RECEIPTS];
  events: ClubEvent[] = [...INITIAL_EVENTS];
  documents: SystemDocument[] = [];
  tasks: SystemTask[] = [...INITIAL_TASKS];
  approvals: ApprovalRequest[] = [...INITIAL_APPROVALS];
  automationRules: AutomationRule[] = [...INITIAL_AUTOMATION_RULES];
  automationLogs: AutomationLog[] = [];
  activityLogs: ActivityFeedItem[] = [...INITIAL_ACTIVITY_LOGS];
  karateTechMappings: KarateTechClubMapping[] = [...INITIAL_KARATETECH_MAPPINGS];
  tournamentDrafts: TournamentRegistrationDraft[] = [...INITIAL_TOURNAMENT_DRAFTS];
  
  parentContacts: ParentContact[] = [];
  athleteGuardianRelationships: AthleteGuardianRelationship[] = [];
  newVolunteerAssignments: NewVolunteerAssignment[] = [];
  volunteerAssignmentMembers: VolunteerAssignmentMember[] = [];

  // Audit Logger
  logActivity(
    userName: string,
    action: string,
    details: string,
    module: ActivityFeedItem['module'],
    clubId?: string,
    branchId?: string
  ) {
    const item: ActivityFeedItem = {
      id: 'act-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      userName,
      action,
      details,
      module,
      clubId,
      branchId,
      timestamp: new Date().toISOString(),
    };
    this.activityLogs.unshift(item);
    if (this.activityLogs.length > 200) {
      this.activityLogs.pop();
    }
  }

  // Club Operations
  getClubs(filterStatus?: string): Club[] {
    if (!filterStatus || filterStatus === 'All') return this.clubs;
    return this.clubs.filter(c => c.status === filterStatus);
  }

  getClubById(clubId: string): Club | undefined {
    return this.clubs.find(c => c.id === clubId);
  }

  registerClub(clubData: Partial<Club>, primaryAdmin: { name: string; email: string; phone: string }): Club {
    const clubId = generateImmutableId('CLUB');
    const newClub: Club = {
      id: clubId,
      name: clubData.name || 'Unnamed Club',
      shortName: clubData.shortName || clubData.name || 'Club',
      scoreboardAbbreviation: clubData.scoreboardAbbreviation,
      sport: clubData.sport || 'Karate',
      registrationNo: clubData.registrationNo || 'PENDING',
      establishedYear: clubData.establishedYear || new Date().getFullYear(),
      address: clubData.address || '',
      city: clubData.city || '',
      state: clubData.state || '',
      postcode: clubData.postcode || '',
      country: clubData.country || 'Malaysia',
      phone: clubData.phone || primaryAdmin.phone,
      email: clubData.email || primaryAdmin.email,
      website: clubData.website,
      logoUrl: clubData.logoUrl,
      description: clubData.description,
      status: 'Submitted',
      primaryAdminName: primaryAdmin.name,
      primaryAdminEmail: primaryAdmin.email,
      primaryAdminPhone: primaryAdmin.phone,
      onboardingStep: 1,
      onboardingCompleted: false,
      branchCount: 0,
      memberCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.clubs.unshift(newClub);

    // Create approval request for SuperAdmin
    const approvalId = generateImmutableId('APP');
    this.approvals.unshift({
      id: approvalId,
      type: 'Club Registration',
      title: `New Club Registration: ${newClub.name}`,
      clubId: newClub.id,
      clubName: newClub.name,
      submittedByUserId: 'guest-reg',
      submittedByName: primaryAdmin.name,
      submittedAt: new Date().toISOString(),
      status: 'Pending',
      payload: newClub,
    });

    this.logActivity(
      primaryAdmin.name,
      'Club Registration Submitted',
      `Club ${newClub.name} (${newClub.id}) registered and awaiting SuperAdmin approval.`,
      'CLUB',
      newClub.id
    );

    return newClub;
  }

  approveClub(approvalId: string, reviewedByName: string, decisionNotes?: string): boolean {
    const app = this.approvals.find(a => a.id === approvalId);
    if (!app || !app.clubId) return false;

    app.status = 'Approved';
    app.reviewedByName = reviewedByName;
    app.reviewedAt = new Date().toISOString();
    app.decisionNotes = decisionNotes || 'Approved by Platform Administrator';

    const club = this.clubs.find(c => c.id === app.clubId);
    if (club) {
      club.status = 'Active';
      club.updatedAt = new Date().toISOString();

      // Automatically create HQ branch
      const branchId = generateImmutableId('BRANCH', club.id, 1);
      const hqBranch: ClubBranch = {
        id: branchId,
        clubId: club.id,
        name: `${club.shortName} Main Branch (HQ)`,
        address: club.address,
        city: club.city,
        state: club.state,
        postcode: club.postcode,
        country: club.country,
        phone: club.phone,
        email: club.email,
        managerName: club.primaryAdminName,
        venueName: `${club.shortName} Main Hall`,
        status: 'Active',
        memberCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.branches.push(hqBranch);
      club.branchCount = 1;

      this.logActivity(
        reviewedByName,
        'Club Approved',
        `Club ${club.name} (${club.id}) approved and activated with HQ branch ${branchId}.`,
        'APPROVAL',
        club.id
      );
      return true;
    }
    return false;
  }

  // Branch Operations
  getBranches(clubId?: string): ClubBranch[] {
    if (!clubId) return this.branches;
    return this.branches.filter(b => b.clubId === clubId);
  }

  updateUser(userId: string, updates: Partial<User>): boolean {
    const user = this.users.find(u => u.id === userId);
    if (!user) return false;
    
    Object.assign(user, updates);
    this.saveState();
    return true;
  }

  updateClub(clubId: string, updates: Partial<Club>, operatorName: string = 'SYSTEM'): boolean {
    const club = this.clubs.find(c => c.id === clubId);
    if (!club) return false;

    // Validate and sanitize displayName if provided
    if (updates.displayName !== undefined) {
      const trimmed = updates.displayName.trim();
      if (!trimmed) {
        throw new Error('Club display name cannot be empty or whitespace only.');
      }
      if (trimmed.length > 30) {
        throw new Error(`Club display name exceeds the 30-character limit (${trimmed.length}/30).`);
      }
      updates.displayName = trimmed;
    }
    
    const prevDisplayName = club.displayName;
    Object.assign(club, updates);
    club.updatedAt = new Date().toISOString();
    this.saveState();

    if (updates.displayName && updates.displayName !== prevDisplayName) {
      this.logActivity(
        operatorName,
        'Club Display Name Updated',
        `Display name for club "${club.name}" changed from "${prevDisplayName || 'None'}" to "${club.displayName}".`,
        'CLUB',
        clubId
      );
    } else {
      this.logActivity(
        operatorName,
        'Club Profile Updated',
        `Club profile details updated for "${club.name}".`,
        'CLUB',
        clubId
      );
    }

    return true;
  }

  deleteClub(clubId: string, operatorName: string = 'SUPERADMIN'): boolean {
    const idx = this.clubs.findIndex(c => c.id === clubId);
    if (idx === -1) return false;

    const club = this.clubs[idx];
    const clubName = club.name;

    // Remove club
    this.clubs.splice(idx, 1);

    // Remove branches
    this.branches = this.branches.filter(b => b.clubId !== clubId);

    // Remove members
    this.members = this.members.filter(m => m.clubId !== clubId);

    // Remove parent contacts
    this.parentContacts = this.parentContacts.filter(p => p.clubId !== clubId);

    // Remove user roles for this club
    this.users.forEach(u => {
      u.roles = u.roles.filter(r => r.clubId !== clubId);
      if (u.activeClubId === clubId) {
        delete u.activeClubId;
        delete u.activeBranchId;
      }
    });

    // Remove associated invoices, attendance, events, approvals
    this.invoices = this.invoices.filter(i => i.clubId !== clubId);
    this.attendance = this.attendance.filter(ar => ar.clubId !== clubId);
    this.events = this.events.filter(e => e.clubId !== clubId);
    this.approvals = this.approvals.filter(a => a.clubId !== clubId);

    this.saveState();

    this.logActivity(
      operatorName,
      'Club Deleted',
      `Permanently deleted club "${clubName}" (${clubId}) and all associated records.`,
      'CLUB'
    );

    return true;
  }

  updateBranch(branchId: string, updates: Partial<ClubBranch>, operatorName: string = 'SYSTEM'): boolean {
    const branch = this.branches.find(b => b.id === branchId);
    if (!branch) return false;
    
    // Safety: Prevent reassignment of branch to another club
    delete (updates as any).clubId;
    delete (updates as any).id;

    Object.assign(branch, updates);
    branch.updatedAt = new Date().toISOString();
    this.saveState();

    this.logActivity(
      operatorName,
      'Branch Profile Updated',
      `Branch details updated for "${branch.name}" (${branchId}).`,
      'CLUB',
      branch.clubId,
      branchId
    );

    return true;
  }

  assignClubAdmin(clubId: string, memberIdOrEmail: string, operatorName: string = 'SuperAdmin'): boolean {
    const club = this.clubs.find(c => c.id === clubId);
    if (!club) return false;

    const member = this.members.find(m => m.id === memberIdOrEmail || m.email === memberIdOrEmail);
    const user = this.users.find(u => u.id === memberIdOrEmail || u.email === memberIdOrEmail || (member && u.email === member.email));

    const adminName = member?.fullName || user?.fullName || memberIdOrEmail;
    const adminEmail = member?.email || user?.email || club.email;
    const adminPhone = member?.phone || user?.phone || club.phone;
    const adminId = user?.id || member?.id || memberIdOrEmail;

    club.primaryAdminId = adminId;
    club.primaryAdminName = adminName;
    club.primaryAdminEmail = adminEmail;
    club.primaryAdminPhone = adminPhone;
    club.updatedAt = new Date().toISOString();

    if (member) {
      if (!member.roles) member.roles = [];
      if (!member.roles.includes('CLUB_ADMIN')) {
        member.roles.push('CLUB_ADMIN');
      }
    }

    if (user) {
      if (!user.roles.some(r => r.role === 'CLUB_ADMIN' && r.clubId === clubId)) {
        user.roles.push({
          role: 'CLUB_ADMIN',
          clubId,
          grantedAt: new Date().toISOString()
        });
      }
    }

    this.logActivity(
      operatorName,
      'Club Admin Assigned',
      `Assigned ${adminName} (${adminEmail}) as Primary Club Admin for "${club.name}".`,
      'CLUB',
      clubId
    );

    this.saveState();
    return true;
  }

  assignBranchManager(clubId: string, branchId: string, memberIdOrEmail: string, operatorName: string = 'SuperAdmin'): boolean {
    const branch = this.branches.find(b => b.id === branchId);
    if (!branch) return false;

    const member = this.members.find(m => m.id === memberIdOrEmail || m.email === memberIdOrEmail);
    const user = this.users.find(u => u.id === memberIdOrEmail || u.email === memberIdOrEmail || (member && u.email === member.email));

    const managerName = member?.fullName || user?.fullName || memberIdOrEmail;
    const managerId = user?.id || member?.id || memberIdOrEmail;

    branch.managerId = managerId;
    branch.managerName = managerName;
    branch.updatedAt = new Date().toISOString();

    if (member) {
      if (!member.roles) member.roles = [];
      if (!member.roles.includes('BRANCH_MANAGER')) {
        member.roles.push('BRANCH_MANAGER');
      }
    }

    if (user) {
      if (!user.roles.some(r => r.role === 'BRANCH_MANAGER' && r.branchId === branchId)) {
        user.roles.push({
          role: 'BRANCH_MANAGER',
          clubId,
          branchId,
          grantedAt: new Date().toISOString()
        });
      }
    }

    this.logActivity(
      operatorName,
      'Branch Manager Assigned',
      `Assigned ${managerName} as Branch Manager for "${branch.name}".`,
      'CLUB',
      clubId,
      branchId
    );

    this.saveState();
    return true;
  }

  addBranch(clubId: string, branchData: Partial<ClubBranch>, operatorName: string): ClubBranch {
    const existing = this.branches.filter(b => b.clubId === clubId);
    const branchNumber = existing.length + 1;
    const branchId = generateImmutableId('BRANCH', clubId, branchNumber);

    const newBranch: ClubBranch = {
      id: branchId,
      clubId,
      name: branchData.name || `Branch ${branchNumber}`,
      displayName: branchData.displayName || branchData.name,
      district: branchData.district || '',
      address: branchData.address || '',
      city: branchData.city || '',
      state: branchData.state || '',
      postcode: branchData.postcode || '',
      country: branchData.country || 'Malaysia',
      phone: branchData.phone || '',
      email: branchData.email || '',
      managerId: branchData.managerId,
      managerName: branchData.managerName,
      venueName: branchData.venueName || 'Branch Sports Facility',
      operatingHours: branchData.operatingHours,
      status: (branchData.status as any) || 'Active',
      memberCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.branches.push(newBranch);

    const club = this.getClubById(clubId);
    if (club) {
      club.branchCount = (club.branchCount || 0) + 1;
    }

    this.logActivity(
      operatorName,
      'Branch Created',
      `New branch ${newBranch.name} (${newBranch.id}) established for ${club?.name}.`,
      'CLUB',
      clubId,
      branchId
    );

    return newBranch;
  }

  // Member Operations
  getMembers(clubId?: string, branchId?: string): Member[] {
    let result = this.members;
    if (clubId) result = result.filter(m => m.clubId === clubId);
    if (branchId && branchId !== '__ALL__') result = result.filter(m => m.branchId === branchId);
    const seen = new Set<string>();
    return result.filter(m => {
      if (!m.id || seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }

  getMemberById(memberId: string): Member | undefined {
    return this.members.find(m => 
      m.id === memberId || 
      (m.userId && m.userId === memberId) || 
      (m.email && m.email.toLowerCase() === memberId.toLowerCase())
    );
  }

  addMember(memberData: Partial<Member>, operatorName: string): Member {
    let memberId = generateImmutableId('MEM');
    while (this.members.some(m => m.id === memberId)) {
      memberId = generateImmutableId('MEM');
    }
    const newMember: Member = {
      id: memberId,
      clubId: memberData.clubId || 'Scms-CLUB-000001',
      branchId: memberData.branchId || 'Scms-CLUB-000001-B001',
      fullName: memberData.fullName || 'New Member',
      preferredName: memberData.preferredName,
      gender: memberData.gender || 'Male',
      dob: memberData.dob || '2000-01-01',
      icPassport: memberData.icPassport || 'PENDING',
      nationality: memberData.nationality || 'Malaysian',
      email: memberData.email,
      phone: memberData.phone,
      address: memberData.address,
      emergencyContactName: memberData.emergencyContactName || 'None',
      emergencyContactPhone: memberData.emergencyContactPhone || 'None',
      emergencyContactRelation: memberData.emergencyContactRelation || 'Guardian',
      status: 'Active',
      roles: memberData.roles || (memberData.isAthlete ? ['ATHLETE'] : ['MEMBER']),
      isAthlete: !!memberData.isAthlete,
      isVolunteer: !!memberData.isVolunteer,
      assignedCoachName: memberData.assignedCoachName,
      trainingGroupId: memberData.trainingGroupId,
      sportData: memberData.sportData || {},
      joinedDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.members.unshift(newMember);

    // If volunteer checked, register volunteer record
    if (newMember.isVolunteer) {
      const volId = generateImmutableId('VOL');
      this.volunteers.push({
        id: volId,
        memberId: newMember.id,
        clubId: newMember.clubId,
        branchId: newMember.branchId,
        skills: ['General Event Assistance'],
        availability: ['Weekend'],
        preferredDuties: ['Club Activities'],
        startDate: newMember.joinedDate,
        status: 'Active',
        totalHours: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    const club = this.getClubById(newMember.clubId);
    if (club) club.memberCount = (club.memberCount || 0) + 1;

    this.logActivity(
      operatorName,
      'Member Registered',
      `Registered member ${newMember.fullName} (${newMember.id}) into ${club?.name}.`,
      'MEMBER',
      newMember.clubId,
      newMember.branchId
    );

    this.saveState();
    return newMember;
  }

  updateMember(memberId: string, updates: Partial<Member>, operatorName: string): Member | undefined {
    let idx = this.members.findIndex(m => 
      m.id === memberId || 
      (m.userId && m.userId === memberId) || 
      (m.email && (m.email.toLowerCase() === memberId.toLowerCase() || (updates.email && m.email.toLowerCase() === updates.email.toLowerCase())))
    );

    if (idx === -1) {
      const user = this.users.find(u => 
        u.id === memberId || 
        (u.email && (u.email.toLowerCase() === memberId.toLowerCase() || (updates.email && u.email.toLowerCase() === updates.email.toLowerCase())))
      );
      const newM: Member = {
        id: memberId.startsWith('Scms-MEM') ? memberId : `Scms-MEM-${Date.now()}`,
        userId: user?.id || (memberId.startsWith('usr-') ? memberId : undefined),
        clubId: updates.clubId || user?.activeClubId || 'Scms-CLUB-000001',
        branchId: updates.branchId || user?.activeBranchId || 'Scms-CLUB-000001-B001',
        fullName: updates.fullName || user?.fullName || 'Member',
        email: updates.email || user?.email,
        phone: updates.phone || user?.phone,
        status: updates.status || 'Active',
        roles: updates.roles || ['MEMBER'],
        isAthlete: !!updates.isAthlete,
        isVolunteer: !!updates.isVolunteer,
        icPassport: updates.icPassport || 'PENDING',
        nationality: updates.nationality || 'Malaysian',
        dob: updates.dob || '2000-01-01',
        gender: updates.gender || 'Male',
        emergencyContactName: updates.emergencyContactName || 'None',
        emergencyContactPhone: updates.emergencyContactPhone || 'None',
        emergencyContactRelation: updates.emergencyContactRelation || 'None',
        joinedDate: new Date().toISOString().split('T')[0],
        sportData: updates.sportData || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.members.unshift(newM);
      idx = 0;
    } else {
      this.members[idx] = {
        ...this.members[idx],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
    }

    const updatedMember = this.members[idx];

    // Synchronize roles with this.users if this member is also a system user
    const userIdx = this.users.findIndex(u => 
      u.id === memberId || 
      (updatedMember.userId && u.id === updatedMember.userId) || 
      (u.email && updatedMember.email && u.email.toLowerCase() === updatedMember.email.toLowerCase())
    );

    if (userIdx !== -1 && updates.roles) {
      const targetClubId = updatedMember.clubId || 'Scms-CLUB-000001';
      const targetBranchId = updatedMember.branchId;

      const otherClubRoles = this.users[userIdx].roles.filter(r => r.clubId && r.clubId !== targetClubId);
      const updatedClubRoles = updates.roles.map(r => ({
        role: r as SystemRole,
        clubId: targetClubId,
        branchId: targetBranchId,
        grantedAt: new Date().toISOString()
      }));

      this.users[userIdx] = {
        ...this.users[userIdx],
        fullName: updates.fullName || this.users[userIdx].fullName,
        phone: updates.phone || this.users[userIdx].phone,
        roles: [...otherClubRoles, ...updatedClubRoles],
        activeRole: (updates.roles[0] as SystemRole) || this.users[userIdx].activeRole,
        activeBranchId: targetBranchId || this.users[userIdx].activeBranchId
      };
    }

    this.logActivity(
      operatorName,
      'Member Updated',
      `Updated member profile for ${updatedMember.fullName} (${memberId}). Roles: ${updates.roles?.join(', ')}`,
      'MEMBER',
      updatedMember.clubId,
      updatedMember.branchId
    );

    this.saveState();
    return updatedMember;
  }

  deleteMember(memberId: string, operatorName: string, clubId?: string): boolean {
    let deleted = false;
    let memberName = memberId;
    let targetClubId = clubId;
    let targetBranchId: string | undefined;

    // 1. Delete from members
    const idx = this.members.findIndex(m => 
      m.id === memberId || 
      (m.userId && m.userId === memberId) || 
      (m.email && m.email.toLowerCase() === memberId.toLowerCase())
    );
    if (idx !== -1) {
      const member = this.members[idx];
      memberName = member.fullName;
      targetClubId = targetClubId || member.clubId;
      targetBranchId = member.branchId;
      this.members.splice(idx, 1);
      deleted = true;
    }

    // 2. Also remove role / user from users list
    const userIdx = this.users.findIndex(u => 
      u.id === memberId || 
      (u.email && u.email.toLowerCase() === memberId.toLowerCase())
    );
    if (userIdx !== -1) {
      memberName = this.users[userIdx].fullName;
      if (clubId) {
        this.users[userIdx].roles = this.users[userIdx].roles.filter(r => r.clubId !== clubId);
        if (this.users[userIdx].activeClubId === clubId) {
          delete this.users[userIdx].activeClubId;
          delete this.users[userIdx].activeBranchId;
        }
        if (this.users[userIdx].roles.length === 0) {
          this.users.splice(userIdx, 1);
        }
      } else {
        this.users.splice(userIdx, 1);
      }
      deleted = true;
    }

    // 3. Remove athlete relationships & links
    this.athleteGuardianRelationships = this.athleteGuardianRelationships.filter(
      r => r.athleteId !== memberId && r.guardianContactId !== memberId
    );

    // 4. Remove volunteer record if any
    this.volunteers = this.volunteers.filter(v => v.memberId !== memberId);

    if (deleted) {
      this.saveState();
      this.logActivity(
        operatorName,
        'Member Deleted',
        `Deleted member ${memberName} (${memberId}).`,
        'MEMBER',
        targetClubId || 'Scms-CLUB-000001',
        targetBranchId
      );
    }

    return deleted;
  }

  // Volunteer Operations
  getVolunteers(clubId?: string): (Volunteer & { member: Member | undefined })[] {
    let list = this.volunteers;
    if (clubId) list = list.filter(v => v.clubId === clubId);
    return list.map(v => ({
      ...v,
      member: this.getMemberById(v.memberId),
    }));
  }

  volunteerCheckIn(assignmentId: string, volunteerName: string): boolean {
    const a = this.volunteerAssignments.find(x => x.id === assignmentId);
    if (!a) return false;
    a.actualCheckInTime = new Date().toISOString();
    a.status = 'Checked In';

    this.logActivity(
      volunteerName,
      'Volunteer Check-In',
      `Volunteer ${volunteerName} checked in for ${a.eventName || a.dutyType}.`,
      'VOLUNTEER',
      a.clubId,
      a.branchId
    );
    return true;
  }

  volunteerCheckOut(assignmentId: string, volunteerName: string): boolean {
    const a = this.volunteerAssignments.find(x => x.id === assignmentId);
    if (!a || !a.actualCheckInTime) return false;

    const checkOut = new Date();
    a.actualCheckOutTime = checkOut.toISOString();
    a.status = 'Completed';

    // Calculate actual hours
    const checkIn = new Date(a.actualCheckInTime);
    const diffHours = Math.max(0.5, Math.round(((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)) * 10) / 10);
    a.actualHours = diffHours;

    // Credit volunteer hours
    const v = this.volunteers.find(vol => vol.id === a.volunteerId);
    if (v) {
      v.totalHours = (v.totalHours || 0) + diffHours;
      v.updatedAt = new Date().toISOString();
    }

    this.logActivity(
      volunteerName,
      'Volunteer Check-Out',
      `Volunteer ${volunteerName} checked out (${diffHours} hours completed).`,
      'VOLUNTEER',
      a.clubId,
      a.branchId
    );
    return true;
  }

  // Attendance Operations
  recordAttendance(sessionId: string, records: { memberId: string; status: AttendanceRecord['status']; remarks?: string }[], operatorName: string): void {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) return;

    for (const r of records) {
      const member = this.getMemberById(r.memberId);
      const existingIdx = this.attendance.findIndex(a => a.sessionId === sessionId && a.memberId === r.memberId);
      if (existingIdx >= 0) {
        this.attendance[existingIdx].status = r.status;
        this.attendance[existingIdx].remarks = r.remarks;
        this.attendance[existingIdx].updatedAt = new Date().toISOString();
      } else {
        this.attendance.push({
          id: 'att-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          sessionId,
          memberId: r.memberId,
          memberName: member?.fullName || 'Athlete',
          clubId: session.clubId,
          branchId: session.branchId,
          status: r.status,
          checkInTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          remarks: r.remarks,
          recordedBy: operatorName,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    session.status = 'Completed';
    session.totalAttendees = records.filter(r => r.status === 'Present' || r.status === 'Late').length;

    this.logActivity(
      operatorName,
      'Attendance Recorded',
      `Recorded attendance for session ${session.groupName} (${records.length} records processed).`,
      'ATTENDANCE',
      session.clubId,
      session.branchId
    );
  }

  // Invoicing & Finance
  createInvoice(inv: Partial<Invoice>, operatorName: string): Invoice {
    const invId = generateImmutableId('INV');
    const member = this.getMemberById(inv.memberId || '');
    const items = inv.items || [];
    const subtotal = items.reduce((acc, i) => acc + i.amount, 0);
    const discount = inv.discount || 0;
    const total = Math.max(0, subtotal - discount);

    const newInvoice: Invoice = {
      id: invId,
      invoiceNumber: `INV-${new Date().getFullYear()}-${String(this.invoices.length + 1).padStart(4, '0')}`,
      clubId: inv.clubId || 'Scms-CLUB-000001',
      branchId: inv.branchId || 'Scms-CLUB-000001-B001',
      memberId: inv.memberId || '',
      memberName: member?.fullName || inv.memberName || 'Member',
      items,
      subtotal,
      discount,
      total,
      amountPaid: 0,
      balanceDue: total,
      dueDate: inv.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      issueDate: new Date().toISOString().split('T')[0],
      status: 'Pending',
      notes: inv.notes,
      createdAt: new Date().toISOString(),
    };

    this.invoices.unshift(newInvoice);

    this.logActivity(
      operatorName,
      'Invoice Generated',
      `Issued ${newInvoice.invoiceNumber} for ${newInvoice.memberName} (MYR ${newInvoice.total.toFixed(2)}).`,
      'FINANCE',
      newInvoice.clubId,
      newInvoice.branchId
    );

    return newInvoice;
  }

  recordPayment(invoiceId: string, amount: number, paymentMethod: PaymentReceipt['paymentMethod'], operatorName: string, refNo?: string): PaymentReceipt | undefined {
    const inv = this.invoices.find(i => i.id === invoiceId);
    if (!inv) return undefined;

    inv.amountPaid += amount;
    inv.balanceDue = Math.max(0, inv.total - inv.amountPaid);
    if (inv.balanceDue <= 0) {
      inv.status = 'Paid';
    } else {
      inv.status = 'Partially Paid';
    }

    const recId = generateImmutableId('REC');
    const receipt: PaymentReceipt = {
      id: recId,
      receiptNumber: `REC-${new Date().getFullYear()}-${String(this.receipts.length + 1).padStart(4, '0')}`,
      invoiceId: inv.id,
      clubId: inv.clubId,
      branchId: inv.branchId,
      memberId: inv.memberId,
      memberName: inv.memberName,
      amount,
      paymentMethod,
      referenceNo: refNo,
      paymentDate: new Date().toISOString().replace('T', ' ').substring(0, 19),
      receivedBy: operatorName,
    };

    this.receipts.unshift(receipt);

    this.logActivity(
      operatorName,
      'Payment Recorded',
      `Recorded payment of MYR ${amount.toFixed(2)} for ${inv.invoiceNumber} (Receipt: ${receipt.receiptNumber}).`,
      'FINANCE',
      inv.clubId,
      inv.branchId
    );

    return receipt;
  }

  // ========================================================
  // PARENT/GUARDIAN CONTACTS & NEW VOLUNTEER LOGIC
  // ========================================================

  getParentContacts(clubId: string): ParentContact[] {
    return this.parentContacts.filter(p => p.clubId === clubId);
  }

  addParentContact(contact: Partial<ParentContact>, operatorName: string): ParentContact {
    const id = generateImmutableId('PCON');
    const newContact: ParentContact = {
      id,
      clubId: contact.clubId || 'Scms-CLUB-000001',
      fullName: contact.fullName || '',
      contactNumber: contact.contactNumber || '',
      email: contact.email,
      isVolunteerEligible: !!contact.isVolunteerEligible,
      volunteerCommunicationConsent: !!contact.volunteerCommunicationConsent,
      volunteerConsentTimestamp: contact.volunteerCommunicationConsent ? new Date().toISOString() : undefined,
      volunteerInterests: contact.volunteerInterests || [],
      availabilityNotes: contact.availabilityNotes || '',
      isActive: true,
      createdBy: operatorName,
      updatedBy: operatorName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.parentContacts.push(newContact);
    this.saveState();
    return newContact;
  }

  updateParentContact(contactId: string, updates: Partial<ParentContact>, operatorName: string): ParentContact | undefined {
    const contact = this.parentContacts.find(c => c.id === contactId);
    if (!contact) return undefined;
    
    // Check if volunteer eligibility is being revoked
    if (contact.isVolunteerEligible && updates.isVolunteerEligible === false) {
      // Flag future assignments for administrator review
      const now = new Date().getTime();
      this.volunteerAssignmentMembers.forEach(m => {
        if (m.guardianContactId === contactId) {
          const assignment = this.newVolunteerAssignments.find(a => a.id === m.assignmentId);
          if (assignment && new Date(assignment.eventDate).getTime() > now) {
            // Flag for review instead of silently deleting
            m.notes = (m.notes ? m.notes + ' | ' : '') + 'FLAG FOR REVIEW: Volunteer opted out of assignments.';
          }
        }
      });
    }

    Object.assign(contact, updates, { updatedAt: new Date().toISOString(), updatedBy: operatorName });
    this.saveState();
    return contact;
  }

  getAthleteGuardians(athleteId: string): { relation: AthleteGuardianRelationship, contact: ParentContact }[] {
    const rels = this.athleteGuardianRelationships.filter(r => r.athleteId === athleteId);
    return rels.map(rel => {
      const contact = this.parentContacts.find(p => p.id === rel.guardianContactId);
      return { relation: rel, contact: contact! };
    }).filter(x => x.contact !== undefined);
  }

  linkAthleteGuardian(athleteId: string, guardianContactId: string, relationshipData: Partial<AthleteGuardianRelationship>): AthleteGuardianRelationship {
    const id = generateImmutableId('AGR');
    const rel: AthleteGuardianRelationship = {
      id,
      athleteId,
      guardianContactId,
      relationship: relationshipData.relationship || 'Guardian',
      relationshipDescription: relationshipData.relationshipDescription,
      isPrimaryContact: !!relationshipData.isPrimaryContact,
      isEmergencyContact: !!relationshipData.isEmergencyContact,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.athleteGuardianRelationships.push(rel);
    this.saveState();
    return rel;
  }

  getParentChildren(guardianContactId: string): Member[] {
    const rels = this.athleteGuardianRelationships.filter(r => r.guardianContactId === guardianContactId);
    const athleteIds = new Set(rels.map(r => r.athleteId));
    const parent = this.parentContacts.find(p => p.id === guardianContactId);
    
    return this.members.filter(m => {
      if (athleteIds.has(m.id)) return true;
      if (m.guardianId === guardianContactId) return true;
      if (parent && m.guardianName && m.guardianName.toLowerCase() === parent.fullName.toLowerCase()) return true;
      if (parent && parent.contactNumber && m.emergencyContactPhone === parent.contactNumber) return true;
      return false;
    });
  }

  deleteParentContact(contactId: string, operatorName: string): boolean {
    const initialLen = this.parentContacts.length;
    this.parentContacts = this.parentContacts.filter(p => p.id !== contactId);
    this.athleteGuardianRelationships = this.athleteGuardianRelationships.filter(r => r.guardianContactId !== contactId);
    
    // Clean up members referencing this guardian
    this.members.forEach(m => {
      if (m.guardianId === contactId) {
        m.guardianId = undefined;
        m.guardianName = undefined;
      }
    });

    this.saveState();
    return this.parentContacts.length < initialLen;
  }

  unlinkAthleteGuardian(athleteId: string, guardianContactId: string): boolean {
    const initialLen = this.athleteGuardianRelationships.length;
    this.athleteGuardianRelationships = this.athleteGuardianRelationships.filter(
      r => !(r.athleteId === athleteId && r.guardianContactId === guardianContactId)
    );
    this.saveState();
    return this.athleteGuardianRelationships.length < initialLen;
  }

  updateAthleteGuardianRelationship(
    relationshipId: string,
    updates: Partial<AthleteGuardianRelationship>
  ): boolean {
    const rel = this.athleteGuardianRelationships.find(r => r.id === relationshipId);
    if (!rel) return false;
    Object.assign(rel, updates, { updatedAt: new Date().toISOString() });
    this.saveState();
    return true;
  }
}

// Global Singleton Store Instance
export const store = new ScmsStore();
