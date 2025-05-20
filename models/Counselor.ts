import mongoose, { Document, Model, Schema } from "mongoose";

export interface IContactInfo {
  phone?: string;
  email?: string;
  website?: string;
}

export interface IOperatingHours {
  weekdays?: string;
  weekends?: string;
}

export interface ICounselor extends Document {
  name: string;
  type: "Kerajaan" | "Swasta" | "Individual" | "NGO" | "Other";
  state: string;
  address: string;
  contact?: IContactInfo;
  specializations?: string[];
  languages?: string[];
  qualifications?: string[];
  operating_hours?: IOperatingHours;
  createdAt?: Date;
  updatedAt?: Date;
}

const CounselorSchema: Schema<ICounselor> = new Schema(
  {
    name: { 
      type: String, 
      required: [true, 'Counselor name is required'],
      trim: true
    },
    type: { 
      type: String, 
      enum: ["Kerajaan", "Swasta", "Individual", "NGO", "Other"],
      required: [true, 'Type is required']
    },
    state: { 
      type: String, 
      required: [true, 'State is required'],
      trim: true
    },
    address: { 
      type: String, 
      required: [true, 'Address is required'],
      trim: true
    },
    contact: {
      phone: { type: String },
      email: { type: String },
      website: { type: String }
    },
    specializations: [{ type: String }],
    languages: [{ type: String }],
    qualifications: [{ type: String }],
    operating_hours: {
      weekdays: { type: String },
      weekends: { type: String }
    }
  },
  { timestamps: true } // Adds createdAt and updatedAt fields
);

// Create indices for faster queries
CounselorSchema.index({ state: 1 });
CounselorSchema.index({ type: 1 });
CounselorSchema.index({ name: 'text' }); // Enable text search on name field
CounselorSchema.index({ specializations: 1 });

// Ensure the model is not redefined if it already exists
const Counselor: Model<ICounselor> = mongoose.models.Counselor || mongoose.model<ICounselor>('Counselor', CounselorSchema);

export default Counselor; 