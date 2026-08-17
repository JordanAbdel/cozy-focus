import { useEffect, useState } from "react";
import { fetchSydneyWeather, type WeatherNow } from "./weather";

const REFRESH_MS = 10 * 60 * 1000;

export function useWeather() {
  const [weather, setWeather] = useState<WeatherNow | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchSydneyWeather()
        .then((w) => {
          if (!cancelled) setWeather(w);
        })
        .catch(() => {
          // keep last known reading (or null) on a transient failure
        });
    };
    load();
    const id = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return weather;
}
