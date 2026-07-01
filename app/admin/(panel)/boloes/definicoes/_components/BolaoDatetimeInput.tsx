"use client";

import {
  isoToDatetimeLocalBr,
  mergeDatetimeLocalBr,
  splitDatetimeLocalBr,
} from "@/lib/client/datetime-local-br";

type Props = {
  value: string;
  onChange: (value: string) => void;
  inputClass: string;
  id?: string;
};

export function BolaoDatetimeInput({ value, onChange, inputClass, id }: Props) {
  const { date, time } = splitDatetimeLocalBr(value);
  const fieldClass = `${inputClass} [color-scheme:dark]`;

  function setDate(nextDate: string) {
    onChange(mergeDatetimeLocalBr(nextDate, time || "00:00"));
  }

  function setTime(nextTime: string) {
    const baseDate =
      date || isoToDatetimeLocalBr(new Date().toISOString()).slice(0, 10);
    if (!nextTime) {
      onChange(date ? mergeDatetimeLocalBr(date, "00:00") : "");
      return;
    }
    onChange(mergeDatetimeLocalBr(baseDate, nextTime));
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <input
        id={id}
        type="date"
        className={fieldClass}
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <input
        type="time"
        className={fieldClass}
        value={time}
        onChange={(e) => setTime(e.target.value)}
        step={60}
      />
    </div>
  );
}
