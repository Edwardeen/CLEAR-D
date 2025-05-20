import mongoose, { Document, Model, Schema } from "mongoose";

export interface IQuestionBankItem extends Document {
  type: string; // Changed from enum type to allow any illness type
  questionId: string; // e.g. "G1", "C6", "C7"
  text: string;
  weight: number; // from reference doc (e.g. 1.82, 1.36, 3, 1.5…)
  autoPopulate?: boolean; // Flag to indicate if this question should be auto-populated
  autoPopulateFrom?: string; // Source for auto-population (e.g. 'userData.hasDiabetes')
}

const questionBankSchema = new Schema<IQuestionBankItem>(
  {
    type: { type: String, required: true },
    questionId: { type: String, required: true, unique: true }, // Assuming questionId should be unique overall
    text: { type: String, required: true },
    weight: { type: Number, required: true },
    autoPopulate: { type: Boolean, required: false },
    autoPopulateFrom: { type: String, required: false },
  },
  { timestamps: true } 
);

// Index for faster querying by type
questionBankSchema.index({ type: 1 });

// Create a compound index for type and questionId to ensure uniqueness within each illness type
questionBankSchema.index({ type: 1, questionId: 1 }, { unique: true });

const QuestionBank: Model<IQuestionBankItem> =
  mongoose.models.QuestionBank ||
  mongoose.model<IQuestionBankItem>("QuestionBank", questionBankSchema);

export default QuestionBank; 