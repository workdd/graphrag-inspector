# What you see

Every view, and why it behaves the way it does. [README.md](../README.md) has the short version.


## Types

![The types of the sample index: one node per entity type, one arrow per relationship that occurs between two types, with the Parquet tables and their key columns underneath](screenshots/schema-sample.png)

The app opens on **Types**: one node per entity type, one arrow per relationship that occurs
between two types, both with counts, and under it the Parquet tables with their key and reference
columns. Nothing declares this shape; it is counted from the rows. Picking a type or an arrow lists
the records behind it and carries over into the network as a filter you can clear.

Not every relationship is worth drawing as arrows. A triple that joins most of its possible pairs,
such as a permission block, is a hairball under any layout, and one that hangs everything off a few
hubs is really a list of counts. The schema view measures both and sends you to the form that reads:
a grid for a dense pair, counts per hub for a star, arrows for the rest.

## Graph

![The whole sample index as one network with community clouds around the members, every cloud named, and the entity types and communities listed above the canvas](screenshots/network-sample.png)

The **Graph** view draws the records themselves: every entity and relationship on one canvas, with node
colour for the entity type and size for the degree. Communities are an overlay you add, as clouds
around their members or as node colour, and they can be taken away again. Turning the overlay on
takes you to the free layout, which keeps each community together already, so the hulls appear
around what is on screen instead of rearranging it; switching it off again moves nothing.

The free layout treats a community as a container the layout must not scatter, and gives a link that
leaves one a long ideal length while links inside it stay short. The clouds then come out as
separate petals rather than one smear. A tidier catalogue, one disc per community laid out in rows
with a guaranteed gap, is there as its own arrangement when that is what is wanted.

Names appear as there is room for them. On every pan and zoom the visible nodes are measured in
screen pixels and the best are named first, so a crowded picture names its hubs and the members of a
community, and zooming in reveals the rest instead of piling text on text. Zooming spreads the graph
out rather than magnifying it: dots and names hold their size on screen. Every cloud carries its
community's name at a fixed size, and where two names would land on top of each other the smaller
community gives way and gets its name back as you zoom in; every community is also listed under the
canvas with the colour it was drawn in, so no name is ever out of reach.

Clicking a record reads it where it stands. The graph stays exactly as it was; two hops around the
record light up, everything else fades to a ghost rather than disappearing, and the record and its
two rings hold a size on screen so they can be found with the whole graph in view. Double-clicking
is the deliberate step that redraws the picture around that one record: a few neighbours of each
kind are drawn with their names, everything else becomes a dashed bubble carrying a count, and a
second ring shows what those neighbours reach in turn. A role with 274 neighbours reads as twenty
nodes, and a bubble opens on click. Nothing anywhere asks you to choose a number of nodes: one
switch says part of the data or all of it, and part always means a couple of representatives plus a
count.

## Type bubbles and layered arrangement

A type bubble is sized by how many records it stands for, so one type can be many times the width
of its neighbours and a force layout will drop the small ones inside the large one. Whatever the
layout decides, the picture is settled afterwards: overlapping bubbles are pushed apart until none
of them touch, names included, and the view is fitted again so nothing hangs over the edge. Parting
them changes the fit, which changes how large the names are on screen and so how much room they
need, so the three settle together over a few rounds.

`Arrange: layers` puts one column per entity type and orders the columns so that as many
relationships as possible run forward, using a greedy feedback arc set. It reports the share that
made it, and draws the rest dashed red. Long columns wrap into sub-columns so the picture stays
readable. Both Apache AGE graphs we test with reach 99%.

## Communities

![Communities view: one band per level, one circle per community sized by the entities it holds, curves joining each community to its parent, and the entities in no community as grey dots](screenshots/communities-sample.png)

The **Communities** view opens on every community at once: one band per level from the root down,
one circle per community sized by the entities it holds, and a curve from each community to its
parent. Entities that no community claims are drawn as grey dots under the bands and can be switched
off. The nested box map, where a community opens into its members, is one switch away. Clicking
inside a community reads it on the right: its summary, its level, how much of its edge weight stays
inside, its children and its members. Dragging it moves the whole group, and double-clicking opens
its own graph.

## Formation

The **Formation** view runs Leiden in the browser on the entities on screen and plays the run back:
local moving sweep by sweep, refinement, then aggregation, with the graph recolouring as communities
appear, a modularity curve, the shrinking working graph, and NMI/ARI against the community set the
index shipped. Resolution, seed and scope are yours to change; the loaded communities never are.

## The rest

The rest, in short:

- **Health**: a one-paragraph summary with the counts that matter, then the findings that follow from
  them, worst first, each with the search it affects and the setting to change. What looks fine is
  folded away rather than dropped, so the checks that passed are still on the record.
- A sortable table of communities with internal and boundary relationship counts.
- The community report (summary, findings, rank), parent path, child communities and members.
- Integrity findings: duplicate ids, unresolved members or parents, children not nested in their
  parent, size mismatches, dangling relationships.
- The community map: the whole dataset as community boxes sized by member count, linked by lines
  whose width is the number of relationships between two groups. Double-click a box to open it;
  in a nested hierarchy its child communities and its own members appear inside, otherwise its
  members do and dashed arrows show parents. Entities in no community form their own box. Layouts
  run in a web worker and are cached, so the same picture comes back instantly.
- Quality: modularity and coverage per level, size distributions, density and conductance per
  community, and a side-by-side comparison of two community sets (NMI, ARI, overlap table).
- Evidence: the text units and documents behind an entity, relationship or community, when the
  index shipped them; claims from `covariates.parquet` on the entity panel.
- Neighbourhood exploration: from any entity, everything within 1, 2 or 3 hops across community
  boundaries, drawn inside the communities it belongs to.
- Readable at scale: a hub-and-spoke relationship type that owns most of a big community's links
  starts hidden (one click brings it back), degree-one leaves of one type on the same hub fold into
  a single node, and communities can be drawn as translucent clouds around their members instead of
  boxes. Every view and selection is a browser history entry, so the back button works.
- The community graph: members drawn inside the community container, colored by entity type and
  sized by degree, with labels that stay readable. Outside links reach dashed ghost nodes, and any
  neighbouring community can be added to the same picture. Click a node for its neighbourhood and
  incoming/outgoing links, a link for its description; filter relationship types, search, and drag
  nodes. Layouts are deterministic and survive filtering.
- PNG export of the graph and the map at 2x, CSV export of the community and quality tables, and a
  shareable view state in the URL (`#view=map&set=leiden&community=11`).

## How the views are grouped

The views are grouped by what you came to do: **Ask** on its own, then the four you look around with
(**Health**, **Types**, **Graph**, **Communities**, and **Focus** once something is selected), then
the three you take the index apart with (**Quality**, **Matrix**, **Formation**). The strip is one
keyboard stop with arrow keys between the views, and each view names the panel it opens.

The interface is available in English and Korean; the switch sits in the top bar and the choice is
remembered in the browser.

