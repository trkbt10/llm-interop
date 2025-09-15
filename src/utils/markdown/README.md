# Markdown Streaming Utilities

This module provides a generic streaming markdown parser that can be used across different AI providers to parse markdown content incrementally as it arrives in a stream.

## Usage

### Basic Usage

````typescript
import { createStreamingMarkdownParser } from "./src/utils/markdown/streaming-parser";

const parser = createStreamingMarkdownParser();

// 1) Stream: consume an AsyncIterable<string>
async function* source() {
  yield "# Hello\n";
  yield "```js\nconsole.log('test');\n```";
}

for await (const event of parser.processStream(source())) {
  console.log(event);
}

// 2) Single text: call complete() after the last chunk
for await (const event of parser.processChunk("# Title\nBody")) {
  console.log(event);
}
for await (const event of parser.complete()) {
  console.log(event);
}
````

### Provider-Specific Implementation

```typescript
import { createStreamingMarkdownParser } from "./src/utils/markdown/streaming-parser";
import type { MarkdownParseEvent } from "./src/utils/markdown/types";

// Create a provider-specific parser
const parser = createStreamingMarkdownParser({
      idPrefix: "claude",
      preserveWhitespace: true,
      // Enable only specific elements
      enabledElements: new Set(["code", "header", "list"]),
});

// Pre-process then feed chunks
const input = "[CLAUDE] **bold**".replace(/\[CLAUDE\]/g, "");
for await (const ev of parser.processChunk(input)) {
  // ...
}
```

### Custom Element Matchers

```typescript
const parser = new StreamingMarkdownParser({
  customMatchers: [
    {
      type: "custom_tag",
      regex: /<custom>(.*?)<\/custom>/g,
      priority: 100,
      extractContent: (match) => match[1],
      extractMetadata: (match) => ({ tag: "custom" }),
    },
  ],
});
```

### Using Plugins

```typescript
import { StreamingMarkdownParser } from "./src/utils/markdown/streaming-parser";
import type { MarkdownParserPlugin } from "./src/utils/markdown/types";

const citationPlugin: MarkdownParserPlugin = {
  name: "citation-enhancer",
  postProcess: (events) => {
    // Add citation numbers to links
    let citationCount = 0;
    return events.map((event) => {
      if (event.type === "annotation" && event.annotation.type === "url_citation") {
        citationCount++;
        return {
          ...event,
          annotation: {
            ...event.annotation,
            citationNumber: citationCount,
          },
        };
      }
      return event;
    });
  },
};

const parser = new StreamingMarkdownParser();
parser.addPlugin(citationPlugin);
```

### Testing

````typescript
import { createTestHelper } from "./src/utils/markdown/test-helper";

const { parser, helper } = createTestHelper();

// Test parsing
const events = await helper.collectEvents("# Test\n```js\ncode\n```");

// Assert event sequence
const codeEvents = helper.filterEventsByType(events, "begin");
console.log(codeEvents);

// Get final contents
const contents = helper.getFinalContents(events);
console.log(contents);
````

## Event Types

The parser emits four types of events:

1. **begin** - When a markdown element starts
   - Contains element type, ID, and optional metadata

2. **delta** - Incremental content updates
   - Contains element ID and content chunk

3. **end** - When an element is complete
   - Contains element ID and final content

4. **annotation** - Special metadata events (e.g., for links)
   - Contains element ID and annotation details

## Supported Elements

- **code** - Code blocks with language detection
- **header** - Headers (H1-H6) with level metadata
- **quote** - Block quotes
- **math** - Math expressions ($$...$$)
- **list** - Lists with level and ordering metadata
- **table** - Markdown tables
- **link** - Links with URL and title metadata

## Configuration Options

- `enabledElements` - Set of element types to parse
- `customMatchers` - Array of custom element matchers
- `preserveWhitespace` - Whether to preserve whitespace
- `splitParagraphs` - Whether to split on paragraph breaks
- `maxBufferSize` - Maximum buffer size in bytes
- `idPrefix` - Prefix for generated element IDs
- `idGenerator` - Custom ID generation function
