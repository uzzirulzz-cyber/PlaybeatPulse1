// LeadPulse — OpenStreetMap Overpass API client (REAL public business data)
// Queries OSM POIs (points of interest) for businesses: shops, amenities, offices.
// Free, no API key, rate-limited by the public endpoints.
import type { LocationFilters, BusinessFilters } from "./types";

export interface DiscoveredBusiness {
  osmId: string;
  osmType: "node" | "way" | "relation";
  name: string;
  category: string;   // primary category (shop, amenity, office, tourism, craft...)
  subcategory: string; // e.g. restaurant, bakery, it
  website?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  lat?: number;
  lng?: number;
  socialProfiles?: Record<string, string>;
  employeeCount?: number;
  sourceName: string;
  sourceUrl: string;
  raw: Record<string, string>;
}

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
];

// Map of common business-nature keywords to OSM tag groups.
// Users type free-text "nature" (e.g. "restaurant", "software company", "dentist");
// we map that to OSM tags so the query stays small and relevant.
const NATURE_TO_TAGS: { match: RegExp; tags: string[] }[] = [
  { match: /restaurant|cafe|food|dining|eatery|bar|pub/i, tags: ['amenity="restaurant"', 'amenity="cafe"', 'amenity="fast_food"', 'amenity="bar"', 'amenity="pub"', 'amenity="biergarten"', 'amenity="food_court"'] },
  { match: /hotel|guesthouse|accommodation|lodging|motel|hostel/i, tags: ['tourism="hotel"', 'tourism="guest_house"', 'tourism="motel"', 'tourism="hostel"', 'tourism="apartment"', 'tourism="resort"'] },
  { match: /software|it|tech|computer|developer|agency|digital/i, tags: ['office="it"', 'office="company"', 'office="software"', 'office="advertising_agency"', 'office="marketing"', 'craft="electronics_repair"'] },
  { match: /dentist|doctor|clinic|medical|health|hospital|pharmacy/i, tags: ['amenity="dentist"', 'amenity="doctors"', 'amenity="clinic"', 'amenity="hospital"', 'amenity="pharmacy"', 'healthcare="clinic"', 'healthcare="doctor"', 'healthcare="dentist"'] },
  { match: /lawyer|attorney|legal|law firm|solicitor/i, tags: ['office="lawyer"', 'office="notary"'] },
  { match: /bank|finance|insurance|accountant|tax/i, tags: ['amenity="bank"', 'office="financial"', 'office="insurance"', 'office="accountant"', 'office="tax_advisor"'] },
  { match: /beauty|salon|spa|hair|barber|nail/i, tags: ['shop="hairdresser"', 'shop="beauty"', 'leisure="spa"', 'amenity="barber"'] },
  { match: /gym|fitness|sport|yoga/i, tags: ['leisure="fitness_centre"', 'leisure="sports_centre"', 'sport="yoga"'] },
  { match: /school|academy|training|education|institute|university/i, tags: ['amenity="school"', 'amenity="college"', 'amenity="university"', 'amenity="language_school"', 'amenity="driving_school"', 'office="educational_institution"'] },
  { match: /automotive|car|auto|mechanic|garage|tyre|tire/i, tags: ['shop="car"', 'shop="car_repair"', 'shop="tyres"', 'shop="motorcycle_repair"', 'amenity="fuel"', 'amenity="car_wash"'] },
  { match: /real ?estate|property|realtor|broker/i, tags: ['office="estate_agent"', 'office="real_estate_agent"'] },
  { match: /bakery|grocery|supermarket|grocer|convenience/i, tags: ['shop="bakery"', 'shop="supermarket"', 'shop="convenience"', 'shop="grocery"', 'shop="greengrocer"'] },
  { match: /clothing|fashion|apparel|boutique|shoes/i, tags: ['shop="clothes"', 'shop="fashion"', 'shop="shoes"', 'shop="boutique"'] },
  { match: /furniture|home|interior|decor/i, tags: ['shop="furniture"', 'shop="interior_decoration"', 'shop="houseware"'] },
  { match: /electronics|mobile|phone|gadget/i, tags: ['shop="electronics"', 'shop="mobile_phone"', 'shop="computer"'] },
  { match: /jewel|gold|gem/i, tags: ['shop="jewelry"'] },
  { match: /construction|builder|contractor|architect|engineer/i, tags: ['office="architect"', 'office="engineer"', 'craft="plumber"', 'craft="electrician"', 'craft="carpenter"', 'craft="painter"', 'building="construction"'] },
  { match: /photographer|photography|studio/i, tags: ['craft="photographer"', 'shop="photo"', 'amenity="studio"'] },
  { match: /travel|tour|agency|tourism/i, tags: ['office="travel_agent"', 'tourism="information"'] },
  { match: /florist|flower/i, tags: ['shop="florist"'] },
  { match: /pet|vet|veterinary|animal/i, tags: ['shop="pet"', 'amenity="veterinary"'] },
  { match: /laundry|dry ?clean/i, tags: ['shop="laundry"', 'shop="dry_cleaning"'] },
  { match: /catering|caterer/i, tags: ['amenity="catering"', 'shop="caterer"'] },
];

