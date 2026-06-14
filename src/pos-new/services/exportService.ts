export interface CsvColumn<T extends Record<string, unknown> = Record<string, unknown>> {
  key: keyof T | string;
  header: string;
}

export function sanitizeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = value instanceof Date ? value.toISOString() : String(value);
  const normalized = text.replace(/\r?\n|\r/g, ' ').trim();
  if (/[",]/.test(normalized)) return `"${normalized.replace(/"/g, '""')}"`;
  return normalized;
}

export function buildCsvBlob(rows: string[][]): string {
  return rows.map((row) => row.map(sanitizeCsvValue).join(',')).join('\r\n');
}

export function downloadCsv(filename: string, csv: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportRowsToCsv<T extends Record<string, unknown>>(filename: string, columns: CsvColumn<T>[], rows: T[]): void {
  const csvRows = [
    columns.map((column) => column.header),
    ...rows.map((row) => columns.map((column) => row[column.key]))
  ];
  downloadCsv(filename, buildCsvBlob(csvRows));
}
