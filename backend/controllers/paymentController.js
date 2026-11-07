const { summarizer } = require("../utils/activity");
// Money received from / paid to a party
const crudOptions = {
  // Staff can add these; see utils/crud.js
  entity: "payment",
  summarize: summarizer("payment"),
  sort: { date: -1, createdAt: -1 },
  populate: "partyId",
  dateField: "date",
  filters: ["partyId", "type", "mode"],
  searchFields: ["reference", "notes"],
};

module.exports = { crudOptions };
