const { Schema, ObjectId, owner, makeModel } = require("./schemaHelpers");

const attendanceSchema = new Schema({
  ...owner,
  employeeId: { type: ObjectId, ref: "Employee", required: true },
  date: { type: Date, required: true },
  status: { type: String, enum: ["present", "half", "absent"], required: true },
});
attendanceSchema.index({ userId: 1, employeeId: 1, date: 1 }, { unique: true });

const Attendance = makeModel("Attendance", attendanceSchema);

module.exports = Attendance;
