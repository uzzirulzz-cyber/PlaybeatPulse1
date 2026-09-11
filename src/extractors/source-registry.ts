// PlayBeat — Complete Source Registry
// Registers all 80+ API sources from the catalog in the database.
// Free sources (no auth) are marked "active"; API-key sources are marked
// "not_configured" until their env var is set.

export interface SourceConfig {
  name: string;
  type: string; // overpass | nominatim | website | websearch | directory | api | enrichment | validator | geocoding
  category: string; // Business | Email | Phone | Geocoding | Open Data | Jobs | Shopping | Social | Discovery
  purpose: string; // DISCOVERY | CONTACT | ENRICHMENT | VALIDATION | LOCATION
  endpoint: string;
  auth: "none" | "apiKey" | "OAuth";
  envVar?: string; // env var name for API key (if auth=apiKey)
  priority: number;
  dailyLimit: number;
  perMinute: number;
  freeTier: boolean;
  countries: string; // "worldwide" | "US" | "UK" | etc
  enabled: boolean;
  status: string; // active | not_configured | disabled
}

export const ALL_SOURCES: SourceConfig[] = [
  // === Tier 1: Free/Open Sources (always active) ===
  { name: "OpenStreetMap Overpass", type: "overpass", category: "Open Data", purpose: "DISCOVERY+LOCATION", endpoint: "https://overpass-api.de/api/interpreter", auth: "none", priority: 10, dailyLimit: 10000, perMinute: 30, freeTier: true, countries: "worldwide", enabled: true, status: "active" },
  { name: "Nominatim Geocoder", type: "nominatim", category: "Geocoding", purpose: "LOCATION", endpoint: "https://nominatim.openstreetmap.org", auth: "none", priority: 20, dailyLimit: 1000, perMinute: 15, freeTier: true, countries: "worldwide", enabled: true, status: "active" },
  { name: "Website Contact Analyzer", type: "website", category: "Business", purpose: "CONTACT+ENRICHMENT", endpoint: "internal", auth: "none", priority: 30, dailyLimit: 1500, perMinute: 30, freeTier: true, countries: "worldwide", enabled: true, status: "active" },
  { name: "Web Search (z-ai)", type: "websearch", category: "Discovery", purpose: "DISCOVERY", endpoint: "internal", auth: "none", priority: 40, dailyLimit: 200, perMinute: 10, freeTier: true, countries: "worldwide", enabled: true, status: "active" },
  { name: "REHAB Bangladesh Directory", type: "directory", category: "Business", purpose: "DISCOVERY", endpoint: "https://www.rehab-bd.org/members", auth: "none", priority: 50, dailyLimit: 500, perMinute: 10, freeTier: true, countries: "Bangladesh", enabled: true, status: "active" },
  { name: "Zameen.com Agent Directory", type: "directory", category: "Business", purpose: "DISCOVERY", endpoint: "https://www.zameen.com/agents/", auth: "none", priority: 51, dailyLimit: 500, perMinute: 10, freeTier: true, countries: "Pakistan", enabled: true, status: "active" },
  { name: "DLD/Bayut Broker Directory", type: "directory", category: "Business", purpose: "DISCOVERY", endpoint: "https://www.bayut.com/brokers/", auth: "none", priority: 52, dailyLimit: 500, perMinute: 10, freeTier: true, countries: "UAE", enabled: true, status: "active" },

  // === Free Discovery APIs (no auth) ===
  { name: "Domainsdb.info", type: "api", category: "Business", purpose: "DISCOVERY", endpoint: "https://api.domainsdb.info/v1/", auth: "none", priority: 15, dailyLimit: 1000, perMinute: 20, freeTier: true, countries: "worldwide", enabled: true, status: "active" },
  { name: "Pick an Agency", type: "directory", category: "Business", purpose: "DISCOVERY", endpoint: "https://www.pickanagency.com/api/", auth: "none", priority: 53, dailyLimit: 500, perMinute: 15, freeTier: true, countries: "worldwide", enabled: true, status: "active" },
  { name: "TradeDataHub", type: "api", category: "Business", purpose: "DISCOVERY", endpoint: "https://www.tradedatahub.net", auth: "none", priority: 54, dailyLimit: 500, perMinute: 15, freeTier: true, countries: "US", enabled: true, status: "active" },
  { name: "USAspending.gov", type: "api", category: "Open Data", purpose: "DISCOVERY", endpoint: "https://api.usaspending.gov/api/v2/", auth: "none", priority: 55, dailyLimit: 1000, perMinute: 20, freeTier: true, countries: "US", enabled: true, status: "active" },

  // === Free Email Validators (no auth) ===
  { name: "EVA Email Validator", type: "validator", category: "Email", purpose: "VALIDATION", endpoint: "https://eva.pingutil.com/api/v1/", auth: "none", priority: 70, dailyLimit: 2000, perMinute: 30, freeTier: true, countries: "worldwide", enabled: true, status: "active" },
  { name: "Kickbox Email Verify", type: "validator", category: "Email", purpose: "VALIDATION", endpoint: "https://open.kickbox.com/v1/", auth: "none", priority: 71, dailyLimit: 1000, perMinute: 20, freeTier: true, countries: "worldwide", enabled: true, status: "active" },
  { name: "MailCheck.ai", type: "validator", category: "Email", purpose: "VALIDATION", endpoint: "https://www.mailcheck.ai/api/", auth: "none", priority: 72, dailyLimit: 1000, perMinute: 20, freeTier: true, countries: "worldwide", enabled: true, status: "active" },

  // === Free Geocoding (no auth) ===
  { name: "Geocode.xyz", type: "geocoding", category: "Geocoding", purpose: "LOCATION", endpoint: "https://geocode.xyz/api", auth: "none", priority: 25, dailyLimit: 1000, perMinute: 10, freeTier: true, countries: "worldwide", enabled: true, status: "active" },
  { name: "GeoNames", type: "geocoding", category: "Geocoding", purpose: "LOCATION", endpoint: "http://www.geonames.org/export/", auth: "none", priority: 26, dailyLimit: 1000, perMinute: 10, freeTier: true, countries: "worldwide", enabled: true, status: "active" },

  // === Free Open Data (no auth) ===
  { name: "US Federal Contracts & Grants", type: "api", category: "Open Data", purpose: "DISCOVERY", endpoint: "https://government-data-api.onrender.com/docs", auth: "none", priority: 56, dailyLimit: 500, perMinute: 10, freeTier: true, countries: "US", enabled: true, status: "active" },
  { name: "Census.gov US Business Data", type: "api", category: "Open Data", purpose: "DISCOVERY", endpoint: "https://www.census.gov/data/developers/", auth: "none", priority: 57, dailyLimit: 500, perMinute: 10, freeTier: true, countries: "US", enabled: true, status: "active" },
  { name: "UK Food Standards Agency", type: "api", category: "Open Data", purpose: "DISCOVERY", endpoint: "http://ratings.food.gov.uk/open-data/", auth: "none", priority: 58, dailyLimit: 500, perMinute: 10, freeTier: true, countries: "UK", enabled: true, status: "active" },
  { name: "Radar CNPJ (Brazil)", type: "api", category: "Open Data", purpose: "DISCOVERY", endpoint: "https://radar-cnpj.com/api/", auth: "none", priority: 59, dailyLimit: 500, perMinute: 10, freeTier: true, countries: "Brazil", enabled: true, status: "active" },

  // === API-Key Based Discovery (activate by setting env var) ===
  { name: "OpenCorporates", type: "api", category: "Open Data", purpose: "DISCOVERY+COMPANY", endpoint: "https://api.opencorporates.com/v0.4", auth: "apiKey", envVar: "OPENCORPORATES_API_KEY", priority: 5, dailyLimit: 500, perMinute: 10, freeTier: true, countries: "worldwide", enabled: true, status: "not_configured" },
  { name: "Foursquare Places", type: "api", category: "Social", purpose: "DISCOVERY+LOCATION", endpoint: "https://api.foursquare.com/v3", auth: "apiKey", envVar: "FOURSQUARE_API_KEY", priority: 6, dailyLimit: 100000, perMinute: 50, freeTier: true, countries: "worldwide", enabled: true, status: "not_configured" },
  { name: "Funding Signals", type: "api", category: "Business", purpose: "DISCOVERY", endpoint: "https://fundingsignals.net/docs", auth: "apiKey", envVar: "FUNDING_SIGNALS_API_KEY", priority: 60, dailyLimit: 100, perMinute: 5, freeTier: true, countries: "worldwide", enabled: false, status: "not_configured" },
  { name: "Tomba Email Finder", type: "enrichment", category: "Business", purpose: "CONTACT+ENRICHMENT", endpoint: "https://tomba.io/api", auth: "apiKey", envVar: "TOMBA_API_KEY", priority: 63, dailyLimit: 50, perMinute: 5, freeTier: true, countries: "worldwide", enabled: false, status: "not_configured" },
  { name: "ORB Intelligence", type: "enrichment", category: "Business", purpose: "DISCOVERY+COMPANY", endpoint: "https://api.orb-intelligence.com/docs/", auth: "apiKey", envVar: "ORB_API_KEY", priority: 64, dailyLimit: 100, perMinute: 5, freeTier: false, countries: "worldwide", enabled: false, status: "not_configured" },
  { name: "Signaliz", type: "enrichment", category: "Business", purpose: "ENRICHMENT", endpoint: "https://signaliz.docs.buildwithfern.com/", auth: "apiKey", envVar: "SIGNALIZ_API_KEY", priority: 65, dailyLimit: 100, perMinute: 5, freeTier: true, countries: "worldwide", enabled: false, status: "not_configured" },
  { name: "Village", type: "enrichment", category: "Business", purpose: "ENRICHMENT", endpoint: "https://docs.village.ai", auth: "apiKey", envVar: "VILLAGE_API_KEY", priority: 66, dailyLimit: 100, perMinute: 5, freeTier: true, countries: "worldwide", enabled: false, status: "not_configured" },

  // === API-Key Email Validators ===
  { name: "mailboxlayer", type: "validator", category: "Email", purpose: "VALIDATION", endpoint: "https://mailboxlayer.com", auth: "apiKey", envVar: "MAILBOXLAYER_API_KEY", priority: 73, dailyLimit: 1000, perMinute: 20, freeTier: true, countries: "worldwide", enabled: false, status: "not_configured" },
  { name: "Cloudmersive Validate", type: "validator", category: "Email", purpose: "VALIDATION", endpoint: "https://cloudmersive.com/validate-api", auth: "apiKey", envVar: "CLOUDMERSIVE_API_KEY", priority: 74, dailyLimit: 1000, perMinute: 20, freeTier: true, countries: "worldwide", enabled: false, status: "not_configured" },
  { name: "Abstract API Email", type: "validator", category: "Email", purpose: "VALIDATION", endpoint: "https://www.abstractapi.com/email-verification-validation-api", auth: "apiKey", envVar: "ABSTRACT_EMAIL_API_KEY", priority: 75, dailyLimit: 250, perMinute: 10, freeTier: true, countries: "worldwide", enabled: false, status: "not_configured" },
  { name: "MailboxValidator", type: "validator", category: "Email", purpose: "VALIDATION", endpoint: "https://www.mailboxvalidator.com/api-email-free", auth: "apiKey", envVar: "MAILBOXVALIDATOR_API_KEY", priority: 76, dailyLimit: 100, perMinute: 5, freeTier: true, countries: "worldwide", enabled: false, status: "not_configured" },
  { name: "Kiprio Email Validate", type: "validator", category: "Email", purpose: "VALIDATION", endpoint: "https://kiprio.com/v1/email-validate", auth: "apiKey", envVar: "KIPRIO_API_KEY", priority: 77, dailyLimit: 100, perMinute: 5, freeTier: true, countries: "worldwide", enabled: false, status: "not_configured" },
  { name: "Verifier.meetchopra", type: "validator", category: "Email", purpose: "VALIDATION", endpoint: "https://verifier.meetchopra.com/docs", auth: "apiKey", envVar: "VERIFIER_API_KEY", priority: 78, dailyLimit: 100, perMinute: 5, freeTier: true, countries: "worldwide", enabled: false, status: "not_configured" },

  // === API-Key Phone Validators ===
  { name: "Numlookup", type: "validator", category: "Phone", purpose: "VALIDATION", endpoint: "https://numlookupapi.com", auth: "apiKey", envVar: "NUMLOOKUP_API_KEY", priority: 80, dailyLimit: 100, perMinute: 5, freeTier: true, countries: "worldwide", enabled: false, status: "not_configured" },
  { name: "Numverify", type: "validator", category: "Phone", purpose: "VALIDATION", endpoint: "https://numverify.com", auth: "apiKey", envVar: "NUMVERIFY_API_KEY", priority: 81, dailyLimit: 250, perMinute: 10, freeTier: true, countries: "worldwide", enabled: false, status: "not_configured" },
  { name: "Abstract API Phone", type: "validator", category: "Phone", purpose: "VALIDATION", endpoint: "https://www.abstractapi.com/phone-validation-api", auth: "apiKey", envVar: "ABSTRACT_PHONE_API_KEY", priority: 82, dailyLimit: 250, perMinute: 10, freeTier: true, countries: "worldwide", enabled: false, status: "not_configured" },
  { name: "Veriphone", type: "validator", category: "Phone", purpose: "VALIDATION", endpoint: "https://veriphone.io", auth: "apiKey", envVar: "VERIPHONE_API_KEY", priority: 83, dailyLimit: 100, perMinute: 5, freeTier: true, countries: "worldwide", enabled: false, status: "not_configured" },

  // === API-Key Enrichment ===
  { name: "Hunter.io", type: "enrichment", category: "Business", purpose: "CONTACT+VALIDATION", endpoint: "https://api.hunter.io/v2", auth: "apiKey", envVar: "HUNTER_API_KEY", priority: 60, dailyLimit: 25, perMinute: 5, freeTier: true, countries: "worldwide", enabled: false, status: "not_configured" },
  { name: "Apollo.io", type: "enrichment", category: "Business", purpose: "CONTACT+ENRICHMENT", endpoint: "https://api.apollo.io/v1", auth: "apiKey", envVar: "APOLLO_API_KEY", priority: 61, dailyLimit: 10, perMinute: 2, freeTier: true, countries: "worldwide", enabled: false, status: "not_configured" },
  { name: "Snov.io", type: "enrichment", category: "Business", purpose: "CONTACT+VALIDATION", endpoint: "https://api.snov.io/v1", auth: "apiKey", envVar: "SNOV_CLIENT_ID", priority: 62, dailyLimit: 50, perMinute: 5, freeTier: true, countries: "worldwide", enabled: false, status: "not_configured" },

  // === API-Key Geocoding ===
  { name: "Geoapify", type: "geocoding", category: "Geocoding", purpose: "LOCATION", endpoint: "https://www.geoapify.com/api/geocoding-api/", auth: "apiKey", envVar: "GEOAPIFY_API_KEY", priority: 27, dailyLimit: 3000, perMinute: 30, freeTier: true, countries: "worldwide", enabled: false, status: "not_configured" },
  { name: "Geocod.io", type: "geocoding", category: "Geocoding", purpose: "LOCATION", endpoint: "https://www.geocod.io/", auth: "apiKey", envVar: "GEOCODIO_API_KEY", priority: 28, dailyLimit: 2500, perMinute: 30, freeTier: true, countries: "US+CA", enabled: false, status: "not_configured" },
  { name: "Google Maps Platform", type: "geocoding", category: "Geocoding", purpose: "LOCATION", endpoint: "https://developers.google.com/maps/", auth: "apiKey", envVar: "GOOGLE_MAPS_API_KEY", priority: 29, dailyLimit: 28000, perMinute: 60, freeTier: true, countries: "worldwide", enabled: false, status: "not_configured" },
  { name: "HERE Maps", type: "geocoding", category: "Geocoding", purpose: "LOCATION", endpoint: "https://developer.here.com", auth: "apiKey", envVar: "HERE_API_KEY", priority: 30, dailyLimit: 250000, perMinute: 100, freeTier: true, countries: "worldwide", enabled: false, status: "not_configured" },

  // === API-Key Open Data ===
  { name: "UK Companies House", type: "api", category: "Open Data", purpose: "DISCOVERY+COMPANY", endpoint: "https://developer.company-information.service.gov.uk/", auth: "OAuth", envVar: "COMPANIES_HOUSE_KEY", priority: 7, dailyLimit: 600, perMinute: 10, freeTier: true, countries: "UK", enabled: false, status: "not_configured" },
  { name: "OpenRegistry", type: "api", category: "Open Data", purpose: "DISCOVERY+COMPANY", endpoint: "https://openregistry.sophymarine.com", auth: "OAuth", envVar: "OPENREGISTRY_KEY", priority: 8, dailyLimit: 500, perMinute: 10, freeTier: true, countries: "27 countries", enabled: false, status: "not_configured" },
  { name: "OpenMercantil (Spain)", type: "api", category: "Open Data", purpose: "DISCOVERY+COMPANY", endpoint: "https://openmercantil.es/api/", auth: "none", priority: 9, dailyLimit: 500, perMinute: 10, freeTier: true, countries: "Spain", enabled: false, status: "not_configured" },

  // === Shopping/Marketplace (API key required) ===
  { name: "eBay", type: "api", category: "Shopping", purpose: "DISCOVERY+SELLER", endpoint: "https://developer.ebay.com/", auth: "OAuth", envVar: "EBAY_API_KEY", priority: 90, dailyLimit: 5000, perMinute: 50, freeTier: true, countries: "worldwide", enabled: false, status: "not_configured" },
  { name: "Etsy", type: "api", category: "Shopping", purpose: "DISCOVERY+SELLER", endpoint: "https://www.etsy.com/developers/", auth: "OAuth", envVar: "ETSY_API_KEY", priority: 91, dailyLimit: 1000, perMinute: 10, freeTier: true, countries: "worldwide", enabled: false, status: "not_configured" },
  { name: "Amazon", type: "api", category: "Shopping", purpose: "DISCOVERY+SELLER", endpoint: "https://webservices.amazon.com/", auth: "apiKey", envVar: "AMAZON_API_KEY", priority: 92, dailyLimit: 1000, perMinute: 10, freeTier: false, countries: "worldwide", enabled: false, status: "not_configured" },
  { name: "MercadoLibre", type: "api", category: "Shopping", purpose: "DISCOVERY+SELLER", endpoint: "https://developers.mercadolibre.cl/", auth: "apiKey", envVar: "MERCADOLIBRE_API_KEY", priority: 93, dailyLimit: 1000, perMinute: 10, freeTier: true, countries: "LATAM", enabled: false, status: "not_configured" },

  // === Jobs (API key required) ===
  { name: "Adzuna", type: "api", category: "Jobs", purpose: "DISCOVERY+COMPANY", endpoint: "https://developer.adzuna.com/overview", auth: "apiKey", envVar: "ADZUNA_API_KEY", priority: 95, dailyLimit: 250, perMinute: 10, freeTier: true, countries: "worldwide", enabled: false, status: "not_configured" },
  { name: "Findwork", type: "api", category: "Jobs", purpose: "DISCOVERY+COMPANY", endpoint: "https://findwork.dev/developers/", auth: "apiKey", envVar: "FINDWORK_API_KEY", priority: 96, dailyLimit: 100, perMinute: 5, freeTier: true, countries: "worldwide", enabled: false, status: "not_configured" },
  { name: "USAJOBS", type: "api", category: "Jobs", purpose: "DISCOVERY+COMPANY", endpoint: "https://developer.usajobs.gov/", auth: "apiKey", envVar: "USAJOBS_API_KEY", priority: 97, dailyLimit: 500, perMinute: 10, freeTier: true, countries: "US", enabled: false, status: "not_configured" },

  // === Social (API key required) ===
  { name: "Full Contact", type: "enrichment", category: "Social", purpose: "ENRICHMENT+CONTACT", endpoint: "https://docs.fullcontact.com/", auth: "OAuth", envVar: "FULLCONTACT_API_KEY", priority: 85, dailyLimit: 100, perMinute: 5, freeTier: false, countries: "worldwide", enabled: false, status: "not_configured" },
  { name: "SocialCrawl", type: "enrichment", category: "Social", purpose: "ENRICHMENT", endpoint: "https://www.socialcrawl.dev/docs", auth: "apiKey", envVar: "SOCIALCRAWL_API_KEY", priority: 86, dailyLimit: 100, perMinute: 5, freeTier: true, countries: "worldwide", enabled: false, status: "not_configured" },

  // === Discovery (API key required) ===
  { name: "Zenserp", type: "api", category: "Discovery", purpose: "DISCOVERY", endpoint: "https://zenserp.com/", auth: "apiKey", envVar: "ZENSERP_API_KEY", priority: 42, dailyLimit: 50, perMinute: 5, freeTier: true, countries: "worldwide", enabled: false, status: "not_configured" },
  { name: "SecurityTrails", type: "api", category: "Discovery", purpose: "ENRICHMENT+DOMAIN", endpoint: "https://securitytrails.com/corp/apidocs", auth: "apiKey", envVar: "SECURITYTRAILS_API_KEY", priority: 43, dailyLimit: 50, perMinute: 5, freeTier: true, countries: "worldwide", enabled: false, status: "not_configured" },
];
