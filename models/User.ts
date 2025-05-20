import mongoose, { Schema, Document, models, Model } from 'mongoose';

export type UserRole = "user" | "doctor" | "admin";

export interface IUser extends Document {
  icPassportNo?: string;
  name?: {
    first?: string;
    last?: string;
  };
  dateOfBirth?: Date;
  email?: string;
  password?: string;
  gender?: "Male" | "Female" | "Other";
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  phone?: string;
  emergencyContact?: {
    name?: string;
    relationship?: string;
    phone?: string;
  };
  maritalStatus?: "Single" | "Married" | "Divorced" | "Widowed";
  race?: string;
  profession?: string;
  photoUrl?: string;
  photoPublicId?: string;
  heightCm?: number;
  weightKg?: number;
  bloodType?: string; // e.g. "A+", "O-"
  allergies?: string[];
  vaccinationHistory?: {
    vaccine: string;
    date: Date;
  }[];
  currentMedications?: {
    name: string;
    dosage: string;
  }[];
  okuStatus?: boolean;
  insurance?: {
    certificateNo?: string;
    company?: string;
  };
  hasDiabetes?: boolean;
  role?: UserRole;
  createdAt?: Date;
  updatedAt?: Date;
}

const UserSchema: Schema<IUser> = new Schema(
  {
    icPassportNo: { type: String },
    name: {
      first: { type: String, trim: true },
      last: { type: String, trim: true },
    },
    dateOfBirth: { type: Date },
    email: {
      type: String,
      required: [true, 'Email is required.'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, 'Please enter a valid email address.'],
    },
    password: {
      type: String,
      required: [true, 'Password is required.'],
      select: false, // Prevent password from being returned by default
    },
    gender: { type: String, enum: ["Male", "Female", "Other"] },
    address: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      postcode: { type: String },
      country: { type: String },
    },
    phone: { type: String },
    emergencyContact: {
      name: { type: String },
      relationship: { type: String },
      phone: { type: String },
    },
    maritalStatus: {
      type: String,
      enum: ["Single", "Married", "Divorced", "Widowed"],
    },
    race: { type: String },
    profession: { type: String },
    photoUrl: { type: String },
    photoPublicId: { type: String },
    heightCm: { type: Number },
    weightKg: { type: Number },
    bloodType: { type: String },
    allergies: [{ type: String }],
    vaccinationHistory: [
      {
        vaccine: { type: String },
        date: { type: Date },
      },
    ],
    currentMedications: [
      {
        name: { type: String },
        dosage: { type: String },
      },
    ],
    okuStatus: { type: Boolean },
    insurance: {
      certificateNo: { type: String },
      company: { type: String },
    },
    hasDiabetes: { type: Boolean, default: false },
    role: { type: String, enum: ["user", "doctor", "admin"] as UserRole[], default: "user" },
  },
  { timestamps: true } // Adds createdAt and updatedAt fields
);

// Ensure the model is not redefined if it already exists
const User: Model<IUser> = models.User || mongoose.model<IUser>('User', UserSchema);

export default User; 