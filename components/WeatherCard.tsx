import React, { useEffect, useState, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

interface DayForecast {
  date: string;
  maxTemp: number;
  minTemp: number;
  code: number;
}

interface WeatherData {
  city: string;
  country?: string;
  temperature: number;
  feelsLike?: number;
  humidity?: number;
  windSpeed: number;
  weatherCode: number;
  unit: 'celsius' | 'fahrenheit';
  daily: DayForecast[];
}

const WMO_DESCRIPTIONS: Record<number, { label: string; icon: string }> = {
  0:  { label: 'Clear sky',       icon: 'sunny-outline' },
  1:  { label: 'Mainly clear',    icon: 'partly-sunny-outline' },
  2:  { label: 'Partly cloudy',   icon: 'partly-sunny-outline' },
  3:  { label: 'Overcast',        icon: 'cloud-outline' },
  45: { label: 'Foggy',           icon: 'cloud-outline' },
  48: { label: 'Icy fog',         icon: 'cloud-outline' },
  51: { label: 'Light drizzle',   icon: 'rainy-outline' },
  53: { label: 'Drizzle',         icon: 'rainy-outline' },
  55: { label: 'Heavy drizzle',   icon: 'rainy-outline' },
  61: { label: 'Light rain',      icon: 'rainy-outline' },
  63: { label: 'Rain',            icon: 'rainy-outline' },
  65: { label: 'Heavy rain',      icon: 'rainy-outline' },
  71: { label: 'Light snow',      icon: 'snow-outline' },
  73: { label: 'Snow',            icon: 'snow-outline' },
  75: { label: 'Heavy snow',      icon: 'snow-outline' },
  80: { label: 'Rain showers',    icon: 'rainy-outline' },
  81: { label: 'Rain showers',    icon: 'rainy-outline' },
  82: { label: 'Heavy showers',   icon: 'thunderstorm-outline' },
  95: { label: 'Thunderstorm',    icon: 'thunderstorm-outline' },
  96: { label: 'Thunderstorm',    icon: 'thunderstorm-outline' },
  99: { label: 'Severe storm',    icon: 'thunderstorm-outline' },
};

function wmoInfo(code: number): { label: string; icon: string } {
  return WMO_DESCRIPTIONS[code] ?? { label: 'Unknown', icon: 'cloud-outline' };
}

function shortDay(dateStr: string): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[new Date(dateStr).getUTCDay()];
}

async function fetchWeather(city: string): Promise<WeatherData | null> {
  try {
    // 1. Geocode city
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
    );
    if (!geoRes.ok) return null;
    const geoData = await geoRes.json();
    const loc = geoData.results?.[0];
    if (!loc) return null;

    const { latitude, longitude, name, country } = loc;

    // 2. Fetch weather
    const wxRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
      `&daily=temperature_2m_max,temperature_2m_min,weather_code` +
      `&timezone=auto&forecast_days=4`
    );
    if (!wxRes.ok) return null;
    const wx = await wxRes.json();

    const current = wx.current;
    const daily = wx.daily;

    const days: DayForecast[] = (daily.time || []).slice(1, 4).map((d: string, i: number) => ({
      date: d,
      maxTemp: Math.round(daily.temperature_2m_max[i + 1]),
      minTemp: Math.round(daily.temperature_2m_min[i + 1]),
      code: daily.weather_code[i + 1],
    }));

    return {
      city: name,
      country,
      temperature: Math.round(current.temperature_2m),
      feelsLike: Math.round(current.apparent_temperature),
      humidity: current.relative_humidity_2m,
      windSpeed: Math.round(current.wind_speed_10m),
      weatherCode: current.weather_code,
      unit: 'celsius',
      daily: days,
    };
  } catch {
    return null;
  }
}

interface Props {
  city: string;
  isDark?: boolean;
}