// Generic fallback tags — used when no specific nature match so we still get
// a broad set of businesses (shops + amenities) in the target area.
const GENERIC_TAGS = [
  'shop',
  'amenity',
  'office',
  'tourism',
  'craft',
  'leisure',
  'healthcare',
];

export function tagsForNature(nature?: string): { tags: string[]; specific: boolean } {
  if (!nature) return { tags: GENERIC_TAGS, specific: false };
  for (const entry of NATURE_TO_TAGS) {
    if (entry.match.test(nature)) {
      // Only use the FIRST (most specific) tag to keep Overpass queries small.
      // Large multi-tag queries on big cities timeout/rate-limit on public endpoints.
      return { tags: [entry.tags[0]], specific: true };
    }
  }
  return { tags: GENERIC_TAGS, specific: false };
}

// Get ALL tags for a nature (used for category labeling, not for querying)
export function allTagsForNature(nature?: string): string[] {
  if (!nature) return GENERIC_TAGS;
  for (const entry of NATURE_TO_TAGS) {
    if (entry.match.test(nature)) return entry.tags;
  }
  return GENERIC_TAGS;
}

// Build an Overpass QL query. We use an around-area filter by city name OR
// coordinates+radius. Nominatim resolves city -> bbox first (caller does that).
export interface OverpassQueryInput {
  bbox?: [south: number, west: number, north: number, east: number]; // bounding box
  around?: { lat: number; lng: number; radius: number }; // radius in meters
  areaName?: string; // OSM area name (e.g. "Berlin") — no geocoding needed
  tags: string[];
  limit?: number;
}

export function buildOverpassQuery(input: OverpassQueryInput): string {
  let areaFilter = "";
  let areaSetup = "";

  if (input.areaName) {
    // Use Overpass's built-in area lookup by name (no geocoding required)
    areaSetup = `area["name"="${input.areaName}"]->.searchArea;`;
    areaFilter = "(area.searchArea)";
  } else if (input.bbox) {
    areaFilter = `${input.bbox[0]},${input.bbox[1]},${input.bbox[2]},${input.bbox[3]}`;
  } else if (input.around) {
    areaFilter = `(around:${input.around.radius},${input.around.lat},${input.around.lng})`;
  }

  const parts: string[] = [];
  for (const tag of input.tags) {
    if (tag.includes("=")) {
      const [k, vRaw] = tag.split("=");
      const v = vRaw.replace(/"/g, "");
      // Nodes only for speed — ways are slower and the Vercel 10s function limit
      // can't accommodate both. Nodes cover the vast majority of business POIs.
      parts.push(`node["${k}"="${v}"]${areaFilter};`);
    } else {
      // bare key presence
      parts.push(`node["${tag}"]${areaFilter};`);
    }
  }
  const limit = input.limit ? `\nout center ${input.limit};` : "\nout center 500;";
  return `[out:json][timeout:12];${areaSetup}(${parts.join("")});${limit}`;
}

// Run the query against Overpass with failover between endpoints.
// Tries at most `maxEndpoints` endpoints (default 2) within the total timeout.
export async function runOverpassQuery(
  query: string,
  opts: { timeoutMs?: number; signal?: AbortSignal; maxEndpoints?: number } = {}
): Promise<any[]> {
  const timeoutMs = opts.timeoutMs ?? 8000;
  const maxEndpoints = opts.maxEndpoints ?? 2;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Chain external signal abort
  if (opts.signal) {
    opts.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  let lastError: Error | null = null;
  try {
    const endpointsToTry = OVERPASS_ENDPOINTS.slice(0, maxEndpoints);
    for (let i = 0; i < endpointsToTry.length; i++) {
      const endpoint = endpointsToTry[i];
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "LeadPulseBot/1.0 (+https://leadpulse.app/bot)",
          },
          body: "data=" + encodeURIComponent(query),
          signal: controller.signal,
        });
        if (res.status === 429) {
          lastError = new Error("SOURCE_RATE_LIMITED");
          continue;
        }
        if (!res.ok) {
          lastError = new Error(`Overpass HTTP ${res.status}`);
          continue;
        }
        const json = await res.json();
        return json.elements || [];
      } catch (e: any) {
        lastError = e;
        continue;
      }
    }
    throw lastError || new Error("PROVIDER_ERROR");
  } finally {
    clearTimeout(timer);
  }
}

