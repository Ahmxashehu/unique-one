export type GooglePlaceSearchLocation = {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
};

export type GooglePlaceResult = {
  type: "google_place";
  id: string;
  name: string;
  address?: string;
  rating?: number;
  ratingCount?: number;
  businessStatus?: string;
  latitude?: number;
  longitude?: number;
  mapsUrl?: string;
  source: "google_places";
  score: number;
};

const GOOGLE_PLACES_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const DEFAULT_RADIUS_METERS = 5_000;
const MAX_RESULTS = 8;

function validCoordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

export async function searchGooglePlaces(
  query: string,
  location?: GooglePlaceSearchLocation,
): Promise<GooglePlaceResult[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey || !query.trim()) return [];

  if (location && (!validCoordinate(location.latitude, -90, 90) || !validCoordinate(location.longitude, -180, 180))) {
    return [];
  }

  const body: Record<string, unknown> = {
    textQuery: query.trim().slice(0, 400),
    languageCode: "en",
    maxResultCount: MAX_RESULTS,
  };

  if (location) {
    body.locationBias = {
      circle: {
        center: { latitude: location.latitude, longitude: location.longitude },
        radius: Math.min(DEFAULT_RADIUS_METERS, Math.max(100, location.radiusMeters ?? DEFAULT_RADIUS_METERS)),
      },
    };
  }

  const response = await fetch(GOOGLE_PLACES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.rating",
        "places.userRatingCount",
        "places.businessStatus",
        "places.googleMapsUri",
      ].join(","),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Google Places request failed (${response.status})${detail ? `: ${detail.slice(0, 180)}` : "."}`);
  }

  const payload = (await response.json()) as {
    places?: Array<{
      id?: unknown;
      displayName?: { text?: unknown };
      formattedAddress?: unknown;
      location?: { latitude?: unknown; longitude?: unknown };
      rating?: unknown;
      userRatingCount?: unknown;
      businessStatus?: unknown;
      googleMapsUri?: unknown;
    }>;
  };

  if (!Array.isArray(payload.places)) return [];

  return payload.places.flatMap((place, index) => {
    const id = typeof place.id === "string" ? place.id : "";
    const name = typeof place.displayName?.text === "string" ? place.displayName.text.trim() : "";
    if (!id || !name) return [];
    return [{
      type: "google_place" as const,
      id,
      name,
      address: typeof place.formattedAddress === "string" ? place.formattedAddress : undefined,
      rating: typeof place.rating === "number" && Number.isFinite(place.rating) ? place.rating : undefined,
      ratingCount: typeof place.userRatingCount === "number" && Number.isSafeInteger(place.userRatingCount) ? place.userRatingCount : undefined,
      businessStatus: typeof place.businessStatus === "string" ? place.businessStatus : undefined,
      latitude: typeof place.location?.latitude === "number" ? place.location.latitude : undefined,
      longitude: typeof place.location?.longitude === "number" ? place.location.longitude : undefined,
      mapsUrl: typeof place.googleMapsUri === "string" ? place.googleMapsUri : undefined,
      source: "google_places" as const,
      score: 1 - index / Math.max(1, payload.places.length),
    }];
  });
}
