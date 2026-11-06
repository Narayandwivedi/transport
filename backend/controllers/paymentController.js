// Money received from / paid to a party
const crudOptions = {
  sort: { date: -1, createdAt: -1 },
  populate: "partyId",
  dateField: "date",
  filters: ["partyId", "type", "mode"],
  searchFields: ["reference", "notes"],
};

module.exports = { crudOptions };