// Convert raw Overpass element -> DiscoveredBusiness
export function elementToBusiness(el: any, defaultCountry?: string): DiscoveredBusiness | null {
  const tags = el.tags || {};
  const name = tags.name || tags["name:en"] || tags.brand;
  if (!name) return null; // skip unnamed POIs

  const osmType = el.type;
  const osmId = `${osmType}/${el.id}`;

  // Determine category/subcategory from tags
  let category = "";
  let subcategory = "";
  const categoryKeys = ["shop", "amenity", "office", "tourism", "craft", "leisure", "healthcare"];
  for (const k of categoryKeys) {
    if (tags[k]) {
      category = k;
      subcategory = tags[k];
      break;
    }
  }

  const website = tags.website || tags["contact:website"] || tags.url || tags["website:en"];
  const phone = tags.phone || tags["contact:phone"] || tags["phone:mobile"] || tags["contact:mobile"];
  const email = tags.email || tags["contact:email"];
  const whatsapp = tags["contact:whatsapp"] || tags.whatsapp;

  // Address assembly
  const housenumber = tags["addr:housenumber"] || "";
  const street = tags["addr:street"] || "";
  const address = [housenumber, street].filter(Boolean).join(" ").trim() || undefined;
  const city = tags["addr:city"] || tags["addr:town"] || tags["addr:village"] || tags["addr:hamlet"] || undefined;
  const state = tags["addr:state"] || undefined;
  const postalCode = tags["addr:postcode"] || undefined;
  const country = tags["addr:country"] ? tags["addr:country"].toUpperCase() : defaultCountry;

  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;

  // Social
  const socialProfiles: Record<string, string> = {};
  if (tags["contact:facebook"]) socialProfiles.facebook = tags["contact:facebook"];
  if (tags["contact:instagram"]) socialProfiles.instagram = tags["contact:instagram"];
  if (tags["contact:linkedin"]) socialProfiles.linkedin = tags["contact:linkedin"];
  if (tags["contact:twitter"]) socialProfiles.twitter = tags["contact:twitter"];
  if (tags["contact:youtube"]) socialProfiles.youtube = tags["contact:youtube"];

  return {
    osmId,
    osmType,
    name,
    category: category || "business",
    subcategory: subcategory || "other",
    website: website || undefined,
    phone: phone || undefined,
    email: email || undefined,
    whatsapp: whatsapp || undefined,
    address,
    city,
    state,
    country,
    postalCode,
    lat,
    lng,
    socialProfiles: Object.keys(socialProfiles).length ? socialProfiles : undefined,
    sourceName: "OpenStreetMap",
    sourceUrl: `https://www.openstreetmap.org/${osmType === "node" ? "node" : osmType === "way" ? "way" : "relation"}/${el.id}`,
    raw: tags,
  };
}

// ---------------------------------------------------------------------------
// Nominatim geocoding (resolve city name -> bounding box or center+radius)
// ---------------------------------------------------------------------------

export interface GeocodedArea {
  displayName: string;
  lat: number;
  lng: number;
  boundingBox: [south: number, north: number, west: number, east: number];
  countryCode?: string;
  country?: string;
  state?: string;
  city?: string;
}

export async function geocodeLocation(filters: LocationFilters): Promise<GeocodedArea | null> {
  const parts: string[] = [];
  if (filters.area) parts.push(filters.area);
  if (filters.city) parts.push(filters.city);
  if (filters.state) parts.push(filters.state);
  if (filters.country) parts.push(filters.country);
  if (filters.postal) parts.push(filters.postal);
  if (parts.length === 0) return null;

  const q = parts.join(", ");
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&addressdetails=1`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "LeadPulseBot/1.0 (lead-generation-platform)",
        "Accept-Language": "en",
      },
    });
    if (!res.ok) return null;
    const arr = await res.json();
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const r = arr[0];
    const bb = r.boundingbox ? r.boundingbox.map(Number) : null;
    const area: GeocodedArea = {
      displayName: r.display_name,
      lat: Number(r.lat),
      lng: Number(r.lon),
      boundingBox: bb ? [bb[0], bb[1], bb[2], bb[3]] : [Number(r.lat) - 0.05, Number(r.lat) + 0.05, Number(r.lon) - 0.05, Number(r.lon) + 0.05],
      countryCode: r.address?.country_code?.toUpperCase(),
      country: r.address?.country,
      state: r.address?.state,
      city: r.address?.city || r.address?.town || r.address?.village || filters.city,
    };
    return area;
  } catch {
    return null;
  }
}

// Generate search-query variations for "deep search" mode
export function generateQueryVariations(business: BusinessFilters, location: LocationFilters): string[] {
  const terms: string[] = [];
  const nature = business.nature || business.industry || business.category || "";
  const city = location.city || location.area || "";
  const country = location.country || "";

  if (nature) {
    if (city) terms.push(`${nature} ${city}`);
    if (country) terms.push(`${nature} ${country}`);
    if (city && country) terms.push(`${nature} ${city} ${country}`);
  }
  if (business.keywords?.length) {
    for (const kw of business.keywords) {
      if (city) terms.push(`${kw} ${city}`);
      if (country) terms.push(`${kw} ${country}`);
    }
  }
  // De-dup, preserve order
  return Array.from(new Set(terms));
}
