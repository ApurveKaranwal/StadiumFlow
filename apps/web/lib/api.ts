import type {
  CrowdReport,
  LiveCrowdState,
  FeedUpdate,
  GateRecord,
  RecommendationPayload,
  UserRewardProfile
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";

async function request(input: RequestInfo | URL, init?: RequestInit) {
  try {
    return await fetch(input, init);
  } catch {
    throw new Error(`API unreachable at ${API_BASE_URL}. Make sure the backend is running.`);
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(errorBody?.message ?? "Request failed.");
  }

  return (await response.json()) as T;
}

export async function fetchRecommendation(latitude: number, longitude: number): Promise<RecommendationPayload> {
  const response = await request(`${API_BASE_URL}/gates/recommendation?latitude=${latitude}&longitude=${longitude}`, {
    cache: "no-store"
  });

  return parseJson<RecommendationPayload>(response);
}

export async function fetchGates(): Promise<GateRecord[]> {
  const response = await request(`${API_BASE_URL}/gates`, {
    cache: "no-store"
  });

  const data = await parseJson<{ gates: GateRecord[] }>(response);
  return data.gates;
}

export async function createGate(input: Omit<GateRecord, "id">): Promise<GateRecord> {
  const response = await request(`${API_BASE_URL}/gates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  return parseJson<GateRecord>(response);
}

export async function updateGate(gateId: string, input: Omit<GateRecord, "id" | "gateId"> & { gateName: string }): Promise<GateRecord> {
  const response = await request(`${API_BASE_URL}/gates/${gateId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  return parseJson<GateRecord>(response);
}

export async function fetchUpdates(authorType?: "fan" | "organizer"): Promise<FeedUpdate[]> {
  const query = authorType ? `?authorType=${authorType}` : "";
  const response = await request(`${API_BASE_URL}/updates${query}`, { cache: "no-store" });
  const data = await parseJson<{ updates: FeedUpdate[] }>(response);
  return data.updates;
}

export async function createUpdate(input: {
  authorType: "fan" | "organizer";
  authorName: string;
  message: string;
  priority: "normal" | "important";
  context: "operations" | "match" | "food" | "entry";
}): Promise<FeedUpdate> {
  const response = await request(`${API_BASE_URL}/updates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  return parseJson<FeedUpdate>(response);
}

export async function fetchRewardProfile(fanName: string): Promise<UserRewardProfile> {
  const response = await request(`${API_BASE_URL}/rewards/profile?fanName=${encodeURIComponent(fanName)}`, {
    cache: "no-store"
  });

  return parseJson<UserRewardProfile>(response);
}

export async function fetchLiveCrowdState(): Promise<LiveCrowdState> {
  const response = await request(`${API_BASE_URL}/reports/live`, {
    cache: "no-store"
  });

  return parseJson<LiveCrowdState>(response);
}

export async function fetchCrowdReports(latitude?: number, longitude?: number): Promise<CrowdReport[]> {
  const query =
    Number.isFinite(latitude) && Number.isFinite(longitude)
      ? `?latitude=${latitude}&longitude=${longitude}`
      : "";
  const response = await request(`${API_BASE_URL}/reports${query}`, {
    cache: "no-store"
  });

  const data = await parseJson<{ reports: CrowdReport[] }>(response);
  return data.reports;
}

export async function submitCrowdReport(input: {
  gateId: string;
  fanName: string;
  message: string;
  crowdLevel: CrowdReport["crowdLevel"];
  latitude: number;
  longitude: number;
}): Promise<CrowdReport> {
  const response = await request(`${API_BASE_URL}/reports`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  return parseJson<CrowdReport>(response);
}

export async function verifyCrowdReport(input: {
  reportId: string;
  fanName: string;
  latitude: number;
  longitude: number;
}): Promise<CrowdReport> {
  const response = await request(`${API_BASE_URL}/reports/${input.reportId}/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fanName: input.fanName,
      latitude: input.latitude,
      longitude: input.longitude
    })
  });

  return parseJson<CrowdReport>(response);
}

export async function awardDetourPoints(input: {
  fanName: string;
  gateName: string;
  matchId: string;
}): Promise<UserRewardProfile> {
  const response = await request(`${API_BASE_URL}/rewards/detour-points`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  const data = await parseJson<{ profile: UserRewardProfile }>(response);
  return data.profile;
}

export async function redeemFoodDiscount(input: { fanName: string }): Promise<UserRewardProfile> {
  const response = await request(`${API_BASE_URL}/rewards/redeem-food`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  const data = await parseJson<{ profile: UserRewardProfile }>(response);
  return data.profile;
}
