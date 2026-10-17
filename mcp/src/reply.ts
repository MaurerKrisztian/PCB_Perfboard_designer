// What tools send back: JSON text, a picture, or an error the agent can act on.

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

// A PNG with a line saying what it shows.
export const pngReply = (png: Uint8Array, caption: string) => ({
  content: [{type: "text" as const, text: caption}, {type: "image" as const, data: base64(png), mimeType: "image/png"}],
});

// Without Node's Buffer, which the Worker doesn't have; in chunks, as spreading a whole picture
// into one call would overflow the stack.
function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export const failure = (message: string, details?: unknown) =>
  ({...textReply(details === undefined ? message : `${message}\n${json(details)}`), isError: true});
