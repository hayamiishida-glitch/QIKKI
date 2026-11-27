export interface LocalizedHoliday {
  date: string; // YYYY-MM-DD
  localName: string;
  name: string;
  countryCode: string;
  countryName: string;
  isGlobal: boolean;
  types: string[];
}

export interface HolidayCountryOption {
  countryCode: string;
  name: string;
}

export interface HolidayYearFetchResult {
  holidays: LocalizedHoliday[];
  source: 'nager' | 'openholidays' | 'cache';
  fetchedAt: string;
}

const HOLIDAY_CACHE_KEY = 'qikki_holidays_cache_v1';
const COUNTRIES_CACHE_KEY = 'qikki_holiday_countries_v1';
const IP_COUNTRY_CACHE_KEY = 'qikki_ip_country_v1';

const HOLIDAY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours stale-while-revalidate
const COUNTRIES_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const IP_COUNTRY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const inFlightYearFetches = new Map<string, Promise<HolidayYearFetchResult>>();
let inFlightCountriesFetch: Promise<HolidayCountryOption[]> | null = null;
let inFlightIpCountryFetch: Promise<string | null> | null = null;

// Comprehensive IANA timezone -> ISO-3166 alpha-2 country mapping for accurate local detection
// even when the user's browser UI language is set to English (e.g. en-US).
const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  // Indonesia & Southeast Asia
  'Asia/Jakarta': 'ID',
  'Asia/Pontianak': 'ID',
  'Asia/Makassar': 'ID',
  'Asia/Ujung_Pandang': 'ID',
  'Asia/Jayapura': 'ID',
  'Asia/Kuala_Lumpur': 'MY',
  'Asia/Kuching': 'MY',
  'Asia/Singapore': 'SG',
  'Asia/Bangkok': 'TH',
  'Asia/Manila': 'PH',
  'Asia/Ho_Chi_Minh': 'VN',
  'Asia/Saigon': 'VN',
  'Asia/Phnom_Penh': 'KH',
  'Asia/Vientiane': 'LA',
  'Asia/Yangon': 'MM',
  'Asia/Rangoon': 'MM',
  'Asia/Brunei': 'BN',
  'Asia/Dili': 'TL',

  // East & South Asia
  'Asia/Tokyo': 'JP',
  'Asia/Seoul': 'KR',
  'Asia/Shanghai': 'CN',
  'Asia/Chongqing': 'CN',
  'Asia/Harbin': 'CN',
  'Asia/Urumqi': 'CN',
  'Asia/Hong_Kong': 'HK',
  'Asia/Macau': 'MO',
  'Asia/Taipei': 'TW',
  'Asia/Kolkata': 'IN',
  'Asia/Calcutta': 'IN',
  'Asia/Karachi': 'PK',
  'Asia/Dhaka': 'BD',
  'Asia/Colombo': 'LK',
  'Asia/Kathmandu': 'NP',
  'Asia/Katmandu': 'NP',
  'Asia/Ulaanbaatar': 'MN',
  'Asia/Almaty': 'KZ',
  'Asia/Tashkent': 'UZ',

  // Middle East
  'Asia/Riyadh': 'SA',
  'Asia/Dubai': 'AE',
  'Asia/Qatar': 'QA',
  'Asia/Kuwait': 'KW',
  'Asia/Bahrain': 'BH',
  'Asia/Muscat': 'OM',
  'Asia/Amman': 'JO',
  'Asia/Beirut': 'LB',
  'Asia/Jerusalem': 'IL',
  'Asia/Tel_Aviv': 'IL',
  'Asia/Tehran': 'IR',
  'Asia/Baghdad': 'IQ',
  'Asia/Nicosia': 'CY',
  'Asia/Tbilisi': 'GE',
  'Asia/Yerevan': 'AM',
  'Asia/Baku': 'AZ',

  // Oceania
  'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU',
  'Australia/Brisbane': 'AU',
  'Australia/Perth': 'AU',
  'Australia/Adelaide': 'AU',
  'Australia/Hobart': 'AU',
  'Australia/Darwin': 'AU',
  'Australia/Canberra': 'AU',
  'Pacific/Auckland': 'NZ',
  'Pacific/Chatham': 'NZ',
  'Pacific/Fiji': 'FJ',
  'Pacific/Port_Moresby': 'PG',
  'Pacific/Honolulu': 'US',
  'Pacific/Guam': 'GU',

  // Europe
  'Europe/London': 'GB',
  'Europe/Belfast': 'GB',
  'Europe/Dublin': 'IE',
  'Europe/Paris': 'FR',
  'Europe/Berlin': 'DE',
  'Europe/Busingen': 'DE',
  'Europe/Madrid': 'ES',
  'Atlantic/Canary': 'ES',
  'Europe/Rome': 'IT',
  'Europe/Vatican': 'VA',
  'Europe/Lisbon': 'PT',
  'Atlantic/Azores': 'PT',
  'Atlantic/Madeira': 'PT',
  'Europe/Amsterdam': 'NL',
  'Europe/Brussels': 'BE',
  'Europe/Luxembourg': 'LU',
  'Europe/Zurich': 'CH',
  'Europe/Vienna': 'AT',
  'Europe/Stockholm': 'SE',
  'Europe/Oslo': 'NO',
  'Europe/Copenhagen': 'DK',
  'Europe/Helsinki': 'FI',
  'Atlantic/Reykjavik': 'IS',
  'Europe/Warsaw': 'PL',
  'Europe/Prague': 'CZ',
  'Europe/Bratislava': 'SK',
  'Europe/Budapest': 'HU',
  'Europe/Bucharest': 'RO',
  'Europe/Sofia': 'BG',
  'Europe/Athens': 'GR',
  'Europe/Istanbul': 'TR',
  'Asia/Istanbul': 'TR',
  'Europe/Moscow': 'RU',
  'Asia/Yekaterinburg': 'RU',
  'Asia/Novosibirsk': 'RU',
  'Asia/Vladivostok': 'RU',
  'Europe/Kyiv': 'UA',
  'Europe/Kiev': 'UA',
  'Europe/Minsk': 'BY',
  'Europe/Riga': 'LV',
  'Europe/Tallinn': 'EE',
  'Europe/Vilnius': 'LT',
  'Europe/Zagreb': 'HR',
  'Europe/Ljubljana': 'SI',
  'Europe/Belgrade': 'RS',
  'Europe/Sarajevo': 'BA',
  'Europe/Podgorica': 'ME',
  'Europe/Skopje': 'MK',
  'Europe/Tirane': 'AL',
  'Europe/Chisinau': 'MD',
  'Europe/Malta': 'MT',
  'Europe/Andorra': 'AD',
  'Europe/Monaco': 'MC',

  // North & Central America
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
  'America/Phoenix': 'US',
  'America/Anchorage': 'US',
  'America/Juneau': 'US',
  'America/Detroit': 'US',
  'America/Boise': 'US',
  'America/Indiana/Indianapolis': 'US',
  'America/Kentucky/Louisville': 'US',
  'US/Eastern': 'US',
  'US/Central': 'US',
  'US/Mountain': 'US',
  'US/Pacific': 'US',
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
  'America/Montreal': 'CA',
  'America/Edmonton': 'CA',
  'America/Winnipeg': 'CA',
  'America/Halifax': 'CA',
  'America/St_Johns': 'CA',
  'America/Regina': 'CA',
  'America/Mexico_City': 'MX',
  'America/Cancun': 'MX',
  'America/Monterrey': 'MX',
  'America/Tijuana': 'MX',
  'America/Merida': 'MX',
  'America/Guatemala': 'GT',
  'America/Costa_Rica': 'CR',
  'America/Panama': 'PA',
  'America/Havana': 'CU',
  'America/Santo_Domingo': 'DO',
  'America/Jamaica': 'JM',
  'America/Puerto_Rico': 'PR',

  // South America
  'America/Sao_Paulo': 'BR',
  'America/Manaus': 'BR',
  'America/Fortaleza': 'BR',
  'America/Belem': 'BR',
  'America/Recife': 'BR',
  'America/Bahia': 'BR',
  'America/Argentina/Buenos_Aires': 'AR',
  'America/Buenos_Aires': 'AR',
  'America/Cordoba': 'AR',
  'America/Santiago': 'CL',
  'America/Bogota': 'CO',
  'America/Lima': 'PE',
  'America/Caracas': 'VE',
  'America/Guayaquil': 'EC',
  'America/La_Paz': 'BO',
  'America/Asuncion': 'PY',
  'America/Montevideo': 'UY',

  // Africa
  'Africa/Cairo': 'EG',
  'Africa/Johannesburg': 'ZA',
  'Africa/Lagos': 'NG',
  'Africa/Nairobi': 'KE',
  'Africa/Casablanca': 'MA',
  'Africa/Tunis': 'TN',
  'Africa/Algiers': 'DZ',
  'Africa/Accra': 'GH',
  'Africa/Addis_Ababa': 'ET',
  'Africa/Dar_es_Salaam': 'TZ',
  'Africa/Kampala': 'UG',
  'Africa/Harare': 'ZW',
  'Africa/Lusaka': 'ZM',
  'Africa/Maputo': 'MZ',
  'Africa/Windhoek': 'NA',
  'Africa/Gaborone': 'BW',
};

