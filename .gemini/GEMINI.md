# Bambu ERP - Backend Agent Rules

## Tech Stack & Architecture
* **Core:** Node.js, Express.js.
* **Database:** MongoDB (using Mongoose for data structures).
* **Testing:** Jest & Supertest (with MongoMemoryServer).
* **Architecture:** Strict modular structure (`config`, `controllers`, `middlewares`, `models`, `routes`). Keep controllers organized by domain.
* **Documentation:** Do NOT write or update Swagger documentation/docs at this time.

## Core Middleware & Standards
* **Authentication:** Always use the `protect` middleware for private routes. The authenticated user is accessible via `req.user` (password is automatically excluded).
* **Error Handling:** Every controller function MUST be wrapped in `asyncHandler` from `express-async-handler`.
* **Throwing Errors:** Do not use `res.send` for errors. Set the status code and throw a standard error string (e.g., `res.status(404); throw new Error("RESERVATION_NOT_FOUND");`). The global `errorHandler` will catch it.

## The Audit Log Protocol (CRITICAL)
The `AuditLog` is the core tracking mechanism for the ERP. Any controller that mutates data (POST, PUT, PATCH, DELETE) MUST invoke the `logAudit` service asynchronously. 
* **Required Fields:** Always provide `organizationId`, `actor` (`req.user._id`), `module` (e.g., "TEAM", "RESERVATIONS", "SETTINGS"), and `action` (e.g., "RESERVATION_REQUESTED").
* **Target Mapping:** Always include `targetModel` (the exact model name) and `targetId`.
* **Metadata:** Utilize the `metadata` object to store quick-access strings needed for the frontend UI to avoid complex database joins (e.g., `resourceName`, `targetEmail`).
* **State Changes:** For PUT/PATCH requests, always include a `diff` object with `before` and `after` states.

## Testing Mandates
* Every new controller or route must have a corresponding test file.
* The `tests/` directory must perfectly mirror the exact nested file structure of the `src/` directory.
* Always mock the `audit.service.js` to prevent side effects during testing.