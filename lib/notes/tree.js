import { generateKeyBetween } from "@/lib/notes/sortOrder.js";

// sortOrder is a fractional indexing string (see lib/notes/sortOrder.js).
// Lexicographic compare gives the same ordering as the underlying continuum.
// id is the tiebreaker — handles transient key collisions from concurrent
// inserts that read the same neighbour set on the server.
function compareNotes(a, b) {
  const ao = a.sortOrder ?? "";
  const bo = b.sortOrder ?? "";
  if (ao < bo) return -1;
  if (ao > bo) return 1;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

export function buildTree(flat) {
  const map = new Map();
  const roots = [];

  for (const note of flat) {
    map.set(note.id, { ...note, children: [] });
  }

  for (const note of flat) {
    const node = map.get(note.id);
    if (note.parentId && map.has(note.parentId)) {
      map.get(note.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortChildren = (nodes) => {
    nodes.sort(compareNotes);
    for (const node of nodes) {
      sortChildren(node.children);
    }
  };
  sortChildren(roots);

  return roots;
}

export function findAncestors(flat, noteId) {
  const map = new Map(flat.map((n) => [n.id, n]));
  const ancestors = [];
  let current = map.get(noteId);
  while (current?.parentId) {
    ancestors.push(current.parentId);
    current = map.get(current.parentId);
  }
  return ancestors;
}

export function flattenVisibleTree(tree, expandedIds) {
  const result = [];
  function walk(nodes, depth) {
    for (const node of nodes) {
      const hasChildren = node.children && node.children.length > 0;
      result.push({ id: node.id, depth, parentId: node.parentId ?? null, hasChildren });
      if (hasChildren && expandedIds.has(node.id)) {
        walk(node.children, depth + 1);
      }
    }
  }
  walk(tree, 0);
  return result;
}

export function getDescendantIds(flatNotes, noteId) {
  const childrenMap = new Map();
  for (const note of flatNotes) {
    if (note.parentId) {
      if (!childrenMap.has(note.parentId)) childrenMap.set(note.parentId, []);
      childrenMap.get(note.parentId).push(note.id);
    }
  }
  const result = new Set();
  const stack = [...(childrenMap.get(noteId) || [])];
  while (stack.length > 0) {
    const id = stack.pop();
    result.add(id);
    const children = childrenMap.get(id);
    if (children) stack.push(...children);
  }
  return result;
}

// Drop-zone based reorder: dropPosition is "before" | "after" | "into"
// "before"/"after" = reorder as sibling of overNote
// "into" = make activeNote a child of overNote
//
// Returns one update per affected note. The active note's sortOrder is
// computed via fractional indexing between its new neighbours; non-moved
// siblings keep their existing keys (no resequencing needed — fractional
// keys are stable). Old-parent siblings are untouched too: removing the
// active note doesn't disturb their ordering.
export function computeTreeReorder(flatNotes, activeId, overId, dropPosition) {
  const activeNote = flatNotes.find((n) => n.id === activeId);
  const overNote = flatNotes.find((n) => n.id === overId);
  if (!activeNote || !overNote) return [];

  let newParentId;
  let prevKey;
  let nextKey;

  if (dropPosition === "into") {
    newParentId = overId;
    const newSiblings = flatNotes
      .filter((n) => (n.parentId ?? null) === newParentId && n.id !== activeId)
      .sort(compareNotes);
    // Append as last child
    prevKey = newSiblings.at(-1)?.sortOrder ?? null;
    nextKey = null;
  } else {
    newParentId = overNote.parentId ?? null;
    const siblings = flatNotes
      .filter((n) => (n.parentId ?? null) === newParentId && n.id !== activeId)
      .sort(compareNotes);
    const overIdx = siblings.findIndex((n) => n.id === overId);
    const insertAt = dropPosition === "before" ? overIdx : overIdx + 1;
    prevKey = insertAt > 0 ? siblings[insertAt - 1].sortOrder : null;
    nextKey = insertAt < siblings.length ? siblings[insertAt].sortOrder : null;
  }

  const newSortOrder = generateKeyBetween(prevKey, nextKey);
  return [{ id: activeId, parentId: newParentId, sortOrder: newSortOrder }];
}
