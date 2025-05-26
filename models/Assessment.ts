import mongoose, { Schema, Document, models, Model, Types } from 'mongoose';

// Interface for the form data object
export interface IFormData {
  // Glaucoma Questions
  elevatedIOP: boolean;
  familyHistoryGlaucoma: boolean;
  suddenEyePain: boolean;
  ethnicityRisk: boolean;
  ageOver40: boolean;
  steroidUse: boolean;
  diabetes: boolean; // Shared question
  eyeInjury: boolean;
  poorVision: boolean;
  halosOrTunnelVision: boolean;
  // Cancer Questions
  unexplainedWeightLoss: boolean;
  familyHistoryCancer: boolean;
  tobaccoOrAlcohol: boolean;
  highRiskEnvironment: boolean;
  regularScreening: boolean;
}

export interface IAssessment extends Document {
  userId: mongoose.Schema.Types.ObjectId; // ref -> users._id
  type: string; // Changed from "glaucoma" | "cancer"
  responses: {
    questionId: string; // e.g. "G1", "C6"
    answer: string; // e.g. "Yes" | "No" | rating
    score: number; // computed per reference doc
    autoPopulated?: boolean; // Flag to indicate if this response was auto-populated
  }[];
  totalScore: number;
  riskLevel: string; // computed category
  recommendations: string[];
  createdAt: Date;
  // added from existing file
  doctor?: mongoose.Schema.Types.ObjectId; 
  patientName?: string;
  patientId?: string;
  date?: Date;
  glaucomaAssessment?: any; 
  cancerAssessment?: any; 
  notes?: string;
  version?: number;
  updatedAt?: Date;
}

const assessmentSchema = new Schema<IAssessment>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, required: true },
    responses: [
      {
        questionId: { type: String, required: true },
        answer: { type: String, required: true },
        score: { type: Number, required: true },
        autoPopulated: { type: Boolean },
      },
    ],
    totalScore: { type: Number, required: true },
    riskLevel: { type: String, required: true },
    recommendations: [{ type: String }],
    createdAt: { type: Date, default: Date.now },
    // added from existing file, marked as optional or removed if not in new spec
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, 
    patientName: { type: String },
    patientId: { type: String },
    date: { type: Date }, // createdAt is likely the replacement
    glaucomaAssessment: { type: Schema.Types.Mixed },
    cancerAssessment: { type: Schema.Types.Mixed },
    notes: { type: String },
    version: { type: Number, default: 1 }
  },
  { timestamps: true } // This will add createdAt and updatedAt
);

// Replace original createdAt with the one from timestamps: true for consistency
assessmentSchema.pre<IAssessment>("save", function (next) {
  if (!this.createdAt) {
    this.createdAt = new Date();
  }
  next();
});

// Ensure the model is not redefined if it already exists
const Assessment: Model<IAssessment> =
  mongoose.models.Assessment ||
  mongoose.model<IAssessment>("Assessment", assessmentSchema);

export default Assessment; 