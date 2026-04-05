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
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
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
export function computeTreeReorder(flatNotes, activeId, overId, dropPosition) {
  const activeNote = flatNotes.find((n) => n.id === activeId);
  const overNote = flatNotes.find((n) => n.id === overId);
  if (!activeNote || !overNote) return [];

  const oldParentId = activeNote.parentId ?? null;

  if (dropPosition === "into") {
    // Reparent: make active a child of over
    const newParentId = overId;
    const newSiblings = flatNotes
      .filter((n) => (n.parentId ?? null) === newParentId && n.id !== activeId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    // Append as last child
    newSiblings.push({ id: activeId });

    const updates = newSiblings.map((item, index) => ({
      id: item.id, parentId: newParentId, sortOrder: (index + 1) * 1000,
    }));

    // Re-sequence old siblings if parent changed
    if (newParentId !== oldParentId) {
      const oldSiblings = flatNotes
        .filter((n) => (n.parentId ?? null) === oldParentId && n.id !== activeId)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      for (let i = 0; i < oldSiblings.length; i++) {
        updates.push({ id: oldSiblings[i].id, parentId: oldParentId, sortOrder: (i + 1) * 1000 });
      }
    }

    return updates;
  }

  // "before" or "after": reorder as sibling of overNote
  const targetParentId = overNote.parentId ?? null;
  const siblings = flatNotes
    .filter((n) => (n.parentId ?? null) === targetParentId && n.id !== activeId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const overIdx = siblings.findIndex((n) => n.id === overId);
  const insertAt = dropPosition === "before" ? overIdx : overIdx + 1;
  siblings.splice(insertAt >= 0 ? insertAt : siblings.length, 0, { id: activeId });

  const updates = siblings.map((item, index) => ({
    id: item.id, parentId: targetParentId, sortOrder: (index + 1) * 1000,
  }));

  // Re-sequence old siblings if parent changed
  if (targetParentId !== oldParentId) {
    const oldSiblings = flatNotes
      .filter((n) => (n.parentId ?? null) === oldParentId && n.id !== activeId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    for (let i = 0; i < oldSiblings.length; i++) {
      updates.push({ id: oldSiblings[i].id, parentId: oldParentId, sortOrder: (i + 1) * 1000 });
    }
  }

  return updates;
}
