import { fetchWalkingRoute } from "./osrmService.js";

export function estimateQueueMinutes(queueLength, serviceRatePerMinute, liveCrowdScore = 0) {
  const adjustedRate = Math.max(serviceRatePerMinute - liveCrowdScore * 0.05, 1);
  return Math.round(queueLength / adjustedRate);
}

function statusFor(totalMinutes) {
  if (totalMinutes <= 8) {
    return "optimal";
  }

  if (totalMinutes <= 15) {
    return "steady";
  }

  return "congested";
}

function estimateFallbackDistanceMeters(origin, target) {
  const earthRadiusKm = 6371;
  const toRadians = (value) => (value * Math.PI) / 180;
  const latDelta = toRadians(target.latitude - origin.latitude);
  const lonDelta = toRadians(target.longitude - origin.longitude);
  const lat1 = toRadians(origin.latitude);
  const lat2 = toRadians(target.latitude);

  const haversine =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(lonDelta / 2) * Math.sin(lonDelta / 2);

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)) * 1000;
}

function buildFallbackRoute(origin, gate) {
  const distanceMeters = estimateFallbackDistanceMeters(origin, gate);
  const durationSeconds = (distanceMeters / 1000 / 4.8) * 3600;

  return {
    distanceMeters,
    durationSeconds,
    routeCoordinates: [
      { latitude: origin.latitude, longitude: origin.longitude },
      { latitude: gate.latitude, longitude: gate.longitude }
    ]
  };
}

export async function buildRecommendation(origin, gates) {
  const scoredGates = await Promise.all(
    gates.map(async (gate) => {
      const route = await fetchWalkingRoute(origin, gate).catch(() => buildFallbackRoute(origin, gate));
      const walkingMinutes = Math.max(1, Math.round(route.durationSeconds / 60));
      const queueMinutes = estimateQueueMinutes(gate.queueLength, gate.serviceRatePerMinute, gate.liveCrowdScore);
      const totalMinutes = walkingMinutes + queueMinutes;

      return {
        gateId: gate.gateId,
        gateName: gate.gateName,
        latitude: gate.latitude,
        longitude: gate.longitude,
        walkingMinutes,
        walkingDistanceMeters: route.distanceMeters,
        queueMinutes,
        totalMinutes,
        queueLength: gate.queueLength,
        status: statusFor(totalMinutes),
        directionHint: gate.directionHint,
        routeCoordinates: route.routeCoordinates
      };
    })
  );

  const sorted = scoredGates.sort((left, right) => left.totalMinutes - right.totalMinutes);
  const recommendedGate = sorted[0];
  const nearestGate = [...scoredGates].sort((left, right) => left.walkingMinutes - right.walkingMinutes)[0];
  const savedMinutes = Math.max(nearestGate.totalMinutes - recommendedGate.totalMinutes, 0);

  return {
    summary: `${nearestGate.gateName} is ${nearestGate.walkingMinutes} minutes away but has a ${nearestGate.queueMinutes} minute wait. ${recommendedGate.gateName} is a ${recommendedGate.walkingMinutes} minute walk with a ${recommendedGate.queueMinutes} minute wait. Proceed to ${recommendedGate.gateName} to save ${savedMinutes} minutes.`,
    savedMinutes,
    recommendedGate,
    alternatives: sorted.slice(1)
  };
}
