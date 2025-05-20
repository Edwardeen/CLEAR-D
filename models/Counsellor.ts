import mongoose, { Document, Model, Schema } from "mongoose";

export interface ICounsellor extends Document {
  name: string;
  phone: string;
  email: string;
  specialty: string; // e.g. "Diabetes Education"
}

const counsellorSchema = new Schema<ICounsellor>(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true, unique: true }, // Assuming email should be unique
    specialty: { type: String, required: true },
  },
  { timestamps: true } // Adds createdAt and updatedAt fields
);

const Counsellor: Model<ICounsellor> =
  mongoose.models.Counsellor ||
  mongoose.model<ICounsellor>("Counsellor", counsellorSchema);

export default Counsellor; 