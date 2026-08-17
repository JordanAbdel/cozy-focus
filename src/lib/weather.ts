const SYDNEY = { latitude: -33.8688, longitude: 151.2093, timezone: "Australia/Sydney" };

// WMO weather codes -> short human label (https://open-meteo.com/en/docs)
function describe(code: number): string {
  if (code === 0) return "clear sky";
  if (code === 1) return "mostly clear";
  if (code === 2) return "partly cloudy";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return "fog";
  if (code === 51 || code === 53) return "light drizzle";
  if (code === 55) return "dense drizzle";
  if (code === 56 || code === 57) return "freezing drizzle";
  if (code === 61) return "light rain";
  if (code === 63) return "rain";
  if (code === 65) return "heavy rain";
  if (code === 66 || code === 67) return "freezing rain";
  if (code === 71 || code === 73) return "snow";
  if (code === 75) return "heavy snow";
  if (code === 77) return "snow grains";
  if (code === 80) return "light showers";
  if (code === 81) return "showers";
  if (code === 82) return "heavy showers";
  if (code === 85 || code === 86) return "snow showers";
  if (code === 95) return "thunderstorm";
  if (code === 96 || code === 99) return "thunderstorm with hail";
  return "overcast";
}

export interface WeatherNow {
  tempC: number;
  description: string;
}

export async function fetchSydneyWeather(): Promise<WeatherNow> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${SYDNEY.latitude}&longitude=${SYDNEY.longitude}&current=temperature_2m,weather_code&timezone=${encodeURIComponent(SYDNEY.timezone)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`weather fetch failed: ${res.status}`);
  const data = await res.json();
  return {
    tempC: Math.round(data.current.temperature_2m),
    description: describe(data.current.weather_code),
  };
}
