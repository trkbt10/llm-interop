/**
 * @file Block processing facade: re-exports split implementations
 */
export { processCodeBlock } from "./processors/code-block";
export { processNonCodeBlock, accumulateBlockContent } from "./processors/non-code-block";
export { handleDetectedBlock, handleDoubleNewline } from "./processors/handlers";
export type { DetectedBlock } from "./processors/handlers";

