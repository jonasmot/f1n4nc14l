export function listHolidays(db) {
  return db.prepare('SELECT date, name FROM holidays ORDER BY date').all();
}

export function holidaySetFromDatabase(db) {
  return new Set(listHolidays(db).map((holiday) => holiday.date));
}
