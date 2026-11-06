"use client";

import { useState, useEffect } from "react";

export default function ClockVisualizer({ isTalking }: { isTalking?: boolean }) {
  const [timeData, setTimeData] = useState({ day: "", date: "", time: "" });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();

      // TUESDAY
      const dayStr = now
        .toLocaleDateString("en-US", { weekday: "long" })
        .toUpperCase();

      // 17 MARCH, 2026.
      const day = now.getDate().toString().padStart(2, "0");
      const month = now.toLocaleDateString("en-GB", { month: "long" }).toUpperCase();
      const year = now.getFullYear();
      const dateStr = `${day} ${month}, ${year}.`;

      // 2:23 PM (tanpa nol di depan jam)
      const timeStr = now
        .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
        .toUpperCase();

      setTimeData({ day: dayStr, date: dateStr, time: timeStr });
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
<div className="absolute right-16 top-1/2 -translate-y-1/2 z-[5] pointer-events-none flex flex-col items-center justify-center text-white mix-blend-screen select-none">
      {/* Hari: tipis, lebar, tracking besar */}
      <h1
        className="font-clock text-6xl md:text-[6.5rem] leading-none font-normal tracking-[0.3em] pl-[0.3em]"
        style={{ textShadow: "0 0 12px rgba(255,255,255,0.25)" }}
      >
        {timeData.day}
      </h1>

      {/* Tanggal */}
      <p className="font-[family-name:var(--font-clock-sub)] text-sm md:text-lg font-semibold tracking-[0.12em] word-spacing-wide mt-8 [word-spacing:0.35em]">
        {timeData.date}
      </p>

      {/* Waktu */}
      <p className="font-[family-name:var(--font-clock-sub)] text-xs md:text-base font-semibold tracking-[0.08em] mt-5">
        - {timeData.time} -
      </p>
    </div>
  );
}