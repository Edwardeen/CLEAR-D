import mongoose, { Document, Model, Schema } from "mongoose";

export interface IResult extends Document {
  userId: mongoose.Schema.Types.ObjectId; // ref -> users._id
  glaucoma: {
    score: number;
    riskLevel: string;
    recommendations: string[];
  };
  cancer: {
    score: number;
    riskLevel: string;
    recommendations: string[];
  };
  higherRiskDisease: "glaucoma" | "cancer" | "both";
  timestamp: Date;
}

const resultSchema = new Schema<IResult>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    glaucoma: {
      score: { type: Number, required: true },
      riskLevel: { type: String, required: true },
      recommendations: [{ type: String }],
    },
    cancer: {
      score: { type: Number, required: true },
      riskLevel: { type: String, required: true },
      recommendations: [{ type: String }],
    },
    higherRiskDisease: {
      type: String,
      enum: ["glaucoma", "cancer", "both"],
      required: true,
    },
    timestamp: { type: Date, default: Date.now, required: true },
  },
  { timestamps: true } // Adds createdAt and updatedAt fields
);

const Result: Model<IResult> =
  mongoose.models.Result || mongoose.model<IResult>("Result", resultSchema);

export default Result; 