import * as z from "zod";
import {holeInput as hole} from "./project-source";

// The ops edit_project takes, as the schema agents see. Applied by edit-project.ts.

// A wire end: a hole, or a pin by name, which stands for the hole it's in.
const wireEnd = z.union([z.array(z.number().int()).length(2), z.string()])
  .describe('A hole [column, row], or a pin by name: "U1.7", "U1.DISCH", "D1.K", "R2.1" (the hole that pin is in).');
const rotation = z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]);
const wireSelector = z.union([z.number().int().min(0), z.array(hole).length(2)])
  .describe("A wire by its index in wires, or by its two end holes [[c, r], [c, r]] (either way round).");

export const editOp = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("add_part"),
    part: z.string().describe('The part\'s id from list_parts ("resistor", "ne555", "header-pins"), or the name of one of the project\'s customIcs.'),
    ref: z.string().optional().describe("Its reference designator. The next free one (R1, R2...) when left out."),
    from: hole.optional().describe("Two-lead parts: the hole of lead 1. On a polarized part get_part's leadLabels say which that is: K for a diode or LED, - for an electrolytic."),
    to: hole.optional().describe("Two-lead parts: the hole of lead 2."),
    at: hole.optional().describe("Other parts: pin 1's hole (a chip's or pin block's top-left pin)."),
    rotation: rotation.optional().describe("Other parts: 0 (default), 90, 180 or 270, clockwise."),
    rows: z.number().int().min(1).optional().describe("Pin blocks (header-pins): rows of pins."),
    cols: z.number().int().min(1).optional().describe("Pin blocks (header-pins): pins per row."),
    value: z.string().optional().describe('E.g. "10k", "100n".'),
    color: z.string().optional().describe('Two-lead parts, e.g. an LED\'s "#ef4444".'),
  }),
  z.object({
    op: z.literal("update_part"),
    ref: z.string(),
    by: hole.optional().describe("Move it by [columns, rows]."),
    from: hole.optional(),
    to: hole.optional(),
    at: hole.optional(),
    rotation: rotation.optional().describe("Turns about `at`; a chip's widthPin and heightPin are swapped to match."),
    rows: z.number().int().min(1).optional(),
    cols: z.number().int().min(1).optional(),
    value: z.string().optional().describe('"" removes it.'),
    color: z.string().optional().describe('"" removes it.'),
    newRef: z.string().optional(),
  }),
  z.object({op: z.literal("remove_parts"), refs: z.array(z.string()).min(1)}),
  z.object({
    op: z.literal("add_wire"),
    from: wireEnd.optional(),
    to: wireEnd.optional(),
    path: z.array(wireEnd).min(2).optional()
      .describe("Instead of from/to: holes (or pins) to run through in order, made into one wire per leg. Each corner is a wire end, so it joins whatever is in that hole."),
    color: z.string().optional(),
    width: z.number().positive().optional(),
  }),
  z.object({
    op: z.literal("update_wire"),
    wire: wireSelector,
    from: wireEnd.optional(),
    to: wireEnd.optional(),
    color: z.string().optional(),
    width: z.number().positive().optional(),
  }),
  z.object({
    op: z.literal("remove_wires"),
    wires: z.array(wireSelector).min(1).describe("Indexes are as they stand before this op, so list several in one op."),
  }),
  z.object({
    op: z.literal("set_board"),
    cols: z.number().int().min(1).optional(),
    rows: z.number().int().min(1).optional(),
    type: z.enum(["perfboard", "stripboard"]).optional(),
    strips: z.enum(["horizontal", "vertical"]).optional().describe("A stripboard's strips."),
  }),
  z.object({op: z.literal("add_cuts"), at: z.array(hole).min(1).describe("Stripboard holes to cut the strip at.")}),
  z.object({op: z.literal("remove_cuts"), at: z.array(hole).min(1)}),
  z.object({
    op: z.literal("set_pad"),
    at: hole,
    color: z.string().optional(),
    note: z.string().optional().describe("Both color and note left out (or \"\") unmarks the hole."),
  }),
]);

export type EditOp = z.infer<typeof editOp>;

// One op of the given kind.
export type Op<K extends EditOp["op"]> = Extract<EditOp, {op: K}>;