const WeatherCard = memo(function WeatherCard({ city, isDark: isDarkProp }: Props) {
  const { isDark: themeIsDark } = useTheme();
  const isDark = isDarkProp ?? themeIsDark;

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [unit, setUnit] = useState<'C' | 'F'>('C');

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(false);
    fetchWeather(city).then(data => {
      if (!cancelled) {
        if (data) setWeather(data);
        else setError(true);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [city]);

  const toF = (c: number) => Math.round(c * 9 / 5 + 32);
  const displayTemp = (c: number) => unit === 'C' ? `${c}°C` : `${toF(c)}°F`;

  const bg = isDark ? '#1C1C1E' : '#F0F8FF';
  const cardBg = isDark ? '#2C2C2E' : '#FFFFFF';
  const textPrimary = isDark ? '#FFFFFF' : '#000000';
  const textSecondary = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,122,255,0.15)';
  const accentBlue = '#5AC8FA';

  if (loading) {
    return (
      <View style={[s.card, { backgroundColor: bg, borderColor: border }]}>
        <ActivityIndicator size="small" color={accentBlue} style={{ margin: 20 }} />
      </View>
    );
  }

  if (error || !weather) {
    return (
      <View style={[s.card, { backgroundColor: bg, borderColor: border }]}>
        <Ionicons name="cloud-offline-outline" size={24} color={textSecondary} />
        <Text style={[s.errorText, { color: textSecondary }]}>Weather unavailable for "{city}"</Text>
      </View>
    );
  }

  const info = wmoInfo(weather.weatherCode);

  return (
    <View style={[s.card, { backgroundColor: isDark ? '#1A2A3A' : '#EBF4FF', borderColor: border }]}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Ionicons name={info.icon as any} size={28} color={accentBlue} />
          <View style={{ marginLeft: 10 }}>
            <Text style={[s.cityName, { color: textPrimary }]}>{weather.city}{weather.country ? `, ${weather.country}` : ''}</Text>
            <Text style={[s.conditionLabel, { color: textSecondary }]}>{info.label}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => setUnit(u => u === 'C' ? 'F' : 'C')} style={[s.unitToggle, { borderColor: accentBlue + '55' }]}>
          <Text style={{ color: accentBlue, fontSize: 13, fontWeight: '700' }}>°{unit === 'C' ? 'F' : 'C'}</Text>
        </TouchableOpacity>
      </View>

      {/* Main temp */}
      <Text style={[s.bigTemp, { color: textPrimary }]}>{displayTemp(weather.temperature)}</Text>

      {/* Details row */}
      <View style={s.detailsRow}>
        {weather.feelsLike !== undefined && (
          <View style={s.detailItem}>
            <Ionicons name="thermometer-outline" size={14} color={textSecondary} />
            <Text style={[s.detailText, { color: textSecondary }]}>Feels {displayTemp(weather.feelsLike)}</Text>
          </View>
        )}
        {weather.humidity !== undefined && (
          <View style={s.detailItem}>
            <Ionicons name="water-outline" size={14} color={textSecondary} />
            <Text style={[s.detailText, { color: textSecondary }]}>{weather.humidity}% humidity</Text>
          </View>
        )}
        <View style={s.detailItem}>
          <Ionicons name="speedometer-outline" size={14} color={textSecondary} />
          <Text style={[s.detailText, { color: textSecondary }]}>{weather.windSpeed} km/h</Text>
        </View>
      </View>

      {/* 3-day forecast */}
      {weather.daily.length > 0 && (
        <View style={[s.forecastRow, { borderTopColor: border }]}>
          {weather.daily.map((day, i) => {
            const dInfo = wmoInfo(day.code);
            return (
              <View key={i} style={s.forecastItem}>
                <Text style={[s.forecastDay, { color: textSecondary }]}>{shortDay(day.date)}</Text>
                <Ionicons name={dInfo.icon as any} size={18} color={accentBlue} style={{ marginVertical: 4 }} />
                <Text style={[s.forecastMax, { color: textPrimary }]}>{displayTemp(day.maxTemp)}</Text>
                <Text style={[s.forecastMin, { color: textSecondary }]}>{displayTemp(day.minTemp)}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Attribution */}
      <Text style={[s.attribution, { color: textSecondary }]}>Weather data from Open-Meteo • Free & open</Text>
    </View>
  );
});

const s = StyleSheet.create({
  card: {
    marginHorizontal: 14,
    marginVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  cityName: { fontSize: 17, fontWeight: '700' },
  conditionLabel: { fontSize: 13, marginTop: 1 },
  unitToggle: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  bigTemp: { fontSize: 52, fontWeight: '200', marginVertical: 4 },
  detailsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { fontSize: 13 },
  forecastRow: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, paddingTop: 12, marginTop: 4 },
  forecastItem: { alignItems: 'center' },
  forecastDay: { fontSize: 12, fontWeight: '600' },
  forecastMax: { fontSize: 14, fontWeight: '600' },
  forecastMin: { fontSize: 12 },
  attribution: { fontSize: 10, marginTop: 10, textAlign: 'right' },
  errorText: { fontSize: 13, marginTop: 8, textAlign: 'center' },
});

export default WeatherCard;
export { fetchWeather };
