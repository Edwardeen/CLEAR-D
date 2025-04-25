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
  userId: Types.ObjectId; // Reference to User model
  formData: IFormData;
  glaucomaScore: number;
  cancerScore: number;
  higherRiskDisease: 'glaucoma' | 'cancer' | 'both' | 'none'; // Added 'none'
  recommendations: string;
  glaucomaRecommendations: string;
  cancerRecommendations: string;
  timestamp: Date;
}

const AssessmentSchema: Schema<IAssessment> = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User', // Reference to the User model
    required: true,
  },
  formData: {
    type: Object,
    required: true,
  },
  glaucomaScore: {
    type: Number,
    required: true,
    min: 0,
    max: 10,
  },
  cancerScore: {
    type: Number,
    required: true,
    min: 0,
    max: 10,
  },
  higherRiskDisease: {
    type: String,
    enum: ['glaucoma', 'cancer', 'both', 'none'],
    required: true,
  },
  recommendations: {
    type: String,
    required: true,
  },
    glaucomaRecommendations: {
    type: String,
    required: true,
  },
    cancerRecommendations: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Ensure the model is not redefined if it already exists
const Assessment: Model<IAssessment> = models.Assessment || mongoose.model<IAssessment>('Assessment', AssessmentSchema);

export default Assessment; 