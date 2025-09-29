/**
 * @file Gateway backend selection resolver utilities.
 */
import { detectModelGrade, type ModelGrade } from "../../model/model-grade-detector";
import { getProviderTypesForFamily } from "../../model/provider-families";
import { detectFamily } from "../../model/normalizer";
import type {
  GatewayBackendConfig,
  GatewayConfig,
  GatewaySelectionConfig,
  GatewaySelectionRule,
} from "./types";

const DEFAULT_PRIORITY: GatewaySelectionRule[] = ["exact", "grade", "provider"];

function normalizeModelId(id?: string): string | undefined {
  if (!id) {
    return undefined;
  }
  return id.trim().toLowerCase();
}

function collectExactModels(backend: GatewayBackendConfig): Set<string> {
  const exact = new Set<string>();
  const record = (id?: string) => {
    const normalized = normalizeModelId(id);
    if (normalized) {
      exact.add(normalized);
    }
  };

  record(backend.provider.model);

  const aliases = backend.provider.modelMapping?.aliases;
  if (aliases) {
    for (const value of Object.values(aliases)) {
      record(value);
    }
  }

  const gradeMapping = backend.provider.modelMapping?.byGrade;
  if (gradeMapping) {
    for (const value of Object.values(gradeMapping)) {
      record(value);
    }
  }

  const hints = backend.models?.exact;
  if (hints) {
    for (const value of hints) {
      record(value);
    }
  }

  return exact;
}

function isModelGrade(value: string): value is ModelGrade {
  return value === "high" || value === "mid" || value === "low";
}

function collectGrades(backend: GatewayBackendConfig, exactModels: Set<string>): Set<ModelGrade> {
  const grades = new Set<ModelGrade>();
  const add = (grade?: ModelGrade) => {
    if (grade) {
      grades.add(grade);
    }
  };

  const configGrades = backend.models?.grades;
  if (configGrades) {
    for (const grade of configGrades) {
      add(grade);
    }
  }

  if (backend.provider.model) {
    add(detectModelGrade(backend.provider.model));
  }

  const mapping = backend.provider.modelMapping?.byGrade;
  if (mapping) {
    for (const [gradeKey, model] of Object.entries(mapping)) {
      if (model && isModelGrade(gradeKey)) {
        add(gradeKey);
      }
    }
  }

  for (const model of exactModels) {
    add(detectModelGrade(model));
  }

  return grades;
}

function normalizeIds(ids: Iterable<string> | undefined): string[] {
  if (!ids) {
    return [];
  }
  const normalizedIds: string[] = [];
  for (const id of ids) {
    const normalized = normalizeModelId(id);
    if (normalized) {
      normalizedIds.push(normalized);
    }
  }
  return normalizedIds;
}

type BackendMetadata = {
  id: string;
  providerType: string;
  exactModels: Set<string>;
  grades: Set<ModelGrade>;
};

type BackendMetadataMap = {
  list: BackendMetadata[];
  byId: Record<string, BackendMetadata>;
};

function buildMetadata(config: GatewayConfig): BackendMetadataMap {
  const list: BackendMetadata[] = [];
  const byId: Record<string, BackendMetadata> = Object.create(null);

  for (const backend of Object.values(config.backends)) {
    const exactModels = collectExactModels(backend);
    const grades = collectGrades(backend, exactModels);
    const providerType = backend.provider.type.toLowerCase();
    const metadata: BackendMetadata = {
      id: backend.id,
      providerType,
      exactModels,
      grades,
    };
    list.push(metadata);
    byId[backend.id] = metadata;
  }

  return { list, byId };
}

function dedupeOrder(ids: string[]): string[] {
  const seen = new Set<string>();
  return ids.filter((id) => {
    if (seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}

function resolveExactMatches(model: string, metadata: BackendMetadataMap): string[] {
  const normalized = normalizeModelId(model);
  if (!normalized) {
    return [];
  }
  return metadata.list
    .filter((backend) => backend.exactModels.has(normalized))
    .map((backend) => backend.id);
}

function resolveGradeMatches(model: string, metadata: BackendMetadataMap): string[] {
  const grade = detectModelGrade(model);
  return metadata.list.filter((backend) => backend.grades.has(grade)).map((backend) => backend.id);
}

function resolveProviderMatches(
  model: string,
  metadata: BackendMetadataMap,
  selection: GatewaySelectionConfig | undefined,
): string[] {
  const family = detectFamily(model);
  const hintedMatches = (() => {
    const hints = selection?.providerHints?.[family];
    if (!hints?.length) {
      return [] as string[];
    }
    return normalizeIds(hints).flatMap((hint) => {
      const backend = metadata.byId[hint];
      if (backend) {
        return [backend.id];
      }
      return metadata.list
        .filter((candidate) => candidate.providerType === hint)
        .map((candidate) => candidate.id);
    });
  })();

  if (hintedMatches.length > 0) {
    return dedupeOrder(hintedMatches);
  }

  const providerTypes = new Set<string>(
    getProviderTypesForFamily(family).map((typeId) => typeId.toLowerCase()),
  );

  const prefix = model.split(/[.:/-]/)[0];
  if (prefix) {
    providerTypes.add(prefix.toLowerCase());
  }

  const providerMatches = metadata.list
    .filter((backend) => providerTypes.has(backend.providerType))
    .map((backend) => backend.id);

  return dedupeOrder(providerMatches);
}

type BackendResolution = {
  preferredBackendIds: string[];
  allowFallbackToAny: boolean;
};

/**
 * Creates a resolver that determines preferred backends for a requested model.
 */
export function createBackendResolver(config: GatewayConfig) {
  const metadata = buildMetadata(config);
  const selection = config.selection;
  const priorityCandidates = selection?.priority?.filter((rule): rule is GatewaySelectionRule =>
    DEFAULT_PRIORITY.includes(rule)
  );
  const priority = priorityCandidates && priorityCandidates.length > 0 ? priorityCandidates : DEFAULT_PRIORITY;
  const allowFallbackToAny = selection?.allowFallbackToAny !== false;

  function resolve(model?: string): BackendResolution | undefined {
    if (!model) {
      return allowFallbackToAny ? { preferredBackendIds: [], allowFallbackToAny: true } : undefined;
    }

    const preferred: string[] = [];

    for (const rule of priority) {
      if (rule === "exact") {
        preferred.push(...resolveExactMatches(model, metadata));
        continue;
      }
      if (rule === "grade") {
        preferred.push(...resolveGradeMatches(model, metadata));
        continue;
      }
      if (rule === "provider") {
        preferred.push(...resolveProviderMatches(model, metadata, selection));
      }
    }

    const ordered = dedupeOrder(preferred);
    if (ordered.length === 0) {
      if (!allowFallbackToAny) {
        return undefined;
      }
      return { preferredBackendIds: [], allowFallbackToAny: true };
    }

    return {
      preferredBackendIds: ordered,
      allowFallbackToAny,
    } satisfies BackendResolution;
  }

  return {
    resolve,
  };
}

export type { BackendResolution };
