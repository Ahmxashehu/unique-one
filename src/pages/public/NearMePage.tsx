import React, { useCallback, useMemo, useState } from "react";
import { AlertCircle, ExternalLink, LocateFixed, LoaderCircle, MapPin, Navigation, Search, Star } from "lucide-react";

type Place = {
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
};

type SearchResponse = {
  ok: boolean;
  code?: string;
  configured?: boolean;
  message?: string;
  count?: number;
  places?: Place[];
};

type Coordinates = { latitude: number; longitude: number };

function mapEmbedUrl(point: Coordinates) {
  const delta = 0.018;
  const bbox = [
    point.longitude - delta,
    point.latitude - delta,
    point.longitude + delta,
    point.latitude + delta,
  ].join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${point.latitude}%2C${point.longitude}`;
}

export default function NearMePage() {
  const [query, setQuery] = useState("businesses and services");
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("Allow location access to prioritize nearby results, or search by business/service name.");

  const selectedPlace = useMemo(
    () => places.find((place) => place.id === selectedId) ?? places.find((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude)),
    [places, selectedId],
  );
  const mapPoint = selectedPlace?.latitude != null && selectedPlace.longitude != null
    ? { latitude: selectedPlace.latitude, longitude: selectedPlace.longitude }
    : location;

  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("This device or browser does not support location access. You can still search by service name.");
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setNotice("Location found. Search to prioritize places near you.");
        setLocating(false);
      },
      (geoError) => {
        const message = geoError.code === geoError.PERMISSION_DENIED
          ? "Location permission was denied. Enable location permission for UniquePlatform in your device settings, or search without it."
          : geoError.code === geoError.TIMEOUT
            ? "Location lookup timed out. Try again or search by service name."
            : "Your location could not be determined. Check device location settings and try again.";
        setError(message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  }, []);

  const searchPlaces = useCallback(async (event?: React.FormEvent) => {
    event?.preventDefault();
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      setError("Enter a business or service to search for.");
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const params = new URLSearchParams({ q: normalizedQuery });
      if (location) {
        params.set("lat", String(location.latitude));
        params.set("lng", String(location.longitude));
      }
      const response = await fetch(`/api/places/search?${params.toString()}`, {
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => null) as SearchResponse | null;
      if (!response.ok || !payload?.ok) {
        setPlaces([]);
        setSelectedId(null);
        setError(payload?.message || "The places search is temporarily unavailable.");
        return;
      }
      const found = Array.isArray(payload.places) ? payload.places : [];
      setPlaces(found);
      setSelectedId(found[0]?.id ?? null);
      setNotice(found.length
        ? `Showing ${found.length} verified place result${found.length === 1 ? "" : "s"} from Google Places.`
        : "No matching places were returned. Try a more specific search or a wider service name.");
    } catch {
      setPlaces([]);
      setSelectedId(null);
      setError("Could not reach the places service. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [location, query]);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <MapPin className="h-4 w-4" /> UNIQUEPLATFORM DISCOVERY
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Near Me</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">Find real businesses and services using live place search. Location is optional and is only used to bias your search.</p>
        </div>
        <button type="button" onClick={getCurrentLocation} disabled={locating} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60">
          {locating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
          {locating ? "Finding location…" : location ? "Refresh location" : "Use current location"}
        </button>
      </div>

      <form onSubmit={searchPlaces} className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row">
        <div className="flex min-w-0 flex-1 items-center gap-3 px-2">
          <Search className="h-5 w-5 shrink-0 text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search businesses and services" placeholder="Search restaurants, pharmacies, shops…" maxLength={160} className="min-h-10 w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400" />
        </div>
        <button type="submit" disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60">
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {loading ? "Searching…" : "Search places"}
        </button>
      </form>

      {error && <div role="alert" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><p>{error}</p></div>}
      {notice && !error && <p aria-live="polite" className="text-sm text-slate-500">{notice}</p>}

      <div className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <section className="flex min-h-[280px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          {mapPoint ? (
            <>
              <iframe title="Map of selected place or current location" src={mapEmbedUrl(mapPoint)} className="min-h-[320px] w-full flex-1 border-0" loading="lazy" referrerPolicy="no-referrer" />
              <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
                <span>{selectedPlace ? selectedPlace.name : "Your current location"}</span>
                <a href={`https://www.openstreetmap.org/?mlat=${mapPoint.latitude}&mlon=${mapPoint.longitude}#map=15/${mapPoint.latitude}/${mapPoint.longitude}`} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 font-semibold text-emerald-700 hover:underline">Open map <ExternalLink className="h-3.5 w-3.5" /></a>
              </div>
            </>
          ) : (
            <div className="flex min-h-[320px] flex-1 flex-col items-center justify-center px-6 py-10 text-center">
              <MapPin className="mb-3 h-10 w-10 text-slate-400" />
              <h2 className="font-semibold text-slate-800">Map ready when a location is available</h2>
              <p className="mt-2 max-w-sm text-sm text-slate-500">Use current location or search for a place. The map will focus on a real coordinate returned by your device or the places provider.</p>
              <button type="button" onClick={getCurrentLocation} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"><Navigation className="h-4 w-4" /> Find my location</button>
            </div>
          )}
        </section>

        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900">Place results</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{places.length} found</span>
          </div>
          {places.length ? (
            <div className="space-y-3">
              {places.map((place) => (
                <div key={place.id} className={`rounded-2xl border p-4 transition ${selectedId === place.id ? "border-emerald-600 bg-emerald-50/60 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                  <button type="button" onClick={() => setSelectedId(place.id)} aria-pressed={selectedId === place.id} className="block w-full text-left">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-900">{place.name}</h3>
                        {place.address && <p className="mt-1 text-sm text-slate-600">{place.address}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          {typeof place.rating === "number" && <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" /> {place.rating.toFixed(1)}{typeof place.ratingCount === "number" ? ` (${place.ratingCount.toLocaleString()})` : ""}</span>}
                          {place.businessStatus && <span>{place.businessStatus.replaceAll("_", " ").toLowerCase()}</span>}
                        </div>
                      </div>
                      <MapPin className={`mt-1 h-5 w-5 shrink-0 ${selectedId === place.id ? "text-emerald-700" : "text-slate-400"}`} />
                    </div>
                  </button>
                  {place.mapsUrl && <a href={place.mapsUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline">Open in Google Maps <ExternalLink className="h-3.5 w-3.5" /></a>}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
              <Search className="mx-auto h-8 w-8 text-slate-400" />
              <h3 className="mt-3 font-semibold text-slate-800">Search for a real place</h3>
              <p className="mt-1 text-sm text-slate-500">Search results will appear here when the Places API is configured and returns matching businesses.</p>
            </div>
          )}
        </section>
      </div>
      <p className="text-xs text-slate-400">Place data by Google Places. Map tiles and map display by OpenStreetMap contributors. Results are provider-supplied, not sample listings.</p>
    </div>
  );
}
