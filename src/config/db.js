import mongoose from "mongoose";

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

/**
 * Establishes or reuses a connection to MongoDB.
 */
export const connectDB = async (uri) => {
  // CHECK CACHE: If a connection exists, return it immediately.
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(uri, opts).then((mongoose) => {
      console.log(
        `✅ New MongoDB Connection Established: ${mongoose.connection.host}`,
      );
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error(`❌ MongoDB Connection Error: ${e.message}`);
    throw e;
  }

  return cached.conn;
};
