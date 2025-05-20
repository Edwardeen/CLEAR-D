import mongoose, { Mongoose } from 'mongoose';

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
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI!, opts).then((mongooseInstance) => {
      return mongooseInstance;
    });
  }
  
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null; // Reset promise on error
    throw e;
  }
  
  if (!cached.conn) {
    // This case should ideally not be reached if connect succeeds.
    // But as a fallback, ensure we throw if conn is still null.
    throw new Error('Mongoose connection failed and conn is null');
  }
  
  return cached.conn;
}

export default dbConnect; 