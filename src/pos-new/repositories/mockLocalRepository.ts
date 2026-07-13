import type { BaseRepository, RepositoryListResult, RepositoryOperationResult, RepositoryQueryOptions } from './repositoryTypes';

export interface MockLocalRepositoryOptions<T extends { id?: string }> {
  entityName: string;
  initialRows: T[];
  getId?: (row: T) => string;
  setId?: (row: T, id: string) => T;
  persistKey?: string;
}

const canUseLocalStorage = (): boolean => {
  try {
    if (typeof localStorage === 'undefined') return false;
    const key = '__itred_repo_test__';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
};

const makeId = (entityName: string) => `${entityName.replace(/\s+/g, '-').toLowerCase()}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function createMockLocalRepository<T extends { id?: string; deleted?: boolean }>(options: MockLocalRepositoryOptions<T>): BaseRepository<T> {
  const getId = options.getId || ((row: T) => row.id || '');
  const setId = options.setId || ((row: T, id: string) => ({ ...row, id }));
  const sourceMode = options.persistKey ? 'LocalStorage' : 'MockLocal';

  let rows = [...options.initialRows];

  const loadRows = (): T[] => {
    if (!options.persistKey || !canUseLocalStorage()) return rows;
    try {
      const cached = localStorage.getItem(options.persistKey);
      if (!cached) {
        localStorage.setItem(options.persistKey, JSON.stringify(rows));
        return rows;
      }
      const parsed = JSON.parse(cached) as T[];
      rows = Array.isArray(parsed) ? parsed : rows;
      return rows;
    } catch {
      return rows;
    }
  };

  const saveRows = (nextRows: T[]) => {
    rows = nextRows;
    if (!options.persistKey || !canUseLocalStorage()) return;
    try {
      localStorage.setItem(options.persistKey, JSON.stringify(nextRows));
    } catch {
      // Local persistence is best-effort in build-development mode.
    }
  };

  const ok = <TData>(data: TData): RepositoryOperationResult<TData> => ({
    ok: true,
    data,
    status: 'Ready',
    sourceMode,
    warnings: []
  });

  return {
    getById: async (id, context) => {
      const row = loadRows().find((item) => getId(item) === id && (context.includeDeleted || !item.deleted)) || null;
      return ok(row);
    },
    list: async (queryOptions: RepositoryQueryOptions): Promise<RepositoryListResult<T>> => {
      const activeRows = loadRows().filter((row) => queryOptions.includeDeleted || !row.deleted);
      const limitedRows = queryOptions.limit ? activeRows.slice(0, queryOptions.limit) : activeRows;
      return { ok: true, success: true, rows: limitedRows, records: limitedRows, status: 'Ready', sourceMode, warnings: [] };
    },
    create: async (data) => {
      const id = getId(data) || makeId(options.entityName);
      const created = setId(data, id);
      saveRows([created, ...loadRows()]);
      return ok(created);
    },
    update: async (id, patch) => {
      let updated: T | undefined;
      const nextRows = loadRows().map((row) => {
        if (getId(row) !== id) return row;
        updated = { ...row, ...patch };
        return updated;
      });
      saveRows(nextRows);
      if (!updated) return { ok: false, status: 'Error', sourceMode, error: `${options.entityName} not found.` };
      return ok(updated);
    },
    softDelete: async (id) => {
      let deleted: T | undefined;
      const nextRows = loadRows().map((row) => {
        if (getId(row) !== id) return row;
        deleted = { ...row, deleted: true };
        return deleted;
      });
      saveRows(nextRows);
      if (!deleted) return { ok: false, status: 'Error', sourceMode, error: `${options.entityName} not found.` };
      return ok(deleted);
    }
  };
}

