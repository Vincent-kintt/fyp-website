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
      result.push({ id: node.id, depth, parentId: node.parentId || null, hasChildren });
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
  const stack = childrenMap.get(noteId) || [];
  while (stack.length > 0) {
    const id = stack.pop();
    result.add(id);
    const children = childrenMap.get(id);
    if (children) stack.push(...children);
  }
  return result;
}

export function getProjection(flatItems, activeId, overId, dragOffsetX, indentWidth) {
  const overIndex = flatItems.findIndex((item) => item.id === overId);
  if (overIndex === -1) return { depth: 0, parentId: null };

  const overItem = flatItems[overIndex];
  const depthOffset = Math.round(dragOffsetX / indentWidth);
  const rawDepth = overItem.depth + depthOffset;
  // Any note can become a parent; max depth is always one level deeper than the over-item
  const maxDepth = overItem.depth + 1;
  const depth = Math.max(0, Math.min(rawDepth, maxDepth));

  if (depth === 0) return { depth, parentId: null };
  if (depth > overItem.depth) return { depth, parentId: overItem.id };
  if (depth === overItem.depth) return { depth, parentId: overItem.parentId };

  for (let i = overIndex; i >= 0; i--) {
    if (flatItems[i].depth === depth - 1) return { depth, parentId: flatItems[i].id };
  }
  return { depth: 0, parentId: null };
}

export function computeTreeReorder(flatNotes, activeId, projection, overIndex) {
  const { parentId: newParentId } = projection;
  const activeNote = flatNotes.find((n) => n.id === activeId);
  if (!activeNote) return [];

  const oldParentId = activeNote.parentId || null;
  const resolvedNewParentId = newParentId || null;

  const newSiblings = flatNotes
    .filter((n) => (n.parentId || null) === resolvedNewParentId && n.id !== activeId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  let insertAt = newSiblings.length;
  if (overIndex >= 0) {
    const visibleOverId = flatNotes[overIndex]?.id;
    const siblingIdx = newSiblings.findIndex((n) => n.id === visibleOverId);
    if (siblingIdx !== -1) insertAt = siblingIdx;
  }

  newSiblings.splice(insertAt, 0, { id: activeId });

  const updates = newSiblings.map((item, index) => ({
    id: item.id,
    parentId: resolvedNewParentId,
    sortOrder: (index + 1) * 1000,
  }));

  if (resolvedNewParentId !== oldParentId) {
    const oldSiblings = flatNotes
      .filter((n) => (n.parentId || null) === oldParentId && n.id !== activeId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    for (let i = 0; i < oldSiblings.length; i++) {
      updates.push({ id: oldSiblings[i].id, parentId: oldParentId, sortOrder: (i + 1) * 1000 });
    }
  }

  return updates;
}
