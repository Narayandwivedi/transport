const hasValue = (value) => value !== null && value !== undefined && value !== '';

// Entries saved before opening / closing existed have only "reading": it is their closing
export const openingOf = (reading) => (hasValue(reading.openingReading) ? Number(reading.openingReading) : null);
export const closingOf = (reading) => {
  if (hasValue(reading.closingReading)) return Number(reading.closingReading);
  return hasValue(reading.openingReading) ? null : Number(reading.reading || 0);
};
export const runOf = (reading) => {
  const opening = openingOf(reading);
  const closing = closingOf(reading);
  return opening !== null && closing !== null ? closing - opening : null;
};
