import { useCallback, useEffect, useState } from 'react';
import type { TemperatureUnit } from './useAppPreferences';

export type WeatherConditionKind =
  | 'clear'
  | 'partly-cloudy'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'thunderstorm';

export type WeatherLocationStatus =
  | 'unasked'
  | 'loading'
  | 'ready'
  | 'denied'
  | 'error';

export interface HourlyWeatherPoint {
  timeIso: string;
  tempC: number;
  precipChance: number;
  precipMm: number;
  condition: WeatherConditionKind;
  isDay: boolean;
}

export interface DailyWeatherPoint {
  dateIso: string;
  minTempC: number;
  maxTempC: number;
  precipChanceMax: number;
  condition: WeatherConditionKind;
}

export interface WeatherForecastData {
  locationName: string;
  regionLabel: string;
  latitude: number;
  longitude: number;
  tempC: number;
  feelsLikeC: number;
  humidity: number;
  windKmh: number;
  precipMm: number;
  precipChance: number;
  condition: WeatherConditionKind;
  conditionLabel: string;
  isDay: boolean;
  fetchedAt: string;
  hourly: HourlyWeatherPoint[];
  daily: DailyWeatherPoint[];
  source: 'gps' | 'ip' | 'manual';
  countryCode?: string;
}

export interface CitySearchResult {
  id: number;
  name: string;
  region: string;
  country: string;
  countryCode?: string;
  latitude: number;
  longitude: number;
}

const CONSENT_KEY = 'qikki_weather_location_consent_v1';
const PROMPT_DISMISSED_KEY = 'qikki_weather_prompt_dismissed_v1';
const SAVED_COORDS_KEY = 'qikki_weather_coords_v1';

export function mapWmoCodeToCondition(code: number): {
  kind: WeatherConditionKind;
  label: string;
} {
  if (code === 0) return { kind: 'clear', label: 'Clear Sky' };
  if (code === 1) return { kind: 'partly-cloudy', label: 'Mostly Clear' };
  if (code === 2) return { kind: 'partly-cloudy', label: 'Partly Cloudy' };
  if (code === 3) return { kind: 'cloudy', label: 'Overcast' };
  if (code === 45 || code === 48) return { kind: 'fog', label: 'Foggy' };
  if (code >= 51 && code <= 57) return { kind: 'drizzle', label: 'Drizzle' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    return { kind: 'rain', label: code >= 65 || code === 82 ? 'Heavy Rain' : 'Rain' };
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return { kind: 'snow', label: 'Snow' };
  }
  if (code >= 95) return { kind: 'thunderstorm', label: 'Thunderstorm' };
  return { kind: 'partly-cloudy', label: 'Partly Cloudy' };
}

export function formatTemperature(tempC: number, unit: TemperatureUnit): string {
  if (unit === 'f') {
    return `${Math.round((tempC * 9) / 5 + 32)}°F`;
  }
  return `${Math.round(tempC)}°C`;
}

export function formatShortTemperature(tempC: number, unit: TemperatureUnit): string {
  if (unit === 'f') {
    return `${Math.round((tempC * 9) / 5 + 32)}°`;
  }
  return `${Math.round(tempC)}°`;
}

export interface StoredLocationTarget {
  latitude: number;
  longitude: number;
  locationName?: string;
  regionLabel?: string;
  countryCode?: string;
  source: 'gps' | 'ip' | 'manual';
}

