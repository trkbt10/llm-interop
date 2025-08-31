/**
 * @file Cross-provider grade-based model mapping.
 *
 * 指定がない場合に、同等グレードのモデルへマッピングするための補助関数。
 */
import { detectModelGrade, type ModelGrade } from "./model-grade-detector";

/**
 * Picks best model by recency based on version numbers and keywords
 */
function pickBestByRecency(ids: readonly string[]): string | undefined {
  const score = (id: string): number => {
    const nums = id.match(/\d{6,}|\d+/g) !== null ? id.match(/\d{6,}|\d+/g)! : [];
    const max = nums.reduce((acc, n) => Math.max(acc, parseInt(n, 10) !== 0 ? parseInt(n, 10) : 0), 0);
    const bonus = /pro|opus|sonnet|ultra|latest/i.test(id) ? 100 : 0;
    const malus = /mini|lite|nano|tiny|fast/i.test(id) ? -50 : 0;
    return max + bonus + malus;
  };
  return [...ids].sort((a, b) => score(b) - score(a))[0];
}

/**
 * Maps source model to equivalent model in target provider by grade.
 */
export function mapToEquivalentByGrade(params: {
  sourceModel?: string; // 未指定なら fallbackGrade を使用
  targetModelIds: readonly string[];
  fallbackGrade?: ModelGrade; // 未指定モデル時の優先グレード
}): string | undefined {
  const { sourceModel, targetModelIds, fallbackGrade = "mid" } = params;
  if (!targetModelIds?.length) {
    return undefined;
  }

  const desiredGrade: ModelGrade = sourceModel ? detectModelGrade(sourceModel) : fallbackGrade;
  const sameGrade = targetModelIds.filter((id) => detectModelGrade(id) === desiredGrade);
  if (sameGrade.length) {
    return pickBestByRecency(sameGrade);
  }

  // 次点: 近いグレード（high<->mid、mid<->low）を許容
  const near: ModelGrade[] = desiredGrade === "high" ? ["mid"] : desiredGrade === "low" ? ["mid"] : ["high", "low"];
  for (const g of near) {
    const pool = targetModelIds.filter((id) => detectModelGrade(id) === g);
    if (pool.length) {
      return pickBestByRecency(pool);
    }
  }
  // 最後に全体から一番新しいもの
  return pickBestByRecency(targetModelIds);
}

/**
 * 双方のモデルリストから「同等グレード」を選び、target 側の代表モデルを決定します。
 * 明示モデルがあればそのグレードを優先。なければ、両側に共通に存在するグレード
 * 優先順位: mid → high → low → fallbackGrade。
 */
export function chooseEquivalentModelUsingBothLists(params: {
  explicitSourceModel?: string;
  sourceModelIds: readonly string[];
  targetModelIds: readonly string[];
  fallbackGrade?: ModelGrade;
}): { desiredGrade: ModelGrade; targetModel?: string } {
  const { explicitSourceModel, sourceModelIds, targetModelIds, fallbackGrade = "mid" } = params;
  if (!targetModelIds?.length) {
    return { desiredGrade: fallbackGrade, targetModel: undefined };
  }

  // 1) 明示モデルがある場合はそのグレード
  if (explicitSourceModel) {
    const g = detectModelGrade(explicitSourceModel);
    return {
      desiredGrade: g,
      targetModel: mapToEquivalentByGrade({ sourceModel: explicitSourceModel, targetModelIds, fallbackGrade: g }),
    };
  }

  // 2) 共通に存在するグレードを優先: mid → high → low
  const gradeHas = (ids: readonly string[], grade: ModelGrade) => ids.some((id) => detectModelGrade(id) === grade);
  const order: ModelGrade[] = ["mid", "high", "low"];
  for (const g of order) {
    if (gradeHas(sourceModelIds, g) && gradeHas(targetModelIds, g)) {
      return { desiredGrade: g, targetModel: mapToEquivalentByGrade({ targetModelIds, fallbackGrade: g }) };
    }
  }

  // 3) どちらか一方にしかない場合は fallbackGrade
  return { desiredGrade: fallbackGrade, targetModel: mapToEquivalentByGrade({ targetModelIds, fallbackGrade }) };
}
