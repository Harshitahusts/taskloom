import { pad, shiftDate } from "./tasks";

export type ExtractedTask = {
  id: string;
  title: string;
  date: string;
  time: string;
  /** True when the time came from the text rather than a fallback slot. */
  timeDetected: boolean;
};

const fallbackTimes = ["09:00", "11:00", "13:00", "15:00", "17:00", "19:00"];

function parseRoutineTime(text: string, index: number): { time: string; detected: boolean } {
  const meridiemMatch = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  const plainMatch = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  const match = meridiemMatch || plainMatch;
  if (match) {
    let hour = Number(match[1]);
    const minute = match[2] || "00";
    const meridiem = meridiemMatch ? match[3]?.toLowerCase() : undefined;
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    if (hour >= 0 && hour <= 23 && Number(minute) <= 59) return { time: `${pad(hour)}:${minute}`, detected: true };
  }
  const lower = text.toLowerCase();
  if (lower.includes("after lunch")) return { time: "13:30", detected: true };
  if (lower.includes("after dinner")) return { time: "20:00", detected: true };
  if (lower.includes("breakfast")) return { time: "08:00", detected: true };
  if (lower.includes("morning")) return { time: "09:00", detected: true };
  if (lower.includes("lunch") || lower.includes("afternoon")) return { time: "13:00", detected: true };
  if (lower.includes("evening")) return { time: "18:00", detected: true };
  if (lower.includes("dinner")) return { time: "19:00", detected: true };
  if (lower.includes("night")) return { time: "21:00", detected: true };
  return { time: fallbackTimes[index % fallbackTimes.length], detected: false };
}

function parseRoutineDate(text: string, baseDate: string) {
  const lower = text.toLowerCase();
  if (lower.includes("day after tomorrow")) return shiftDate(baseDate, 2);
  if (lower.includes("tomorrow")) return shiftDate(baseDate, 1);
  return baseDate;
}

/** Local, rule-based routine parser. One item per line (or `;`). Nothing leaves the browser. */
export function parseRoutine(routineText: string, baseDate: string): ExtractedTask[] {
  return routineText
    .split(/[\n;]+/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter(Boolean)
    .map((line, index) => {
      const { time, detected } = parseRoutineTime(line, index);
      const date = parseRoutineDate(line, baseDate);
      const title = line
        .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, "")
        .replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g, "")
        .replace(/\b(?:day after tomorrow|today|tomorrow)\b/gi, "")
        .replace(/\b(?:after|before)\s+(?:breakfast|lunch|dinner|work)\b\s*,?/gi, "")
        .replace(/\b(?:in the (?:morning|afternoon|evening)|at night)\b/gi, "")
        .replace(/^\s*(?:at|around|by|then|after that)\s+/i, "")
        .replace(/\s{2,}/g, " ")
        .replace(/^[\s,:-]+|[\s,:-]+$/g, "")
        .trim();
      const clean = title || line;
      return { id: `r${index}`, title: clean.charAt(0).toUpperCase() + clean.slice(1), date, time, timeDetected: detected };
    })
    .filter((task) => task.title.length > 1)
    .slice(0, 50);
}
