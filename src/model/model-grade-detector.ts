/**
 * @file Model grade detection utilities based on model identifiers
 */
export type ModelGrade = "high" | "mid" | "low";

type GradeIndicators = {
  high: number;
  low: number;
};

// Context-based indicator functions
function analyzeSizeIndicators(model: string): GradeIndicators {
  const sizeMatch = model.match(/\b(\d+)b\b/);
  const modelSize = sizeMatch ? parseInt(sizeMatch[1]) : undefined;

  if (modelSize === undefined) {
    return { high: 0, low: 0 };
  }

  // Define size thresholds
  const sizeGrades = [
    { min: 70, indicator: { high: 2, low: 0 } }, // 70b+ → high grade
    { min: 40, indicator: { high: 1, low: 0 } }, // 40-69b → slightly high
    { min: 30, max: 35, indicator: { high: 0, low: 0 } }, // 30-35b → neutral (mid)
    { min: 12, max: 27, indicator: { high: 0, low: 0 } }, // 12-27b → neutral (mid)
    { max: 9, indicator: { high: 0, low: 2 } }, // ≤9b → low grade
    { max: 11, indicator: { high: 0, low: 1 } }, // 10-11b → slightly low
  ];

  for (const grade of sizeGrades) {
    const inRange =
      (grade.min === undefined || modelSize >= grade.min) && (grade.max === undefined || modelSize <= grade.max);
    if (inRange) {
      return grade.indicator;
    }
  }

  return { high: 0, low: 0 };
}

function analyzeVersionIndicators(model: string): GradeIndicators {
  const versionMatch = model.match(/(?:grok|gemini|gpt|o)-?(\d+(?:\.\d+)?)/);
  const version = versionMatch ? parseFloat(versionMatch[1]) : undefined;

  const indicators: GradeIndicators = { high: 0, low: 0 };

  if (version !== undefined) {
    if (version >= 4) {
      indicators.high += 2;
      return indicators;
    }

    if (version >= 3) {
      indicators.high += 1;
      return indicators;
    }

    if (version < 2) {
      indicators.low += 1;
    }
  }

  return indicators;
}

function analyzeHighGradeKeywords(model: string): GradeIndicators {
  const indicators: GradeIndicators = { high: 0, low: 0 };

  if (/\b(?:pro|opus|ultra|advanced)\b/i.test(model)) {
    indicators.high += 2;
  }
  if (/\b(?:experimental|exp)\b/i.test(model)) {
    indicators.high += 1;
  }
  if (/\b(?:deep|research)\b/i.test(model)) {
    indicators.high += 1;
  }

  return indicators;
}

function analyzeLowGradeKeywords(model: string): GradeIndicators {
  const indicators: GradeIndicators = { high: 0, low: 0 };

  if (/\b(?:mini|lite|nano|tiny|small)\b/i.test(model)) {
    indicators.low += 2;
  }
  if (/\b(?:fast|quick)\b/i.test(model)) {
    indicators.low += 1;
  }
  if (/\b(?:embedding|whisper|tts|guard|imagen)\b/i.test(model)) {
    indicators.low += 2;
  }

  return indicators;
}

function analyzeSpecialPatterns(model: string): GradeIndicators {
  const indicators: GradeIndicators = { high: 0, low: 0 };

  // Models with millions of params
  if (/\d+m\b/i.test(model)) {
    indicators.low += 1;
  }

  // Thinking models are experimental but not necessarily high-grade
  if (/thinking/i.test(model)) {
    indicators.high -= 1;
  }

  // Instant models are often mid-grade, except for claude-instant
  if (/\binstant\b/i.test(model) && !/claude-instant/i.test(model)) {
    // Strong boost to counter the size penalty for small instant models
    indicators.high += 2;
    indicators.low -= 2;
  }

  // O-series model patterns
  if (/^o\d+(?:-pro)?$/i.test(model)) {
    indicators.high += 1;
  }

  // Compound models are typically basic
  if (/compound/i.test(model)) {
    indicators.low += 1;
  }

  return indicators;
}

function analyzeFlashModels(model: string): GradeIndicators {
  const indicators: GradeIndicators = { high: 0, low: 0 };

  if (/\bflash\b/i.test(model)) {
    if (/\blite\b/i.test(model)) {
      indicators.low += 1;
      return indicators;
    }

    // Flash without lite is mid-grade, slightly favor neither high nor low
    // We'll handle this by not adding any indicators
  }

  return indicators;
}

