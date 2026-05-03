const OSRM_BASE_URL = "https://router.project-osrm.org";

export async function fetchWalkingRoute(origin, destination) {
  const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const url = `${OSRM_BASE_URL}/route/v1/foot/${coordinates}?overview=full&geometries=geojson&steps=false`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`OSRM request failed with status ${response.status}.`);
  }

  const data = await response.json();

  if (data.code !== "Ok" || !data.routes?.[0]) {
    throw new Error("OSRM did not return a valid walking route.");
  }

  const route = data.routes[0];

  return {
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    routeCoordinates: route.geometry.coordinates.map(([longitude, latitude]) => ({
      latitude,
      longitude
    }))
  };
}
