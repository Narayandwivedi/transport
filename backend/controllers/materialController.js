const { Material } = require("../models");
const { refuse } = require("../utils/guards");

// Materials I supply on trips (sand, gitti, cement…)
const crudOptions = {
  sort: { name: 1 },
  searchFields: ["name"],
  prepare: async (req, data, old) => {
    data.name = String(data.name || "").trim();
    if (!data.name) throw refuse("Enter the material name");
    // Same name in any capitals counts as the same material
    const clash = await Material.findOne({ userId: req.userId, name: data.name, ...(old ? { _id: { $ne: old._id } } : {}) })
      .collation({ locale: "en", strength: 2 })
      .lean();
    if (clash) throw refuse("This material is already added");
    return data;
  },
};

module.exports = { crudOptions };
