/**
 * @file Types for converter blocks
 */

import type {
  ResponseOutputMessage,
  ResponseReasoningItem,
} from "openai/resources/responses/responses";

export type TextItemState = {
  itemId: string;
  item: ResponseOutputMessage;
  arrayIndex: number;
  outputIndex: number;
  contentIndex: number;
  text: string;
  open: boolean;
};

export type ReasoningItemState = {
  itemId: string;
  item: ResponseReasoningItem;
  arrayIndex: number;
  outputIndex: number;
  contentIndex: number;
  text: string;
  open: boolean;
};

export type BuilderState = {
  started: boolean;
  sequenceNumber: number;
  outputIndexCounter: number;
  reasoningState?: ReasoningItemState;
  finalState?: TextItemState;
};