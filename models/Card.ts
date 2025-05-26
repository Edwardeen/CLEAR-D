import mongoose, { Document, Model, Schema } from "mongoose";

export interface ICard extends Document {
  userId: mongoose.Schema.Types.ObjectId; // ref -> users._id
  cardNo: string; // auto-generated unique
  issueDate: Date;
  diabetes: boolean;
  riskFor: ("glaucoma" | "cancer")[]; // Array of strings
  recommendations?: {
    glaucoma?: string[];
    cancer?: string[];
  };
  qrCodeUrl: string; // link to full profile endpoint
  pdfUrl: string; // generated downloadable card
  createdAt?: Date; // Added by timestamps: true
  updatedAt?: Date; // Added by timestamps: true
}

const cardSchema = new Schema<ICard>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    cardNo: { type: String, required: true, unique: true },
    issueDate: { type: Date, default: Date.now, required: true },
    diabetes: { type: Boolean, required: true },
    riskFor: [{ type: String, enum: ["glaucoma", "cancer"], required: true }],
    recommendations: {
      glaucoma: [{ type: String }],
      cancer: [{ type: String }],
    },
    qrCodeUrl: { type: String, required: true },
    pdfUrl: { type: String, required: true },
  },
  { timestamps: true } // Adds createdAt and updatedAt fields
);

const Card: Model<ICard> =
  mongoose.models.Card || mongoose.model<ICard>("Card", cardSchema);

export default Card; 