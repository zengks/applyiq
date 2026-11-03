'use client';
import { useEffect, useState } from 'react';
import { localDate } from './jobWorkspace';

/** Re-evaluate after sleep, tab switches, timezone changes, and local midnight. */
export function useLocalDay() {
  const [day, setDay] = useState('');
  const [timeZone, setTimeZone] = useState('');
  useEffect(() => {
    const update = () => {
      setDay(localDate());
      setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    };
    update();
    const timer = window.setInterval(update, 30_000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return { day, timeZone };
}
