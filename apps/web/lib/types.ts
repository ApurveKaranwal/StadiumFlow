export type GateStatus = "optimal" | "steady" | "congested";

export type MapCoordinate = {
  latitude: number;
  longitude: number;
};

export type GateRecord = {
  id: string;
  gateId: string;
  gateName: string;
  displayOrder: number;
  visible: boolean;
  zoneLabel: string;
  latitude: number;
  longitude: number;
  serviceRatePerMinute: number;
  queueLength: number;
  liveCrowdScore: number;
  directionHint: string;
};

export type CrowdLevel = "low" | "medium" | "high" | "critical";

export type CrowdReport = {
  id: string;
  gateId: string;
  authorName: string;
  message: string;
  crowdLevel: CrowdLevel;
  latitude: number;
  longitude: number;
  status: "pending" | "verified";
  verificationCount: number;
  createdAt: string;
  verifiedAt: string | null;
};

export type GateLiveSummary = {
  gateId: string;
  pendingReports: number;
  verifiedReports: number;
  lastReportAt: string | null;
  queueLength: number;
  liveCrowdScore: number;
};

export type CrowdSnapshot = {
  reportId: string;
  gateId: string;
  crowdLevel: CrowdLevel;
  message: string;
  latitude: number;
  longitude: number;
  status: "pending" | "verified";
  verificationCount: number;
};

export type LiveCrowdState = {
  activeReports: CrowdReport[];
  activeSnapshots: CrowdSnapshot[];
  gateSummaries: GateLiveSummary[];
};

export type GateMapView = {
  gateId: string;
  gateName: string;
  latitude: number;
  longitude: number;
  pendingReports?: number;
  verifiedReports?: number;
  liveCrowdScore?: number;
  walkingMinutes?: number;
  queueMinutes?: number;
  totalMinutes?: number;
  status?: GateStatus;
  routeCoordinates?: MapCoordinate[];
};

export type GateRecommendation = {
  gateId: string;
  gateName: string;
  latitude: number;
  longitude: number;
  walkingMinutes: number;
  walkingDistanceMeters: number;
  queueMinutes: number;
  totalMinutes: number;
  queueLength: number;
  status: GateStatus;
  directionHint: string;
  routeCoordinates: MapCoordinate[];
};

export type RoutingResponse = {
  summary: string;
  savedMinutes: number;
  recommendedGate: GateRecommendation;
  alternatives: GateRecommendation[];
};

export type FeedUpdate = {
  id: string;
  authorType: "fan" | "organizer";
  authorName: string;
  message: string;
  createdAt: string;
  priority: "normal" | "important";
  context: "operations" | "match" | "food" | "entry";
};

export type UserRewardProfile = {
  fanName: string;
  points: number;
  completedDetours: number;
  reportReputation: number;
  liveReportsSubmitted: number;
  liveReportsVerified: number;
  availableDiscounts: number;
  nextDiscountAt: number;
};

export type RecommendationPayload = {
  matchId: string;
  userLocation: MapCoordinate;
  routing: RoutingResponse;
  needsConsentForLongerWalk: boolean;
  detourIncentive: {
    points: number;
    foodDiscountPercent: number;
    temporaryStreamAccess: boolean;
  };
};
