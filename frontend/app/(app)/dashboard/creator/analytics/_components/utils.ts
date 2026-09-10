export function extractNodes<T>(data: unknown, collectionKey: string): T[] {
    const source = data as Record<string, { edges?: Array<{ node?: T | null }> } | undefined>;
    return (source?.[collectionKey]?.edges || []).map((edge) => edge?.node).filter((node): node is T => Boolean(node));
}

export function toCsv(rows: Array<Record<string, string | number | boolean | null | undefined>>): string {
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]);
    const escapeCell = (value: string | number | boolean | null | undefined) => {
        const text = value == null ? '' : String(value);
        return `"${text.replace(/"/g, '""')}"`;
    };

    return [headers.join(','), ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(','))].join(
        '\n',
    );
}

export function downloadCsv(
    filename: string,
    rows: Array<Record<string, string | number | boolean | null | undefined>>,
): void {
    const content = toCsv(rows);
    if (!content) return;

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

export function toMinuteString(seconds: number): string {
    const minutes = seconds / 60;
    return `${minutes.toFixed(1)} min`;
}

export function getDateRangeFromPreset(preset: '7d' | '30d' | '90d', end: Date): Date {
    const start = new Date(end);
    if (preset === '7d') start.setDate(end.getDate() - 6);
    if (preset === '30d') start.setDate(end.getDate() - 29);
    if (preset === '90d') start.setDate(end.getDate() - 89);
    start.setHours(0, 0, 0, 0);
    return start;
}
