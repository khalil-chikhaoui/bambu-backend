import app from "../src/index.js";
import { connectDB } from "../src/config/db.js";

export default async function handler(req, res) {
  // Ensure DB is connected before passing request to Express
  await connectDB(process.env.MONGODB_URI);

  // Pass the request to the exported Express app
  return app(req, res);
}

/**
 *
 *
 * Localhost (npm run dev): Node runs src/index.js. The condition process.argv[1] === __filename is true. The DB connects, and app.listen() starts. It works exactly as before.
 * Vercel: Vercel looks at api/index.js. That file imports src/index.js. When imported, the condition process.argv[1] === __filename is false, so app.listen() is skipped. Vercel then takes the exported app and handles the request via the serverless function.
 */
