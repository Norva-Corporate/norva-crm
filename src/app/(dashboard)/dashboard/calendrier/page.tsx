import React from "react";
import { getCalendarEvents } from "@/lib/actions/calendar";
import { CalendarClient } from "@/components/calendar/calendar-client";

export const dynamic = "force-dynamic";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function parseMonth(param: string | undefined): { year: number; month: number } {
  const now = new Date();
  if (!param || !/^\d{4}-\d{2}$/.test(param)) {
    return { year: now.getFullYear(), month: now.getMonth() };
  }
  const [y, m] = param.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) {
    return { year: now.getFullYear(), month: now.getMonth() };
  }
  return { year: y, month: m - 1 };
}

function gridRange(year: number, month: number) {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startWeekday);
  const gridEnd = new Date(gridStart);
  gridEnd.setDate(gridStart.getDate() + 41);
  return {
    fromISO: `${gridStart.getFullYear()}-${pad(gridStart.getMonth() + 1)}-${pad(
      gridStart.getDate()
    )}`,
    toISO: `${gridEnd.getFullYear()}-${pad(gridEnd.getMonth() + 1)}-${pad(
      gridEnd.getDate()
    )}`,
  };
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const { year, month } = parseMonth(params.month);
  const { fromISO, toISO } = gridRange(year, month);
  const events = await getCalendarEvents(fromISO, toISO);

  return (
    <div className="flex flex-col flex-1">
      <CalendarClient year={year} month={month} events={events} />
    </div>
  );
}
