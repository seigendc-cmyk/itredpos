export function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function tokenizeSearchQuery(query: string): string[] {
  return normalizeSearchText(query).split(' ').filter(Boolean);
}

export function matchesFreeOrderSearch<TRecord>(
  record: TRecord,
  query: string,
  searchableFields: Array<keyof TRecord | ((item: TRecord) => unknown)>
): boolean {
  const words = tokenizeSearchQuery(query);
  if (words.length === 0) return true;

  const combined = searchableFields
    .map((field) => {
      if (typeof field === 'function') return field(record);
      return record[field];
    })
    .map(normalizeSearchText)
    .flatMap((value) => [value, value.replace(/\s+/g, '')])
    .join(' ');

  return words.every((word) => combined.includes(word));
}
