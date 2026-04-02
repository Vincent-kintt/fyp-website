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