async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<{ locationName: string; regionLabel: string; countryCode?: string }> {
  try {
    const resp = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
        latitude
      )}&longitude=${encodeURIComponent(longitude)}&localityLanguage=en`
    );
    if (!resp.ok) throw new Error('Reverse geocode error');
    const data = (await resp.json()) as {
      city?: string;
      locality?: string;
      principalSubdivision?: string;
      countryName?: string;
      countryCode?: string;
    };
    const locationName =
      data.city || data.locality || data.principalSubdivision || 'Your Location';
    const regionParts = [data.principalSubdivision, data.countryName].filter(
      (p) => p && p !== locationName
    );
    const countryCode =
      typeof data.countryCode === 'string' &&
      /^[A-Za-z]{2}$/.test(data.countryCode.trim())
        ? data.countryCode.trim().toUpperCase()
        : undefined;
    return {
      locationName,
      regionLabel: regionParts.slice(0, 2).join(', '),
      countryCode,
    };
  } catch {
    return { locationName: 'Local Area', regionLabel: '' };
  }
}

async function fetchOpenMeteoForecast(
  target: StoredLocationTarget
): Promise<WeatherForecastData> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${encodeURIComponent(target.latitude)}` +
    `&longitude=${encodeURIComponent(target.longitude)}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m` +
    `&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,is_day` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&timezone=auto&forecast_days=4`;

  const [weatherResp, geoInfo] = await Promise.all([
    fetch(url),
    target.locationName && target.countryCode
      ? Promise.resolve({
          locationName: target.locationName,
          regionLabel: target.regionLabel || '',
          countryCode: target.countryCode,
        })
      : reverseGeocode(target.latitude, target.longitude).then((rev) => ({
          locationName: target.locationName || rev.locationName,
          regionLabel: target.locationName ? target.regionLabel || rev.regionLabel : rev.regionLabel,
          countryCode: target.countryCode || rev.countryCode,
        })),
  ]);

  if (!weatherResp.ok) {
    throw new Error('Could not reach live weather service.');
  }

  const raw = (await weatherResp.json()) as {
    current?: {
      temperature_2m?: number;
      relative_humidity_2m?: number;
      apparent_temperature?: number;
      is_day?: number;
      precipitation?: number;
      weather_code?: number;
      wind_speed_10m?: number;
    };
    hourly?: {
      time?: string[];
      temperature_2m?: number[];
      precipitation_probability?: number[];
      precipitation?: number[];
      weather_code?: number[];
      is_day?: number[];
    };
    daily?: {
      time?: string[];
      weather_code?: number[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      precipitation_probability_max?: number[];
    };
  };

  const cur = raw.current || {};
  const mappedCurrent = mapWmoCodeToCondition(cur.weather_code ?? 0);

  const hourlyTimes = raw.hourly?.time || [];
  const nowMs = Date.now();
  const hourly: HourlyWeatherPoint[] = [];
  for (let i = 0; i < hourlyTimes.length; i++) {
    const tMs = new Date(hourlyTimes[i]).getTime();
    if (Number.isNaN(tMs) || tMs < nowMs - 30 * 60 * 1000) continue;
    const wCode = raw.hourly?.weather_code?.[i] ?? 0;
    hourly.push({
      timeIso: hourlyTimes[i],
      tempC: raw.hourly?.temperature_2m?.[i] ?? cur.temperature_2m ?? 0,
      precipChance: raw.hourly?.precipitation_probability?.[i] ?? 0,
      precipMm: raw.hourly?.precipitation?.[i] ?? 0,
      condition: mapWmoCodeToCondition(wCode).kind,
      isDay: (raw.hourly?.is_day?.[i] ?? 1) === 1,
    });
    if (hourly.length >= 6) break;
  }

  const dailyTimes = raw.daily?.time || [];
  const daily: DailyWeatherPoint[] = dailyTimes.slice(0, 4).map((dateIso, idx) => ({
    dateIso,
    minTempC: raw.daily?.temperature_2m_min?.[idx] ?? 0,
    maxTempC: raw.daily?.temperature_2m_max?.[idx] ?? 0,
    precipChanceMax: raw.daily?.precipitation_probability_max?.[idx] ?? 0,
    condition: mapWmoCodeToCondition(raw.daily?.weather_code?.[idx] ?? 0).kind,
  }));

  const currentHourChance = hourly[0]?.precipChance ?? daily[0]?.precipChanceMax ?? 0;

  return {
    locationName: geoInfo.locationName,
    regionLabel: geoInfo.regionLabel,
    latitude: target.latitude,
    longitude: target.longitude,
    tempC: cur.temperature_2m ?? 0,
    feelsLikeC: cur.apparent_temperature ?? cur.temperature_2m ?? 0,
    humidity: Math.round(cur.relative_humidity_2m ?? 0),
    windKmh: Math.round(cur.wind_speed_10m ?? 0),
    precipMm: Number((cur.precipitation ?? 0).toFixed(1)),
    precipChance: Math.round(currentHourChance),
    condition: mappedCurrent.kind,
    conditionLabel: mappedCurrent.label,
    isDay: (cur.is_day ?? 1) === 1,
    fetchedAt: new Date().toISOString(),
    hourly,
    daily,
    source: target.source,
    countryCode: geoInfo.countryCode,
  };
}

export async function searchWeatherCities(query: string): Promise<CitySearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const resp = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      q
    )}&count=5&language=en&format=json`
  );
  if (!resp.ok) return [];
  const data = (await resp.json()) as {
    results?: Array<{
      id: number;
      name: string;
      admin1?: string;
      country?: string;
      country_code?: string;
      latitude: number;
      longitude: number;
    }>;
  };
  return (data.results || []).map((r) => ({
    id: r.id,
    name: r.name,
    region: r.admin1 || '',
    country: r.country || '',
    countryCode:
      typeof r.country_code === 'string' &&
      /^[A-Za-z]{2}$/.test(r.country_code.trim())
        ? r.country_code.trim().toUpperCase()
        : undefined,
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}

export function useWeatherForecast() {
  const [status, setStatus] = useState<WeatherLocationStatus>(() => {
    if (typeof window === 'undefined') return 'unasked';
    const consent = localStorage.getItem(CONSENT_KEY);
    if (consent === 'denied') return 'denied';
    if (consent === 'granted') return 'loading';
    return 'unasked';
  });
  const [forecast, setForecast] = useState<WeatherForecastData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [promptDismissed, setPromptDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(PROMPT_DISMISSED_KEY) === '1';
  });
  const [targetCoords, setTargetCoords] = useState<StoredLocationTarget | null>(
    () => {
      if (typeof window === 'undefined') return null;
      try {
        const raw = localStorage.getItem(SAVED_COORDS_KEY);
        return raw ? (JSON.parse(raw) as StoredLocationTarget) : null;
      } catch {
        return null;
      }
    }
  );

  const loadForTarget = useCallback(async (target: StoredLocationTarget) => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const data = await fetchOpenMeteoForecast(target);
      setForecast(data);
      setTargetCoords(target);
      setStatus('ready');
      try {
        localStorage.setItem(CONSENT_KEY, 'granted');
        localStorage.setItem(SAVED_COORDS_KEY, JSON.stringify(target));
      } catch {
        // Ignore storage quota errors
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Could not load local weather forecast.'
      );
    }
  }, []);

  const requestLocationAndForecast = useCallback(async () => {
    setStatus('loading');
    setErrorMessage(null);
    setPromptDismissed(true);
    try {
      localStorage.setItem(PROMPT_DISMISSED_KEY, '1');
    } catch {
      // Ignore
    }

    const resolveViaIpAfterConsent = async () => {
      try {
        const resp = await fetch('https://get.geojs.io/v1/ip/geo.json');
        if (!resp.ok) throw new Error('Location service unavailable');
        const geo = (await resp.json()) as {
          latitude?: string;
          longitude?: string;
          city?: string;
          region?: string;
          country?: string;
          country_code?: string;
        };
        const lat = Number(geo.latitude);
        const lon = Number(geo.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          throw new Error('Could not resolve coordinates');
        }
        const region = [geo.region, geo.country].filter(Boolean).join(', ');
        const countryCode =
          typeof geo.country_code === 'string' &&
          /^[A-Za-z]{2}$/.test(geo.country_code.trim())
            ? geo.country_code.trim().toUpperCase()
            : undefined;
        await loadForTarget({
          latitude: lat,
          longitude: lon,
          locationName: geo.city || geo.region || 'Local Area',
          regionLabel: region,
          countryCode,
          source: 'ip',
        });
      } catch {
        setStatus('error');
        setErrorMessage(
          'Could not determine your device location automatically. You can pick a city in Preferences.'
        );
      }
    };

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      await resolveViaIpAfterConsent();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void loadForTarget({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          source: 'gps',
        });
      },
      (geoErr) => {
        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          setStatus('denied');
          setErrorMessage(
            'Location permission was denied. You can allow it in your browser or set a city manually in Preferences.'
          );
          try {
            localStorage.setItem(CONSENT_KEY, 'denied');
          } catch {
            // Ignore
          }
          return;
        }
        // POSITION_UNAVAILABLE / TIMEOUT (common in unpackaged Electron): fallback to geojs ONLY after user clicked Allow
        void resolveViaIpAfterConsent();
      },
      {
        enableHighAccuracy: true,
        timeout: 9000,
        maximumAge: 5 * 60 * 1000,
      }
    );
  }, [loadForTarget]);

  const setManualCity = useCallback(
    async (city: CitySearchResult) => {
      setPromptDismissed(true);
      try {
        localStorage.setItem(PROMPT_DISMISSED_KEY, '1');
      } catch {
        // Ignore
      }
      const regionParts = [city.region, city.country].filter(Boolean);
      await loadForTarget({
        latitude: city.latitude,
        longitude: city.longitude,
        locationName: city.name,
        regionLabel: regionParts.join(', '),
        countryCode: city.countryCode,
        source: 'manual',
      });
    },
    [loadForTarget]
  );

  const refreshForecast = useCallback(async () => {
    if (targetCoords) {
      await loadForTarget(targetCoords);
      return;
    }
    await requestLocationAndForecast();
  }, [targetCoords, loadForTarget, requestLocationAndForecast]);

  const dismissLocationPrompt = useCallback(() => {
    setPromptDismissed(true);
    try {
      localStorage.setItem(PROMPT_DISMISSED_KEY, '1');
    } catch {
      // Ignore
    }
  }, []);

  const disableLocationWeather = useCallback(() => {
    setForecast(null);
    setTargetCoords(null);
    setErrorMessage(null);
    setStatus('unasked');
    try {
      localStorage.removeItem(CONSENT_KEY);
      localStorage.removeItem(SAVED_COORDS_KEY);
    } catch {
      // Ignore
    }
  }, []);

  const applyCloudWeatherLocation = useCallback(
    (cloudTarget: StoredLocationTarget | null) => {
      if (!cloudTarget) {
        setTargetCoords((prev) => {
          if (!prev) return prev;
          setForecast(null);
          setErrorMessage(null);
          setStatus('unasked');
          try {
            localStorage.removeItem(CONSENT_KEY);
            localStorage.removeItem(SAVED_COORDS_KEY);
          } catch {
            // Ignore
          }
          return null;
        });
        return;
      }

      setPromptDismissed(true);
      try {
        localStorage.setItem(PROMPT_DISMISSED_KEY, '1');
      } catch {
        // Ignore
      }
      setTargetCoords((prev) => {
        if (
          prev &&
          Math.abs(prev.latitude - cloudTarget.latitude) < 0.0001 &&
          Math.abs(prev.longitude - cloudTarget.longitude) < 0.0001 &&
          (prev.locationName || '') === (cloudTarget.locationName || '') &&
          prev.source === cloudTarget.source
        ) {
          return prev;
        }
        void loadForTarget(cloudTarget);
        return cloudTarget;
      });
    },
    [loadForTarget]
  );

  // Load automatically on mount ONLY if user previously granted location/city consent
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const consent = localStorage.getItem(CONSENT_KEY);
    if (consent !== 'granted') return;

    if (targetCoords) {
      void loadForTarget(targetCoords);
    } else {
      void requestLocationAndForecast();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh live weather every 15 minutes while active
  useEffect(() => {
    if (status !== 'ready' || !targetCoords) return;
    const id = window.setInterval(() => {
      void loadForTarget(targetCoords);
    }, 15 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [status, targetCoords, loadForTarget]);

  const shouldPromptUser =
    status === 'unasked' && !promptDismissed && forecast === null;

  return {
    status,
    forecast,
    weatherLocation: targetCoords,
    errorMessage,
    shouldPromptUser,
    requestLocationAndForecast,
    refreshForecast,
    setManualCity,
    dismissLocationPrompt,
    disableLocationWeather,
    applyCloudWeatherLocation,
  };
}
