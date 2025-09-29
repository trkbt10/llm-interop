/**
 * @file Gateway provider balancing utilities.
 */
import type { GatewayConfig, GatewayBackendConfig } from "./types";

/** Handler used to proxy requests to a specific backend. */
export type ProviderFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** Lease representing an active backend allocation. */
export type ProviderLease = {
  config: GatewayBackendConfig;
  handler: ProviderFetch;
  maxConcurrency: number;
  activeCount(): number;
  release(): void;
};

type ProviderState = {
  config: GatewayBackendConfig;
  handler: ProviderFetch;
  weight: number;
  maxConcurrency: number;
  activeCount: number;
};

type PendingRequest = {
  resolve: (lease: ProviderLease) => void;
  reject: (error: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
  preferredIds?: string[];
  allowFallback: boolean;
};

/** Options controlling how the balancer selects backends. */
export type AcquireOptions = {
  preferredBackendIds?: string[];
  allowFallback?: boolean;
};

function sanitizeWeight(weight: number | undefined): number {
  if (typeof weight !== "number") {
    return 1;
  }
  if (Number.isNaN(weight) || weight <= 0) {
    return 1;
  }
  return weight;
}

function sanitizeMaxConcurrency(limit: number | undefined): number {
  if (limit === undefined) {
    return Number.POSITIVE_INFINITY;
  }
  if (!Number.isFinite(limit) || limit <= 0) {
    return 0;
  }
  return limit;
}

function toTimeout(timeout: number | undefined): number | undefined {
  if (timeout === undefined) {
    return undefined;
  }
  if (!Number.isFinite(timeout) || timeout <= 0) {
    return undefined;
  }
  return timeout;
}

function once(fn: () => void): () => void {
  const state = { called: false };
  return () => {
    if (state.called) {
      return;
    }
    state.called = true;
    fn();
  };
}

function buildProviderStates(
  config: GatewayConfig,
  createHandler: (backend: GatewayBackendConfig) => ProviderFetch,
): ProviderState[] {
  const states: ProviderState[] = [];

  for (const backend of Object.values(config.backends)) {
    const weight = sanitizeWeight(backend.weight);
    const maxConcurrency = sanitizeMaxConcurrency(backend.maxConcurrency);

    if (maxConcurrency === 0) {
      continue;
    }

    states.push({
      config: backend,
      handler: createHandler(backend),
      weight,
      maxConcurrency,
      activeCount: 0,
    });
  }

  if (states.length === 0) {
    throw new Error("Gateway must be configured with at least one backend that has positive weight and concurrency.");
  }

  return states;
}

function selectBackend(states: ProviderState[], allowedIds?: Set<string>): ProviderState | undefined {
  const available = states.filter((backend) => {
    if (backend.activeCount >= backend.maxConcurrency) {
      return false;
    }
    if (!allowedIds) {
      return true;
    }
    return allowedIds.has(backend.config.id);
  });

  if (available.length === 0) {
    return undefined;
  }

  const totalWeight = available.reduce((sum, backend) => sum + backend.weight, 0);
  const threshold = Math.random() * (totalWeight > 0 ? totalWeight : available.length);

  const selection = available.reduce<{ remaining: number; chosen?: ProviderState }>((state, backend, index) => {
    if (state.chosen) {
      return state;
    }
    const step = totalWeight > 0 ? backend.weight : 1;
    const nextRemaining = state.remaining + step;
    if (threshold <= nextRemaining || index === available.length - 1) {
      backend.activeCount += 1;
      return { chosen: backend, remaining: nextRemaining };
    }
    return { chosen: undefined, remaining: nextRemaining };
  }, { remaining: 0, chosen: undefined });

  return selection.chosen;
}

function createLease(
  backend: ProviderState,
  releaseBackend: (backendState: ProviderState) => void,
): ProviderLease {
  const release = once(() => releaseBackend(backend));

  return {
    config: backend.config,
    handler: backend.handler,
    maxConcurrency: backend.maxConcurrency,
    activeCount: () => backend.activeCount,
    release,
  } satisfies ProviderLease;
}

/**
 * Creates a balancer that enforces backend weights and concurrency constraints.
 */
export function createProviderBalancer(
  config: GatewayConfig,
  createHandler: (backend: GatewayBackendConfig) => ProviderFetch,
) {
  const states = buildProviderStates(config, createHandler);
  const pendingQueue: PendingRequest[] = [];
  const acquireTimeout = toTimeout(config.routing?.acquireTimeoutMs);

  function releaseBackend(backend: ProviderState) {
    backend.activeCount = Math.max(0, backend.activeCount - 1);
    drainQueue();
  }

  function drainQueue() {
    if (pendingQueue.length === 0) {
      return;
    }

    const deferred: PendingRequest[] = [];

    pendingQueue.forEach((entry) => {
      const preferredSet = entry.preferredIds?.length ? new Set(entry.preferredIds) : undefined;
      const candidate = preferredSet ? selectBackend(states, preferredSet) : undefined;
      const backend = candidate ?? (entry.allowFallback ? selectBackend(states) : undefined);

      if (!backend) {
        deferred.push(entry);
        return;
      }

      if (entry.timer) {
        clearTimeout(entry.timer);
      }

      entry.resolve(createLease(backend, releaseBackend));
    });

    pendingQueue.length = 0;
    pendingQueue.push(...deferred);
  }

  function removePending(entry: PendingRequest) {
    const index = pendingQueue.indexOf(entry);
    if (index >= 0) {
      pendingQueue.splice(index, 1);
    }
  }

  async function acquire(options?: AcquireOptions): Promise<ProviderLease> {
    const preferredIds = options?.preferredBackendIds?.map((id) => id.toLowerCase());
    const preferredSet = preferredIds?.length ? new Set(preferredIds) : undefined;
    const allowFallback = options?.allowFallback ?? true;

    if (preferredSet) {
      const preferredBackend = selectBackend(states, preferredSet);
      if (preferredBackend) {
        return createLease(preferredBackend, releaseBackend);
      }
      if (!allowFallback) {
        return new Promise((resolve, reject) => {
          queuePending({ resolve, reject }, preferredIds, allowFallback);
        });
      }
    }

    const backend = selectBackend(states);
    if (backend) {
      return createLease(backend, releaseBackend);
    }

    return new Promise((resolve, reject) => {
      queuePending({ resolve, reject }, preferredIds, allowFallback);
    });
  }

  function queuePending(
    handlers: { resolve: (lease: ProviderLease) => void; reject: (error: Error) => void },
    preferredIds: string[] | undefined,
    allowFallback: boolean,
  ) {
    const state = { settled: false };
    const entry: PendingRequest = {
      preferredIds,
      allowFallback,
      resolve(lease) {
        if (state.settled) {
          return;
        }
        state.settled = true;
        if (entry.timer) {
          clearTimeout(entry.timer);
        }
        handlers.resolve(lease);
      },
      reject(error) {
        if (state.settled) {
          return;
        }
        state.settled = true;
        if (entry.timer) {
          clearTimeout(entry.timer);
        }
        handlers.reject(error);
      },
    };

    if (typeof acquireTimeout === "number") {
      entry.timer = setTimeout(() => {
        removePending(entry);
        const timeoutError = new Error("Timed out waiting for an available backend");
        timeoutError.name = "GatewayAcquireTimeout";
        entry.reject(timeoutError);
      }, acquireTimeout);
    }

    pendingQueue.push(entry);
    drainQueue();
  }

  return {
    acquire,
  };
}