// Built-in fallback country list (mirrors Nager.Date & OpenHolidays supported countries)
export const FALLBACK_COUNTRIES: HolidayCountryOption[] = [
  { countryCode: 'AD', name: 'Andorra' },
  { countryCode: 'AL', name: 'Albania' },
  { countryCode: 'AR', name: 'Argentina' },
  { countryCode: 'AT', name: 'Austria' },
  { countryCode: 'AU', name: 'Australia' },
  { countryCode: 'AX', name: 'Åland Islands' },
  { countryCode: 'BA', name: 'Bosnia and Herzegovina' },
  { countryCode: 'BB', name: 'Barbados' },
  { countryCode: 'BE', name: 'Belgium' },
  { countryCode: 'BG', name: 'Bulgaria' },
  { countryCode: 'BJ', name: 'Benin' },
  { countryCode: 'BO', name: 'Bolivia' },
  { countryCode: 'BR', name: 'Brazil' },
  { countryCode: 'BS', name: 'Bahamas' },
  { countryCode: 'BW', name: 'Botswana' },
  { countryCode: 'BY', name: 'Belarus' },
  { countryCode: 'BZ', name: 'Belize' },
  { countryCode: 'CA', name: 'Canada' },
  { countryCode: 'CH', name: 'Switzerland' },
  { countryCode: 'CL', name: 'Chile' },
  { countryCode: 'CN', name: 'China' },
  { countryCode: 'CO', name: 'Colombia' },
  { countryCode: 'CR', name: 'Costa Rica' },
  { countryCode: 'CU', name: 'Cuba' },
  { countryCode: 'CY', name: 'Cyprus' },
  { countryCode: 'CZ', name: 'Czechia' },
  { countryCode: 'DE', name: 'Germany' },
  { countryCode: 'DK', name: 'Denmark' },
  { countryCode: 'DO', name: 'Dominican Republic' },
  { countryCode: 'EC', name: 'Ecuador' },
  { countryCode: 'EE', name: 'Estonia' },
  { countryCode: 'EG', name: 'Egypt' },
  { countryCode: 'ES', name: 'Spain' },
  { countryCode: 'FI', name: 'Finland' },
  { countryCode: 'FO', name: 'Faroe Islands' },
  { countryCode: 'FR', name: 'France' },
  { countryCode: 'GA', name: 'Gabon' },
  { countryCode: 'GB', name: 'United Kingdom' },
  { countryCode: 'GD', name: 'Grenada' },
  { countryCode: 'GE', name: 'Georgia' },
  { countryCode: 'GG', name: 'Guernsey' },
  { countryCode: 'GI', name: 'Gibraltar' },
  { countryCode: 'GL', name: 'Greenland' },
  { countryCode: 'GM', name: 'Gambia' },
  { countryCode: 'GR', name: 'Greece' },
  { countryCode: 'GT', name: 'Guatemala' },
  { countryCode: 'GY', name: 'Guyana' },
  { countryCode: 'HK', name: 'Hong Kong' },
  { countryCode: 'HN', name: 'Honduras' },
  { countryCode: 'HR', name: 'Croatia' },
  { countryCode: 'HT', name: 'Haiti' },
  { countryCode: 'HU', name: 'Hungary' },
  { countryCode: 'ID', name: 'Indonesia' },
  { countryCode: 'IE', name: 'Ireland' },
  { countryCode: 'IM', name: 'Isle of Man' },
  { countryCode: 'IS', name: 'Iceland' },
  { countryCode: 'IT', name: 'Italy' },
  { countryCode: 'JE', name: 'Jersey' },
  { countryCode: 'JM', name: 'Jamaica' },
  { countryCode: 'JP', name: 'Japan' },
  { countryCode: 'KR', name: 'South Korea' },
  { countryCode: 'KZ', name: 'Kazakhstan' },
  { countryCode: 'LI', name: 'Liechtenstein' },
  { countryCode: 'LS', name: 'Lesotho' },
  { countryCode: 'LT', name: 'Lithuania' },
  { countryCode: 'LU', name: 'Luxembourg' },
  { countryCode: 'LV', name: 'Latvia' },
  { countryCode: 'MA', name: 'Morocco' },
  { countryCode: 'MC', name: 'Monaco' },
  { countryCode: 'MD', name: 'Moldova' },
  { countryCode: 'ME', name: 'Montenegro' },
  { countryCode: 'MG', name: 'Madagascar' },
  { countryCode: 'MK', name: 'North Macedonia' },
  { countryCode: 'MN', name: 'Mongolia' },
  { countryCode: 'MS', name: 'Montserrat' },
  { countryCode: 'MT', name: 'Malta' },
  { countryCode: 'MX', name: 'Mexico' },
  { countryCode: 'MZ', name: 'Mozambique' },
  { countryCode: 'NA', name: 'Namibia' },
  { countryCode: 'NE', name: 'Niger' },
  { countryCode: 'NG', name: 'Nigeria' },
  { countryCode: 'NI', name: 'Nicaragua' },
  { countryCode: 'NL', name: 'Netherlands' },
  { countryCode: 'NO', name: 'Norway' },
  { countryCode: 'NZ', name: 'New Zealand' },
  { countryCode: 'PA', name: 'Panama' },
  { countryCode: 'PE', name: 'Peru' },
  { countryCode: 'PG', name: 'Papua New Guinea' },
  { countryCode: 'PH', name: 'Philippines' },
  { countryCode: 'PL', name: 'Poland' },
  { countryCode: 'PR', name: 'Puerto Rico' },
  { countryCode: 'PT', name: 'Portugal' },
  { countryCode: 'PY', name: 'Paraguay' },
  { countryCode: 'RO', name: 'Romania' },
  { countryCode: 'RS', name: 'Serbia' },
  { countryCode: 'RU', name: 'Russia' },
  { countryCode: 'SE', name: 'Sweden' },
  { countryCode: 'SG', name: 'Singapore' },
  { countryCode: 'SI', name: 'Slovenia' },
  { countryCode: 'SJ', name: 'Svalbard and Jan Mayen' },
  { countryCode: 'SK', name: 'Slovakia' },
  { countryCode: 'SM', name: 'San Marino' },
  { countryCode: 'SR', name: 'Suriname' },
  { countryCode: 'SV', name: 'El Salvador' },
  { countryCode: 'TN', name: 'Tunisia' },
  { countryCode: 'TR', name: 'Türkiye' },
  { countryCode: 'UA', name: 'Ukraine' },
  { countryCode: 'US', name: 'United States' },
  { countryCode: 'UY', name: 'Uruguay' },
  { countryCode: 'VA', name: 'Vatican City' },
  { countryCode: 'VE', name: 'Venezuela' },
  { countryCode: 'VN', name: 'Vietnam' },
  { countryCode: 'ZA', name: 'South Africa' },
  { countryCode: 'ZW', name: 'Zimbabwe' },
];

