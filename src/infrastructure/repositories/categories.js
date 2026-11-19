function mapCategory(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    parentId: row.parent_id,
    active: Boolean(row.active),
  };
}

export function listCategories(db, { type, activeOnly = true } = {}) {
  const clauses = [];
  const params = [];
  if (type) {
    clauses.push('type = ?');
    params.push(type);
  }
  if (activeOnly) clauses.push('active = 1');
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db
    .prepare(`SELECT * FROM categories ${where} ORDER BY id`)
    .all(...params)
    .map(mapCategory);
}

export function getCategory(db, id) {
  return mapCategory(db.prepare('SELECT * FROM categories WHERE id = ?').get(id));
}

export function getCategoryByName(db, name, type) {
  return mapCategory(
    db.prepare('SELECT * FROM categories WHERE name = ? AND type = ? ORDER BY id LIMIT 1').get(name, type),
  );
}

export function insertCategory(db, category) {
  const result = db
    .prepare('INSERT INTO categories (name, type, parent_id) VALUES (?, ?, ?)')
    .run(category.name, category.type, category.parentId ?? null);
  return Number(result.lastInsertRowid);
}
