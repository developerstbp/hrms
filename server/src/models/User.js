import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, default: "", trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ["admin", "hr", "hod", "manager", "employee"], default: "employee", index: true },
  permissions: [{ type: String }],
  permissionSchemaVersion: { type: Number, default: 2 },
  isActive: { type: Boolean, default: true },
  mustChangePassword: { type: Boolean, default: false },
  lastLoginAt: { type: Date, default: null }
}, { timestamps: true });

const User = mongoose.model("User", userSchema);
export default User;
