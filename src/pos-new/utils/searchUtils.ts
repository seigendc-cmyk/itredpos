export function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function matchesFreeOrderSearch<TRecord>(
  record: TRecord,
  query: string,
  searchableFields: Array<keyof TRecord | ((item: TRecord) => unknown)>
): boolean {
  const words = normalizeSearchText(query).split(' ').filter(Boolean);
  if (words.length === 0) return true;

  const combined = searchableFields
    .map((field) => {
      if (typeof field === 'function') return field(record);
      return record[field];
    })
    .map(normalizeSearchText)
    .join(' ');

  return words.every((word) => combined.includes(word));
}
