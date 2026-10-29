const OPERATING_DAY_ALIASES = [
  ['monday', 'mon'],
  ['tuesday', 'tue'],
  ['wednesday', 'wed'],
  ['thursday', 'thu'],
  ['friday', 'fri'],
  ['saturday', 'sat'],
  ['sunday', 'sun'],
] as const;

const OPERATING_DAY_PATTERN = /\b(mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/gi;

export function parseOperatingDays(daysOpen: string): number[] {
  if (/\b(?:daily|every\s+day|all\s+days)\b/i.test(daysOpen)) {
    return OPERATING_DAY_ALIASES.map((_, index) => index);
  }

  const matches = [...daysOpen.matchAll(OPERATING_DAY_PATTERN)];
  const selectedDays = new Set<number>();
  const dayIndex = (day: string) =>
    OPERATING_DAY_ALIASES.findIndex(([fullName, shortName]) =>
      day.toLowerCase() === fullName || day.toLowerCase() === shortName,
    );

  matches.forEach((match, index) => {
    const startDay = dayIndex(match[0]);
    selectedDays.add(startDay);

    const nextMatch = matches[index + 1];
    if (!nextMatch) return;

    const separator = daysOpen.slice(match.index! + match[0].length, nextMatch.index);
    if (!/^\s*(?:to|[-–—])\s*$/i.test(separator)) return;

    const endDay = dayIndex(nextMatch[0]);
    for (let day = startDay; day !== endDay; day = (day + 1) % OPERATING_DAY_ALIASES.length) {
      selectedDays.add((day + 1) % OPERATING_DAY_ALIASES.length);
    }
  });

  return [...selectedDays].sort((first, second) => first - second);
}
