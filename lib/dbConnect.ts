import mongoose, { Mongoose } from 'mongoose';
import { initializeServerSetting } from '../models/ServerSetting';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env.local'
  );
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections from growing exponentially
 * during API Route usage.
 */
interface MongooseCache {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

// Augment the NodeJS Global type with our mongoose cache
declare global {
  // eslint-disable-next-line no-var
  var mongoose_cache: MongooseCache | undefined;
}

let cached: MongooseCache;

if (process.env.NODE_ENV === 'production') {
  cached = (global as any).mongoose_cache = global.mongoose_cache || { conn: null, promise: null };
} else {
  // In development, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  if (!global.mongoose_cache) {
    global.mongoose_cache = { conn: null, promise: null };
  }
  cached = global.mongoose_cache;
}


async function dbConnect(): Promise<Mongoose> {
  if (cached.conn) {
    // If already connected, and server setting initialization was successful on first connect, no need to re-initialize.
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      // Consider adding other options like serverSelectionTimeoutMS if needed
    };

    cached.promise = mongoose.connect(MONGODB_URI!, opts)
      .then(async (mongooseInstance) => { // Make the .then callback async
        console.log("MongoDB Connected...");
        // Initialize server settings after successful first connection
        // This should ideally only run once per application startup or first connection attempt.
        await initializeServerSetting(); 
        return mongooseInstance;
      })
      .catch(err => {
        console.error("MongoDB connection error in promise chain:", err);
        cached.promise = null; // Reset promise on error in chain
        throw err; // Re-throw to be caught by the outer try/catch
      });
  }
  
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null; // Reset promise on error from await
    console.error("MongoDB connection error awaiting promise:", e);
    throw e;
  }
  
  if (!cached.conn) {
    // This case should ideally not be reached if connect succeeds.
    // But as a fallback, ensure we throw if conn is still null.
    throw new Error('Mongoose connection failed and cached.conn is null after await');
  }
  
  return cached.conn;
}

export default dbConnect; 