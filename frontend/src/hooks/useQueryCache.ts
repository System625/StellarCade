import {
  createElement,
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { QueryCache, QueryCacheInvalidator } from "../services/query-cache-invalidation";

type Ctx = {
  cache: QueryCache;
  invalidator: QueryCacheInvalidator;
};

const QueryCacheContext = createContext<Ctx | null>(null);

interface QueryCacheProviderProps {
  children: ReactNode;
  cache?: QueryCache;
}

export function QueryCacheProvider({ children, cache: cacheOverride }: QueryCacheProviderProps) {
  const ctx = useMemo(() => {
    const cache = cacheOverride ?? new QueryCache();
    const invalidator = new QueryCacheInvalidator(cache);
    return { cache, invalidator };
  }, [cacheOverride]);

  return createElement(QueryCacheContext.Provider, { value: ctx }, children);
}

export function useQueryCache(): Ctx {
  const ctx = useContext(QueryCacheContext);
  if (!ctx) {
    throw new Error(
      "useQueryCache must be used inside <QueryCacheProvider>. Wrap your component tree with the provider.",
    );
  }
  return ctx;
}

export default useQueryCache;
