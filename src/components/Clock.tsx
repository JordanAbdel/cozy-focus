import { useEffect, useState } from "react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function format(date: Date) {
  const hours24 = date.getHours();
  const hours = ((hours24 + 11) % 12) + 1;
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const time = `${hours}:${minutes}`;
  const dateLine = `${DAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return { time, dateLine };
}

export function useClock() {
  const [display, setDisplay] = useState(() => format(new Date()));
  useEffect(() => {
    const id = window.setInterval(() => {
      setDisplay((prev) => {
        const next = format(new Date());
        return next.time === prev.time && next.dateLine === prev.dateLine ? prev : next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, []);
  return display;
}
