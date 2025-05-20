import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IIllness extends Document {
  name: string; // User-friendly name, e.g., "Diabetes Mellitus", "Glaucoma"
  type: string; // Unique key/slug, e.g., "diabetes", "glaucoma" (used in API routes and for linking questions)
  description?: string;
  isSystemDefined: boolean; // True for core illnesses like Glaucoma, Cancer, false for official-added ones
  createdAt: Date;
  updatedAt: Date;
}

const illnessSchema = new Schema<IIllness>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, trim: true },
    isSystemDefined: { type: Boolean, default: false, required: true },
  },
  { timestamps: true } // This will add createdAt and updatedAt
);

// Ensure 'name' is unique as well, as it's user-facing for identification
illnessSchema.index({ name: 1 }, { unique: true });

const Illness: Model<IIllness> = mongoose.models.Illness || mongoose.model<IIllness>('Illness', illnessSchema);

export default Illness; 