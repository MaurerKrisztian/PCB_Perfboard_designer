import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {closestParts, exampleEntry, findPart, noSuchPart, partsByCategory, placementNotes, searchParts, summarize} from "../parts";
import {failure, reply} from "../reply";

// The parts catalog: list_parts to choose, get_part for what placing one takes.

export function registerCatalogTools(server: McpServer) {
  server.registerTool("list_parts", {
    title: "List parts",
    description: "Lists the parts a project can place. Without a query: every part, grouped by category, as its id with its name and pin count; call it this way once to see what there is. With a query: the parts whose id, name, category or keywords contain all its words, or the closest ones when none do. Each part's `id` is its definitionId in the project file; use get_part for its pins and how to place it.",
    inputSchema: {
      query: z.string().optional().describe('Words to match, e.g. "capacitor", "555", "header", "relay". Leave it out to list every part.'),
      kind: z.enum(["standard-component", "advanced-component", "ic"]).optional()
        .describe("standard-component: two-lead parts placed between two holes. advanced-component: fixed-footprint parts. ic: dual-row chips and modules."),
    },
    annotations: {readOnlyHint: true, openWorldHint: false},
  }, async ({query, kind}) => {
    if (!query?.trim()) {
      const parts = searchParts(undefined, kind);
      return reply({count: parts.length, byCategory: partsByCategory(parts)});
    }
    const parts = searchParts(query, kind);
    if (parts.length) return reply({count: parts.length, parts: parts.map(summarize)});
    const closest = closestParts(query, kind);
    return reply(closest.length
      ? {count: 0, parts: [], hint: `No part matches every word of "${query}". These match some of them; list_parts with no query lists every part.`, closest: closest.map(summarize)}
      : {count: 0, parts: [], hint: `No part matches "${query}". list_parts with no query lists every part.`});
  });

  server.registerTool("get_part", {
    title: "Get parts",
    description: "Everything needed to place parts: for each, which project file list it goes in, its pins (offsets from pin 1 at rotation 0) and pin labels, polarity, value unit, holes its body covers, and an example entry. Ask for every part you use in one call with `ids`.",
    inputSchema: {
      ids: z.array(z.string()).optional().describe('Part ids from list_parts, e.g. ["resistor", "ne555", "header-pins"].'),
      id: z.string().optional().describe("One part id, instead of `ids`."),
    },
    annotations: {readOnlyHint: true, openWorldHint: false},
  }, async ({ids, id}) => {
    const wanted = [...(ids ?? []), ...(id ? [id] : [])];
    if (!wanted.length) return failure("Give `ids`: the part ids from list_parts.");
    const found = [];
    const missing: string[] = [];
    for (const name of wanted) {
      const part = findPart(name);
      if (part) found.push({...part, howToPlace: placementNotes(part), example: exampleEntry(part)});
      else missing.push(noSuchPart(name));
    }
    if (!found.length) return failure(`${missing.join(" ")} Use list_parts to find one.`);
    // One part asked for the old way: just that part, as before.
    if (id && !ids && found.length === 1) return reply(found[0]);
    return reply({parts: found, ...(missing.length ? {missing} : {})});
  });
}
