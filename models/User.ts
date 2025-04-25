import mongoose, { Schema, Document, models, Model } from 'mongoose';

export interface IUser extends Document {
  email: string;
  name: string;
  password?: string; // Optional because it might not be returned in all queries
  role: 'user' | 'doctor';
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema<IUser> = new Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required.'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, 'Please enter a valid email address.'],
    },
    name: {
      type: String,
      required: [true, 'Name is required.'],
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required.'],
      select: false, // Prevent password from being returned by default
    },
    role: {
      type: String,
      enum: ['user', 'doctor'],
      default: 'user',
    },
  },
  { timestamps: true } // Adds createdAt and updatedAt fields
);

// Ensure the model is not redefined if it already exists
const User: Model<IUser> = models.User || mongoose.model<IUser>('User', UserSchema);

export default User; 