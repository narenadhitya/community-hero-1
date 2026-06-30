export interface User {
  id: string;
  name: string;
  avatarConfig: string; // JSON string representing avatar selections
  trustScore: number;
  level: number;
  xp: number;
  badges: string[];
  titles: string[];
  neighborhoodIds: string[];
  joinedAt: string;
  attendedEvents?: string[];
  role?: 'citizen' | 'worker';
  departmentId?: string;
}

export interface Neighborhood {
  id: string;
  name: string;
  boundaryCenter: {
    lat: number;
    lng: number;
  };
  healthScores: {
    infrastructure: number;
    cleanliness: number;
    safety: number;
    lighting: number;
    water: number;
    green: number;
    accessibility: number;
    engagement: number;
  };
  communityXP: number;
  communityLevel: number;
}

export type IssueStatus = 'pending' | 'verifying' | 'routed' | 'in_progress' | 'resolved' | 'disputed' | 'verifying_fix';
export type IssueType = 'pothole' | 'broken_streetlight' | 'water_leak' | 'waste_problem' | 'other';
export type IssuePriority = 'low' | 'medium' | 'high' | 'critical';

export interface Issue {
  id: string;
  reporterId: string;
  reporterName?: string;
  reporterTrustScore?: number;
  status: IssueStatus;
  type: IssueType;
  severity: number; // 0-1
  title: string;
  description: string;
  location: {
    lat: number;
    lng: number;
    geohash?: string;
  };
  neighborhoodId: string;
  departmentId: string;
  priority: IssuePriority;
  mediaUrl: string;
  reportedAt: string;
  resolvedAt: string | null;
  slaDeadline?: string;
  routingExplanation?: string;
  confirmCount?: number;
  rejectCount?: number;
  confirmedByUserIds?: string[];
  rejectedByUserIds?: string[];
  verificationPhotos?: string[];
  beforePhoto?: string;
  duringPhoto?: string;
  afterPhoto?: string;
  fixVerificationConfirms?: number;
  fixVerificationRejects?: number;
  fixConfirmedByUserIds?: string[];
  fixRejectedByUserIds?: string[];
  isEscalated?: boolean;
  predictiveInsight?: {
    riskScore: number;
    relatedIssueIds: string[];
    explanation: string;
  };
}

export interface Department {
  id: string;
  name: string;
  accountabilityScore: number;
  avgResponseHours: number;
  resolutionRate: number;
}