export function normalizeCountryCode(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(cleaned)) return cleaned;
  return null;
}

export function normalizeHolidayCountryPref(raw?: unknown): string {
  if (typeof raw !== 'string') return 'AUTO';
  const cleaned = raw.trim().toUpperCase();
  if (cleaned === 'AUTO') return 'AUTO';
  if (/^[A-Z]{2,4}$/.test(cleaned)) return cleaned;
  return 'AUTO';
}

export function getCountryFlagEmoji(countryCode: string): string {
  const code = normalizeCountryCode(countryCode);
  if (!code) return '🌐';
  const base = 0x1f1e6;
  const first = code.charCodeAt(0) - 65 + base;
  const second = code.charCodeAt(1) - 65 + base;
  try {
    return String.fromCodePoint(first, second);
  } catch {
    return '🌐';
  }
}

let cachedRegionDisplayNames: Intl.DisplayNames | null | undefined;

export function getCountryDisplayName(countryCode: string): string {
  const code = normalizeCountryCode(countryCode);
  if (!code) return 'International';

  const fallbackMatch = FALLBACK_COUNTRIES.find((c) => c.countryCode === code);
  try {
    if (cachedRegionDisplayNames === undefined) {
      cachedRegionDisplayNames =
        typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
          ? new Intl.DisplayNames(['en'], { type: 'region' })
          : null;
    }
    const resolved = cachedRegionDisplayNames?.of(code);
    if (resolved && resolved !== code) {
      return resolved;
    }
  } catch {
    // Fallback below
  }
  return fallbackMatch?.name || code;
}

