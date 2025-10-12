/**
 * @file Types for scenario runner
 */

export type ScenarioResult = {
  scenario: string;
  success: boolean;
  output: string | null | undefined;
  rawResponse: unknown;
};
