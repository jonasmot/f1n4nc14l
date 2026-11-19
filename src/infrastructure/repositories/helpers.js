export function updateColumns(db, table, id, assignments) {
  const entries = Object.entries(assignments).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return 0;

  const setClause = entries.map(([column]) => `${column} = ?`).join(', ');
  const statement = db.prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`);
  const result = statement.run(...entries.map(([, value]) => value), id);
  return Number(result.changes);
}

export function booleanToInteger(value) {
  return value ? 1 : 0;
}

export function integerToBoolean(value) {
  return Boolean(value);
}
