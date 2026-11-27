import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  detectUserCountryCode,
  FALLBACK_COUNTRIES,
  fetchAvailableHolidayCountries,
  fetchLocalizedHolidaysForYear,
  getCountryDisplayName,
  getCountryFlagEmoji,
  normalizeCountryCode,
  normalizeHolidayCountryPref,
  resolveIpCountryFallback,
  type HolidayCountryOption,
  type LocalizedHoliday,
} from '../services/holidayService';
import { toLocalDateKey } from '../utils/occurrenceExclusions';

interface UseLocalizedHolidaysOptions {
  enabled: boolean;
  countryPreference: string;
  weatherCountryCode?: string | null;
  visibleYears: number[];
}

export function useLocalizedHolidays({
  enabled,
  countryPreference,
  weatherCountryCode,
  visibleYears,
}: UseLocalizedHolidaysOptions) {
  const initialDetection = detectUserCountryCode(weatherCountryCode);
  const [ipCountryCode, setIpCountryCode] = useState<string | null>(null);
  const [availableCountries, setAvailableCountries] =
    useState<HolidayCountryOption[]>(FALLBACK_COUNTRIES);
  const [holidaysByDate, setHolidaysByDate] = useState<
    Map<string, LocalizedHoliday[]>
  >(() => new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<
    'nager' | 'openholidays' | 'cache' | null
  >(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [forceNextRefresh, setForceNextRefresh] = useState(false);

  // If timezone + browser locale were both ambiguous (e.g. UTC + generic locale),
  // quietly resolve country code via lightweight GeoJS IP country lookup once.
  useEffect(() => {
    const syncDetection = detectUserCountryCode(weatherCountryCode);
    if (syncDetection.confident || ipCountryCode) return;

    let active = true;
    void resolveIpCountryFallback().then((code) => {
      if (active && code) {
        setIpCountryCode(code);
      }
    });
    return () => {
      active = false;
    };
  }, [weatherCountryCode, ipCountryCode]);

  // Load up-to-date list of available countries for Preferences dropdown
  useEffect(() => {
    let active = true;
    void fetchAvailableHolidayCountries().then((countries) => {
      if (active && countries.length > 0) {
        setAvailableCountries(countries);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const detectedCountryCode = useMemo(() => {
    const syncDetection = detectUserCountryCode(weatherCountryCode);
    if (syncDetection.confident) {
      return syncDetection.countryCode;
    }
    return ipCountryCode || initialDetection.countryCode || syncDetection.countryCode;
  }, [weatherCountryCode, ipCountryCode, initialDetection.countryCode]);

  const normalizedPref = useMemo(
    () => normalizeHolidayCountryPref(countryPreference),
    [countryPreference]
  );

  const effectiveCountryCode = useMemo(() => {
    if (normalizedPref !== 'AUTO') {
      return normalizeCountryCode(normalizedPref) || detectedCountryCode;
    }
    return detectedCountryCode;
  }, [normalizedPref, detectedCountryCode]);

  const detectedCountryName = useMemo(
    () => getCountryDisplayName(detectedCountryCode),
    [detectedCountryCode]
  );

  const effectiveCountryName = useMemo(
    () => getCountryDisplayName(effectiveCountryCode),
    [effectiveCountryCode]
  );

  const effectiveCountryFlag = useMemo(
    () => getCountryFlagEmoji(effectiveCountryCode),
    [effectiveCountryCode]
  );

  const uniqueYearsKey = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const set = new Set<number>([currentYear, ...visibleYears]);
    return Array.from(set)
      .filter((y) => Number.isInteger(y) && y >= 1970 && y <= 2100)
      .sort((a, b) => a - b)
      .join(',');
  }, [visibleYears]);

  useEffect(() => {
    if (!enabled) {
      setHolidaysByDate(new Map());
      setError(null);
      setLoading(false);
      return;
    }

    const years = uniqueYearsKey
      .split(',')
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n));
    if (years.length === 0) return;

    let active = true;
    setLoading(true);
    setError(null);
    const shouldForce = forceNextRefresh;
    if (shouldForce) {
      setForceNextRefresh(false);
    }

    void Promise.allSettled(
      years.map((year) =>
        fetchLocalizedHolidaysForYear(year, effectiveCountryCode, {
          forceRefresh: shouldForce,
        })
      )
    ).then((results) => {
      if (!active) return;

      const nextMap = new Map<string, LocalizedHoliday[]>();
      let latestFetchedAt: string | null = null;
      let latestSource: 'nager' | 'openholidays' | 'cache' | null = null;
      let successCount = 0;

      for (const res of results) {
        if (res.status !== 'fulfilled') continue;
        successCount++;
        if (
          !latestFetchedAt ||
          res.value.fetchedAt.localeCompare(latestFetchedAt) > 0
        ) {
          latestFetchedAt = res.value.fetchedAt;
          latestSource = res.value.source;
        }
        for (const h of res.value.holidays) {
          const existing = nextMap.get(h.date) ?? [];
          if (
            !existing.some(
              (item) =>
                item.localName.toLowerCase() === h.localName.toLowerCase()
            )
          ) {
            existing.push(h);
            nextMap.set(h.date, existing);
          }
        }
      }

      if (successCount === 0) {
        setError(
          `Holiday data is temporarily unavailable for ${effectiveCountryName}.`
        );
      } else {
        setHolidaysByDate(nextMap);
        setLastUpdatedAt(latestFetchedAt);
        setDataSource(latestSource);
      }
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [
    enabled,
    effectiveCountryCode,
    effectiveCountryName,
    uniqueYearsKey,
    refreshToken,
    forceNextRefresh,
  ]);

  const refreshHolidays = useCallback(async () => {
    setForceNextRefresh(true);
    setRefreshToken((n) => n + 1);
  }, []);

  const todayHoliday = useMemo(() => {
    if (!enabled) return null;
    const key = toLocalDateKey(new Date());
    const list = holidaysByDate.get(key);
    return list && list.length > 0 ? list[0] : null;
  }, [enabled, holidaysByDate]);

  const loadedHolidayCount = useMemo(() => {
    let count = 0;
    holidaysByDate.forEach((list) => {
      count += list.length;
    });
    return count;
  }, [holidaysByDate]);

  return {
    detectedCountryCode,
    detectedCountryName,
    effectiveCountryCode,
    effectiveCountryName,
    effectiveCountryFlag,
    holidaysByDate,
    todayHoliday,
    availableCountries,
    loadedHolidayCount,
    loading,
    error,
    lastUpdatedAt,
    dataSource,
    refreshHolidays,
  };
}
