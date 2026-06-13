export interface FirestoreQueryOptions {
  limit?: number;
  orderBy?: string;
  filters?: Array<{ field: string; operator: string; value: unknown }>;
}

export interface DisabledFirestoreResponse {
  ok: false;
  message: string;
}

export interface FirestoreRepository<TDoc> {
  getById(path: string, id: string): Promise<TDoc | null>;
  list(path: string, queryOptions?: FirestoreQueryOptions): Promise<TDoc[]>;
  create(path: string, data: TDoc): Promise<DisabledFirestoreResponse>;
  update(path: string, id: string, patch: Partial<TDoc>): Promise<DisabledFirestoreResponse>;
  softDelete(path: string, id: string): Promise<DisabledFirestoreResponse>;
}

const disabledMessage = 'Firestore repository is disabled in build-development mode.';

export function createDisabledFirestoreRepository<TDoc>(entityName: string): FirestoreRepository<TDoc> {
  const response = (): DisabledFirestoreResponse => ({
    ok: false,
    message: `${disabledMessage} Entity: ${entityName}.`
  });
  return {
    getById: async () => null,
    list: async () => [],
    create: async () => response(),
    update: async () => response(),
    softDelete: async () => response()
  };
}

