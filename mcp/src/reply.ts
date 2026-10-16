// What tools send back: JSON text, or an error the agent can act on.

// JSON for replies: indented, but anything short enough (a hole, a wire, a part entry) on one
// line, so a project file reads one entry per line and costs far fewer tokens.
export function json(value: unknown, indent = ""): string {
  const flat = JSON.stringify(value) ?? "null";
  if (typeof value !== "object" || value === null || flat.length + indent.length <= 110) return flat;
  const inner = `${indent}  `;
  if (Array.isArray(value)) return `[\n${value.map(item => inner + json(item, inner)).join(",\n")}\n${indent}]`;
  const entries = Object.entries(value).filter(([, item]) => item !== undefined);
  return `{\n${entries.map(([key, item]) => `${inner}${JSON.stringify(key)}: ${json(item, inner)}`).join(",\n")}\n${indent}}`;
}

export const textReply = (text: string) => ({content: [{type: "text" as const, text}]});

export const reply = (value: unknown) => textReply(json(value));

export const failure = (message: string, details?: unknown) =>
  ({...textReply(details === undefined ? message : `${message}\n${json(details)}`), isError: true});