function getLocaleCountryCode(): string | null {
  if (typeof navigator === 'undefined') return null;
  const langs =
    Array.isArray(navigator.languages) && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language];

  for (const rawLang of langs) {
    if (!rawLang) continue;
    try {
      if (typeof Intl !== 'undefined' && typeof Intl.Locale === 'function') {
        const loc = new Intl.Locale(rawLang);
        if (loc.region && /^[A-Z]{2}$/.test(loc.region)) {
          return loc.region;
        }
      }
    } catch {
      // Fallback regex parse
    }
    const match = rawLang.match(/[-_]([A-Za-z]{2})(?:[-_]|$)/);
    if (match?.[1]) {
      const candidate = match[1].toUpperCase();
      if (candidate !== '01') return candidate;
    }
  }
  return null;
}

function getCachedIpCountry(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(IP_COUNTRY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { code?: string; fetchedAt?: number };
    if (
      parsed.code &&
      typeof parsed.fetchedAt === 'number' &&
      Date.now() - parsed.fetchedAt < IP_COUNTRY_TTL_MS
    ) {
      return normalizeCountryCode(parsed.code);
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

export function detectUserCountryCode(weatherCountryCode?: string | null): {
  countryCode: string;
  confident: boolean;
} {
  const fromWeather = normalizeCountryCode(weatherCountryCode);
  if (fromWeather) {
    return { countryCode: fromWeather, confident: true };
  }

  let tzCountry: string | null = null;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_TO_COUNTRY[tz]) {
      tzCountry = TIMEZONE_TO_COUNTRY[tz];
    }
  } catch {
    // Ignore Intl errors
  }

  if (tzCountry) {
    return { countryCode: tzCountry, confident: true };
  }

  const fromIpCache = getCachedIpCountry();
  if (fromIpCache) {
    return { countryCode: fromIpCache, confident: true };
  }

  const fromLocale = getLocaleCountryCode();
  if (fromLocale) {
    return { countryCode: fromLocale, confident: false };
  }

  return { countryCode: 'US', confident: false };
}

export async function resolveIpCountryFallback(): Promise<string | null> {
  const cached = getCachedIpCountry();
  if (cached) return cached;

  if (inFlightIpCountryFetch) return inFlightIpCountryFetch;

  inFlightIpCountryFetch = (async () => {
    try {
      const resp = await fetch('https://get.geojs.io/v1/ip/country.json');
      if (!resp.ok) return null;
      const data = (await resp.json()) as { country?: string };
      const code = normalizeCountryCode(data.country);
      if (code && typeof window !== 'undefined') {
        try {
          localStorage.setItem(
            IP_COUNTRY_CACHE_KEY,
            JSON.stringify({ code, fetchedAt: Date.now() })
          );
        } catch {
          // Ignore quota errors
        }
      }
      return code;
    } catch {
      return null;
    } finally {
      inFlightIpCountryFetch = null;
    }
  })();

  return inFlightIpCountryFetch;
}

interface HolidayCacheRecord {
  holidays: LocalizedHoliday[];
  source: 'nager' | 'openholidays';
  fetchedAt: string;
  cachedAtMs: number;
}

function readHolidayCacheMap(): Record<string, HolidayCacheRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(HOLIDAY_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, HolidayCacheRecord>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeHolidayCacheEntry(key: string, record: HolidayCacheRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const map = readHolidayCacheMap();
    map[key] = record;
    // Keep cache bounded to most recent 18 country-year pairs
    const keys = Object.keys(map);
    if (keys.length > 18) {
      keys
        .sort((a, b) => (map[a]?.cachedAtMs ?? 0) - (map[b]?.cachedAtMs ?? 0))
        .slice(0, keys.length - 18)
        .forEach((oldKey) => {
          delete map[oldKey];
        });
    }
    localStorage.setItem(HOLIDAY_CACHE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
}

function dedupeAndSortHolidays(list: LocalizedHoliday[]): LocalizedHoliday[] {
  const seen = new Set<string>();
  const clean: LocalizedHoliday[] = [];
  for (const item of list) {
    if (!item.date || (!item.localName && !item.name)) continue;
    const dedupeKey = `${item.date}::${(item.localName || item.name).toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    clean.push(item);
  }
  clean.sort((a, b) => a.date.localeCompare(b.date));
  return clean;
}

async function fetchFromNagerDate(
  year: number,
  countryCode: string
): Promise<LocalizedHoliday[]> {
  const resp = await fetch(
    `https://date.nager.at/api/v3/PublicHolidays/${encodeURIComponent(year)}/${encodeURIComponent(
      countryCode
    )}`
  );
  if (!resp.ok) {
    throw new Error(`Nager.Date returned ${resp.status}`);
  }
  const raw = (await resp.json()) as Array<{
    date?: string;
    localName?: string;
    name?: string;
    countryCode?: string;
    global?: boolean;
    types?: string[];
  }>;
  if (!Array.isArray(raw)) return [];

  const countryName = getCountryDisplayName(countryCode);
  return dedupeAndSortHolidays(
    raw
      .filter((item) => typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date))
      .map((item) => ({
        date: item.date!,
        localName: (item.localName || item.name || 'Public Holiday').trim(),
        name: (item.name || item.localName || 'Public Holiday').trim(),
        countryCode,
        countryName,
        isGlobal: item.global !== false,
        types: Array.isArray(item.types) ? item.types : ['Public'],
      }))
  );
}

async function fetchFromOpenHolidays(
  year: number,
  countryCode: string
): Promise<LocalizedHoliday[]> {
  const resp = await fetch(
    `https://openholidaysapi.org/PublicHolidays?countryIsoCode=${encodeURIComponent(
      countryCode
    )}&validFrom=${year}-01-01&validTo=${year}-12-31&languageIsoCode=EN`
  );
  if (!resp.ok) {
    throw new Error(`OpenHolidays returned ${resp.status}`);
  }
  const raw = (await resp.json()) as Array<{
    startDate?: string;
    type?: string;
    nationwide?: boolean;
    name?: Array<{ language?: string; text?: string }>;
  }>;
  if (!Array.isArray(raw)) return [];

  const countryName = getCountryDisplayName(countryCode);
  return dedupeAndSortHolidays(
    raw
      .filter((item) => typeof item.startDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(item.startDate))
      .map((item) => {
        const names = Array.isArray(item.name) ? item.name : [];
        const enName =
          names.find((n) => n.language?.toUpperCase() === 'EN')?.text ||
          names[0]?.text ||
          'Public Holiday';
        const localName = names[0]?.text || enName;
        return {
          date: item.startDate!.slice(0, 10),
          localName: localName.trim(),
          name: enName.trim(),
          countryCode,
          countryName,
          isGlobal: item.nationwide !== false,
          types: item.type ? [item.type] : ['Public'],
        };
      })
  );
}

export async function fetchLocalizedHolidaysForYear(
  year: number,
  countryCode: string,
  options?: { forceRefresh?: boolean }
): Promise<HolidayYearFetchResult> {
  const normalizedCode = normalizeCountryCode(countryCode) ?? 'US';
  const cacheKey = `${normalizedCode}:${year}`;
  const forceRefresh = Boolean(options?.forceRefresh);

  const cacheMap = readHolidayCacheMap();
  const cached = cacheMap[cacheKey];
  if (
    !forceRefresh &&
    cached &&
    Array.isArray(cached.holidays) &&
    Date.now() - cached.cachedAtMs < HOLIDAY_TTL_MS
  ) {
    return {
      holidays: cached.holidays,
      source: 'cache',
      fetchedAt: cached.fetchedAt,
    };
  }

  const inflightKey = `${cacheKey}:${forceRefresh ? 'force' : 'normal'}`;
  const existingPromise = inFlightYearFetches.get(inflightKey);
  if (existingPromise) {
    return existingPromise;
  }

  const promise = (async (): Promise<HolidayYearFetchResult> => {
    try {
      let holidays: LocalizedHoliday[] = [];
      let source: 'nager' | 'openholidays' = 'nager';

      try {
        holidays = await fetchFromNagerDate(year, normalizedCode);
        if (holidays.length === 0) {
          throw new Error('Empty holiday list from Nager.Date');
        }
      } catch {
        holidays = await fetchFromOpenHolidays(year, normalizedCode);
        source = 'openholidays';
      }

      const fetchedAt = new Date().toISOString();
      writeHolidayCacheEntry(cacheKey, {
        holidays,
        source,
        fetchedAt,
        cachedAtMs: Date.now(),
      });

      return { holidays, source, fetchedAt };
    } catch (err) {
      if (cached && Array.isArray(cached.holidays)) {
        return {
          holidays: cached.holidays,
          source: 'cache',
          fetchedAt: cached.fetchedAt,
        };
      }
      throw err;
    } finally {
      inFlightYearFetches.delete(inflightKey);
    }
  })();

  inFlightYearFetches.set(inflightKey, promise);
  return promise;
}

export async function fetchAvailableHolidayCountries(): Promise<HolidayCountryOption[]> {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(COUNTRIES_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          countries?: HolidayCountryOption[];
          cachedAtMs?: number;
        };
        if (
          Array.isArray(parsed.countries) &&
          parsed.countries.length > 0 &&
          typeof parsed.cachedAtMs === 'number' &&
          Date.now() - parsed.cachedAtMs < COUNTRIES_TTL_MS
        ) {
          return parsed.countries;
        }
      }
    } catch {
      // Ignore cache read error
    }
  }

  if (inFlightCountriesFetch) {
    return inFlightCountriesFetch;
  }

  inFlightCountriesFetch = (async () => {
    try {
      const resp = await fetch('https://date.nager.at/api/v3/AvailableCountries');
      if (!resp.ok) throw new Error('AvailableCountries fetch failed');
      const raw = (await resp.json()) as Array<{
        countryCode?: string;
        name?: string;
      }>;
      if (!Array.isArray(raw) || raw.length === 0) {
        return FALLBACK_COUNTRIES;
      }

      const mergedMap = new Map<string, HolidayCountryOption>();
      for (const item of FALLBACK_COUNTRIES) {
        mergedMap.set(item.countryCode, item);
      }
      for (const item of raw) {
        const code = normalizeCountryCode(item.countryCode);
        if (!code) continue;
        mergedMap.set(code, {
          countryCode: code,
          name: (item.name || getCountryDisplayName(code)).trim(),
        });
      }

      const sorted = Array.from(mergedMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(
            COUNTRIES_CACHE_KEY,
            JSON.stringify({ countries: sorted, cachedAtMs: Date.now() })
          );
        } catch {
          // Ignore storage quota errors
        }
      }

      return sorted;
    } catch {
      return FALLBACK_COUNTRIES;
    } finally {
      inFlightCountriesFetch = null;
    }
  })();

  return inFlightCountriesFetch;
}
