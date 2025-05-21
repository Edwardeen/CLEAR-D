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

export interface IHospital extends Document {
  _id: mongoose.Types.ObjectId;
  id?: string;
  name: string;
  type: "Kerajaan" | "Swasta" | "Individual" | "NGO" | "Other";
  state: string;
  address: string;
  contact?: IContactInfo;
  specialists?: string | string[];
  services?: string[];
  operating_hours?: IOperatingHours;
  google_maps_link?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const HospitalSchema: Schema<IHospital> = new Schema(
  {
    name: { 
      type: String, 
      required: [true, 'Hospital/Counselor name is required'],
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
    specialists: {
      type: Schema.Types.Mixed, // Can be a string or array of strings
      default: "-"
    },
    services: [{ type: String }],
    operating_hours: {
      weekdays: { type: String },
      weekends: { type: String }
    },
    google_maps_link: {
      type: String,
      trim: true
    }
  },
  { timestamps: true } // Adds createdAt and updatedAt fields
);

// Create indices for faster queries
HospitalSchema.index({ state: 1 });
HospitalSchema.index({ type: 1 });
HospitalSchema.index({ name: 'text' }); // Enable text search on name field

// Ensure the model is not redefined if it already exists
const Hospital: Model<IHospital> = mongoose.models.Hospital || mongoose.model<IHospital>('Hospital', HospitalSchema);

export default Hospital; 