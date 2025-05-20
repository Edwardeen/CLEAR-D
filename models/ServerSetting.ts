import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IServerSetting extends Document {
  key: string; // Unique key, e.g., 'global_server_status'
  isServiceGloballyActive: boolean;
  updatedAt: Date;
}

const ServerSettingSchema: Schema<IServerSetting> = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'global_server_status', // Ensures only one document if this is the only key used
    },
    isServiceGloballyActive: {
      type: Boolean,
      required: true,
      default: true, // Server is active by default
    },
  },
  { timestamps: true } // Adds createdAt and updatedAt
);

// Defensive model definition that handles cases where mongoose.models might be undefined
let ServerSetting: Model<IServerSetting>;

// Check if the model is already defined in mongoose.models (if mongoose.models exists)
if (mongoose.models && mongoose.models.ServerSetting) {
  ServerSetting = mongoose.models.ServerSetting as Model<IServerSetting>;
} else {
  // If mongoose.models doesn't exist or the model isn't defined yet, create it
  try {
    ServerSetting = mongoose.model<IServerSetting>('ServerSetting');
  } catch (error) {
    // If the model doesn't exist and can't be retrieved, define it
    ServerSetting = mongoose.model<IServerSetting>('ServerSetting', ServerSettingSchema);
  }
}

export default ServerSetting;

// Function to initialize the setting if it doesn't exist
export async function initializeServerSetting() {
  try {
    const existingSetting = await ServerSetting.findOne({ key: 'global_server_status' });
    if (!existingSetting) {
      await ServerSetting.create({ key: 'global_server_status', isServiceGloballyActive: true });
      console.log('ServerSetting initialized.');
    }
  } catch (error) {
    console.error('Error initializing ServerSetting:', error);
  }
} 