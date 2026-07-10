/**
 * Timezone helpers for scheduling exams that run internationally.
 *
 * Design: an exam's start/end are stored as absolute UTC instants. We ALSO keep
 * the IANA zone the creator scheduled in (e.g. "America/New_York") so the same
 * moment can be shown, explicitly labeled, in that zone regardless of who views
 * it. All conversions use the native `Intl` APIs — no dependency — and cover the
 * full global IANA database (every country/continent), not a curated subset.
 */

// A small fallback covering major zones on every continent, only used if the
// runtime lacks Intl.supportedValuesOf (very old browsers). The real list is the
// complete IANA database returned by the Intl call below.
const FALLBACK_ZONES = [
    'UTC',
    'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi',
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Sao_Paulo', 'America/Mexico_City', 'America/Toronto', 'America/Bogota',
    'Asia/Kolkata', 'Asia/Kathmandu', 'Asia/Dubai', 'Asia/Karachi', 'Asia/Dhaka',
    'Asia/Bangkok', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Seoul',
    'Australia/Sydney', 'Australia/Perth',
    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow', 'Europe/Istanbul',
    'Pacific/Auckland', 'Pacific/Honolulu',
];

/** Every IANA timezone the runtime knows — the full global list (~418 zones). */
export function getAllTimeZones(): string[] {
    try {
        const supported = (Intl as any).supportedValuesOf?.('timeZone') as
            | string[]
            | undefined;
        if (supported && supported.length) {
            return supported.includes('UTC') ? supported : ['UTC', ...supported];
        }
    } catch {
        /* fall through */
    }
    return FALLBACK_ZONES;
}

/** The viewer's / creator's own detected IANA zone (defaults the picker). */
export function detectTimeZone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
}

/**
 * Offset (in minutes) of `timeZone` at the given instant. Positive = ahead of
 * UTC. Uses Intl so DST is handled for the specific date.
 */
function offsetMinutesAt(instant: Date, timeZone: string): number {
    const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    const parts = dtf.formatToParts(instant);
    const map: Record<string, string> = {};
    for (const p of parts) map[p.type] = p.value;
    // Interpret the zone's wall-clock reading as if it were UTC, then diff.
    const asUtc = Date.UTC(
        Number(map.year),
        Number(map.month) - 1,
        Number(map.day),
        Number(map.hour === '24' ? '00' : map.hour),
        Number(map.minute),
        Number(map.second),
    );
    return Math.round((asUtc - instant.getTime()) / 60000);
}

/**
 * Interpret a `datetime-local` wall-clock string ("YYYY-MM-DDTHH:mm") as a time
 * in `timeZone` and return the absolute UTC instant as an ISO string.
 *
 * Do NOT use `new Date(wallClock)` for this — that assumes the *browser* zone.
 */
export function zonedWallClockToUtcISO(
    wallClock: string,
    timeZone: string,
): string | undefined {
    if (!wallClock) return undefined;
    const [datePart, timePart = '00:00'] = wallClock.split('T');
    const [y, mo, d] = datePart.split('-').map(Number);
    const [h, mi] = timePart.split(':').map(Number);
    if ([y, mo, d, h, mi].some((n) => Number.isNaN(n))) return undefined;

    // First guess: treat the wall clock as UTC, then correct by the zone's
    // offset at that moment. A second pass fixes the rare DST-boundary case
    // where the offset differs between the guessed and corrected instants.
    const guessMs = Date.UTC(y, mo - 1, d, h, mi);
    let instant = new Date(guessMs - offsetMinutesAt(new Date(guessMs), timeZone) * 60000);
    const secondOffset = offsetMinutesAt(instant, timeZone);
    instant = new Date(guessMs - secondOffset * 60000);
    return instant.toISOString();
}

/**
 * Render a UTC ISO instant as a `datetime-local` wall-clock string ("YYYY-MM-
 * DDTHH:mm") in `timeZone` — for prefilling the builder's date input on edit.
 */
export function utcISOToZonedWallClock(iso: string, timeZone: string): string {
    if (!iso) return '';
    const dtf = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
    const parts = dtf.formatToParts(new Date(iso));
    const map: Record<string, string> = {};
    for (const p of parts) map[p.type] = p.value;
    const hour = map.hour === '24' ? '00' : map.hour;
    return `${map.year}-${map.month}-${map.day}T${hour}:${map.minute}`;
}

/**
 * Human display of a UTC instant in a target zone, with the zone abbreviation,
 * e.g. "Mar 5, 2026, 3:00 PM EST". If `timeZone` is falsy, falls back to the
 * viewer's local zone.
 */
export function formatInZone(
    iso: string | Date | null | undefined,
    timeZone?: string | null,
): string {
    if (!iso) return '—';
    const date = typeof iso === 'string' ? new Date(iso) : iso;
    if (Number.isNaN(date.getTime())) return '—';
    try {
        return new Intl.DateTimeFormat(undefined, {
            timeZone: timeZone || undefined,
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short',
        }).format(date);
    } catch {
        return date.toLocaleString();
    }
}

/** Short label for a zone in the picker, e.g. "America/New_York (GMT-5)". */
export function zoneLabel(timeZone: string, at: Date = new Date()): string {
    const off = offsetMinutesAt(at, timeZone);
    const sign = off >= 0 ? '+' : '-';
    const abs = Math.abs(off);
    const hh = String(Math.floor(abs / 60)).padStart(2, '0');
    const mm = String(abs % 60).padStart(2, '0');
    return `${timeZone.replace(/_/g, ' ')} (GMT${sign}${hh}:${mm})`;
}
