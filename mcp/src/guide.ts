// The full guide for agents, served as the resource perfboard://docs/guide. The server's
// instructions (server.ts) are only a short version of it: clients cut instructions off at about
// 2 KB, so anything past the essentials lives here.

export const GUIDE = `# Designing a board with Perfboard Designer

Perfboard Designer (https://perfboarddesigner.com) is a browser editor for perfboard and stripboard layouts. With these tools you design a board as a project file (JSON, format version 3) and give the user a link that opens it in the editor, where they can see and change it.

## Workflow

1. list_parts with no query: every part, by category, in one call. Then get_part with ids: every part you use, in one call: its pins, polarity and footprint.
2. new_project (cols, rows, type): a blank board, kept here under a projectId. Pass the projectId to every other tool instead of the whole project file. (new_project with example starts from an example project; see the perfboard://examples resources.)
3. edit_project with a list of ops: place parts (add_part with the part's id and "at", or "from" and "to" for a two-lead part) and route wires (add_wire with "from" and "to", or a "path" of holes for a wire with corners; any of these can be a pin by name, "U1.7" or "D1.K", for the hole it's in). If any op can't be done, none are. Each reply says where the new parts' pins landed and checks the board; once it has no errors, the reply lists its nets too.
4. Check the circuit is the one you meant: the nets in edit_project's reply (pins named like "U1.8 VCC", "D1.K", "R1.1"), or get_nets for junctions and crossings too. Give expectNets (your netlist, e.g. [["U1.8", "U1.4", "R1.1", "J1.1"], ...]) once, to edit_project or validate_project, and every missing or extra connection is reported as an error from then on. render_board draws the board as text, one cell per hole: use it to see free space and where wires run before you place or route more.
5. Fix every error. Warnings are likely mistakes, such as two pins of one part shorted by a strip, a wire passing over a pin without joining it, a lead or wires connected to nothing, or two supply rails shorted. validate_project lists notes too.
6. make_share_link with the projectId: give the user the link it returns.

## The board

Positions are [column, row] holes counted from the top-left hole, both from 0. Neighbouring holes are 2.54 mm (0.1") apart.

## What can share a hole

A hole holds at most one part's pin or lead: a second part's pin or lead in the same hole, or a pin in a hole under another part's body, is an error ("Hole [c, r] is used twice"), as it would be on a real board. Wire ends are different: any number of them can end in a hole, with or without a pin there, but not in a hole under a part's body. Everything in one hole is joined. So to connect two parts, run a wire from one's pin to the other's ("U1.1" to "R1.1"), never put both in one hole. A wire end in a hole with no pin and no other wire is a loose end (a warning, on a perfboard).

## How things connect

Wires are insulated jumpers: a wire joins only the holes at its two ends (and a path's corners), never a hole it passes over, and wires may cross each other (that's fine, not a short). On a stripboard, every hole along a strip is already connected up to the next cut, and a cut hole connects to nothing: cut strips (add_cuts) to separate them, e.g. under a chip so its two pin rows aren't shorted.

## More

get_project returns the whole file. Projects are kept only while the server runs; a whole project file works in place of a projectId everywhere. To change a board the user shares with you, read it with read_share_link: it returns a projectId to edit. The format is documented in the resource perfboard://docs/project-file, links in perfboard://docs/share-links, and the whole parts catalog is perfboard://parts.
`;