function analyzeAnthropicModels(model: string): GradeIndicators {
  const indicators: GradeIndicators = { high: 0, low: 0 };

  // Anthropic-specific patterns
  if (/\bopus\b/i.test(model)) {
    indicators.high += 2;
  }
  if (/\bsonnet\b/i.test(model)) {
    // Sonnet is mid-grade, neither high nor low
    // No indicators added
  }
  if (/\bhaiku\b/i.test(model)) {
    indicators.low += 2;
  }
  if (/\binstant\b/i.test(model)) {
    indicators.low += 2;
  }

  // Claude 2.x models are mid-grade
  if (/claude-2\./i.test(model)) {
    // No indicators added for mid-grade
  }

  return indicators;
}

function checkSpecialOverrides(model: string): ModelGrade | undefined {
  // Special handling for specific patterns that override scoring
  if (/\bgpt-3\.5/i.test(model)) {
    return "low";
  }

  // Gemini pro models are high-grade
  if (/gemini.*pro(?!-)/i.test(model) && !/\b(?:preview|lite|mini|nano)\b/i.test(model)) {
    return "high";
  }

  // mini/nano models are typically low unless they have very strong high indicators
  if (/\b(?:mini|nano)\b/i.test(model)) {
    const sizeIndicators = analyzeSizeIndicators(model);
    const versionIndicators = analyzeVersionIndicators(model);
    const totalHighIndicators = sizeIndicators.high + versionIndicators.high;
    if (totalHighIndicators < 3) {
      return "low";
    }
  }

  // grok-3-fast should be lower than regular grok-3
  if (/grok-3.*fast/i.test(model)) {
    return "low";
  }

  // Flash models are handled based on size
  if (/\bflash\b/i.test(model)) {
    if (/\blite\b/i.test(model)) {
      return "low";
    }
    if (/8b/i.test(model)) {
      return "low";
    }
    return "mid";
  }

  return undefined;
}

function aggregateIndicators(...indicatorSets: GradeIndicators[]): GradeIndicators {
  return indicatorSets.reduce(
    (acc, curr) => ({
      high: acc.high + curr.high,
      low: acc.low + curr.low,
    }),
    { high: 0, low: 0 },
  );
}

function determineGradeFromIndicators(indicators: GradeIndicators): ModelGrade {
  const netScore = indicators.high - indicators.low;

  // Require higher threshold for high-grade
  if (netScore >= 2 && indicators.high >= 2) {
    return "high";
  }
  if (netScore <= -2) {
    return "low";
  }

  // For borderline cases
  if (netScore === 1) {
    if (indicators.low > 0) {
      return "mid";
    }
    return "high";
  }

  if (netScore === -1) {
    if (indicators.high > 0) {
      return "mid";
    }
    return "low";
  }

  // Default to mid for neutral scores
  return "mid";
}

/**
 * Analyzes a model name to determine its performance grade (high, mid, or low).
 * Uses various indicators including model size, version numbers, keywords, and provider-specific patterns.
 * @param modelName - The name of the model to analyze
 * @returns The detected grade ('high', 'mid', or 'low')
 */
export function detectModelGrade(modelName: string): ModelGrade {
  const model = modelName.toLowerCase();

  // Check for special overrides first
  const override = checkSpecialOverrides(model);
  if (override !== undefined) {
    return override;
  }

  // Collect indicators from all contexts
  const indicators = aggregateIndicators(
    analyzeSizeIndicators(model),
    analyzeVersionIndicators(model),
    analyzeHighGradeKeywords(model),
    analyzeLowGradeKeywords(model),
    analyzeSpecialPatterns(model),
    analyzeFlashModels(model),
    analyzeAnthropicModels(model),
  );

  // Determine final grade
  return determineGradeFromIndicators(indicators);
}

/**
 * Filters a list of model names to return only those matching the specified grade.
 * @param models - Array of model names to filter
 * @param grade - The grade to filter by ('high', 'mid', or 'low')
 * @returns Array of model names that match the specified grade
 */
export function getModelsByGrade(models: readonly string[], grade: ModelGrade): string[] {
  return models.filter((model) => detectModelGrade(model) === grade);
}
