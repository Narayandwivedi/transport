const { toNumber, lineAmount } = require("../utils/common");
const { refuse } = require("../utils/guards");

// Rate quotations for a party (or someone not saved yet)
const crudOptions = {
  sort: { date: -1, createdAt: -1 },
  populate: "partyId",
  dateField: "date",
  filters: ["partyId", "status"],
  searchFields: ["quoteNo", "customerName", "subject"],
  number: { field: "quoteNo", key: "quotation", prefix: "QT" },
  prepare: async (req, data) => {
    data.items = (Array.isArray(data.items) ? data.items : [])
      .filter((item) => item.description || item.from || item.to || toNumber(item.rate))
      .map((item) => ({ ...item, amount: lineAmount(item.basis, item.quantity, item.rate) }));
    if (!data.items.length) throw refuse("Add at least one line");
    if (!data.partyId && !data.customerName) throw refuse("Pick a party or type the customer name");
    return data;
  },
};

module.exports = { crudOptions };
