# 📖 Bambu ERP API Documentation Index

## 🗂️ Quick Navigation

This document provides a complete index of all 29 documented API endpoints organized by module and file.

---

## 🔗 Endpoint Index by HTTP Method

### **GET Requests** (11 endpoints)
| Method | Endpoint | File | Protected |
|--------|----------|------|-----------|
| GET | `/users/profile` | profile.yaml | ✅ Yes |
| GET | `/users/reset-password/:token` | auth.yaml | ❌ No |
| GET | `/invitations/:token` | invitations.yaml | ❌ No |
| GET | `/organizations/:id` | organizations.yaml | ✅ Yes |
| GET | `/organizations/:id/members` | members.yaml | ✅ Yes |
| GET | `/organizations/:id/history` | history.yaml | ✅ Yes |
| GET | `/inventory/items` | items.yaml | ✅ Yes |
| GET | `/inventory/items/:id` | items.yaml | ✅ Yes |
| GET | `/inventory/history` | stock.yaml | ✅ Yes |
| GET | `/health` | (index.js) | ❌ No |
| GET | `/api/docs.json` | swagger.js | ❌ No |

### **POST Requests** (14 endpoints)
| Method | Endpoint | File | Protected |
|--------|----------|------|-----------|
| POST | `/contact` | general.yaml | ❌ No |
| POST | `/users/signin` | auth.yaml | ❌ No |
| POST | `/users/forgot-password` | auth.yaml | ❌ No |
| POST | `/users/reset-password` | auth.yaml | ❌ No |
| POST | `/users/avatar` | profile.yaml | ✅ Yes |
| POST | `/invitations/accept-login` | invitations.yaml | ❌ No |
| POST | `/invitations/accept-register` | invitations.yaml | ❌ No |
| POST | `/organizations/:id/upload-logo` | organizations.yaml | ✅ Yes |
| POST | `/organizations/:id/invite` | members.yaml | ✅ Yes |
| POST | `/organizations/:id/leave` | members.yaml | ✅ Yes |
| POST | `/inventory/items` | items.yaml | ✅ Yes |
| POST | `/inventory/movement` | stock.yaml | ✅ Yes |
| POST | `/api/docs` (Swagger UI) | swagger.js | ❌ No |

### **PUT Requests** (3 endpoints)
| Method | Endpoint | File | Protected |
|--------|----------|------|-----------|
| PUT | `/users/profile` | profile.yaml | ✅ Yes |
| PUT | `/organizations/:id` | organizations.yaml | ✅ Yes |
| PUT | `/organizations/:id/members/:memberId/role` | members.yaml | ✅ Yes |
| PUT | `/inventory/items/:id` | items.yaml | ✅ Yes |

### **DELETE Requests** (4 endpoints)
| Method | Endpoint | File | Protected |
|--------|----------|------|-----------|
| DELETE | `/users/avatar` | profile.yaml | ✅ Yes |
| DELETE | `/organizations/:id` | organizations.yaml | ✅ Yes |
| DELETE | `/organizations/:id/logo` | organizations.yaml | ✅ Yes |
| DELETE | `/organizations/:id/members/:memberId` | members.yaml | ✅ Yes |

---

## 📂 Endpoint Index by File

### **general.yaml** - Contact & Communication
```
POST   /api/contact                              Public contact form
```
**Features**: Honeypot protection, Email notifications, Background task queue

---

### **auth.yaml** - Authentication & Password Management
```
POST   /api/users/signin                         User login
POST   /api/users/forgot-password                Request password reset
GET    /api/users/reset-password/:token          Validate reset token
POST   /api/users/reset-password                 Complete password reset
```
**Features**: JWT token generation, Password reset tokens (15 min expiry), Email verification

---

### **profile.yaml** - User Profile & Avatar
```
GET    /api/users/profile                        Get user profile
PUT    /api/users/profile                        Update user profile
POST   /api/users/avatar                         Upload avatar
DELETE /api/users/avatar                         Delete avatar
```
**Features**: Profile updates, Avatar upload/delete, File storage, Organization title management

---

### **organizations.yaml** - Organization Management
```
GET    /api/organizations/:id                    Get organization details
PUT    /api/organizations/:id                    Update organization
DELETE /api/organizations/:id                    Delete organization
POST   /api/organizations/:id/upload-logo        Upload logo
DELETE /api/organizations/:id/logo               Delete logo
```
**Features**: Logo management, Member limit validation, Audit logging, Social links, Full CRUD

---

### **members.yaml** - Team Member Management
```
GET    /api/organizations/:id/members            List members & invites
POST   /api/organizations/:id/invite             Send invitation
PUT    /api/organizations/:id/members/:memberId/role    Change role
DELETE /api/organizations/:id/members/:memberId        Remove member
POST   /api/organizations/:id/leave              Leave organization
```
**Features**: Seat management, Role assignment, Email invitations, Audit logging, Auto-expiring invites

---

### **history.yaml** - Audit Trail & Activity Logs
```
GET    /api/organizations/:id/history            Get audit logs
```
**Features**: Pagination, Module filtering, Action filtering, Detailed change tracking, Metadata

---

### **invitations.yaml** - Invitation Flows
```
GET    /api/invitations/:token                   Validate invitation
POST   /api/invitations/accept-login             Accept (existing user)
POST   /api/invitations/accept-register          Accept (new user)
```
**Features**: Token validation, User existence check, Registration flow, Login flow

---

### **items.yaml** - Inventory Items
```
GET    /api/inventory/items                      List items with search
POST   /api/inventory/items                      Create item
GET    /api/inventory/items/:id                  Get item details
PUT    /api/inventory/items/:id                  Update item
```
**Features**: SKU validation, Category filtering, Full-text search, Min threshold tracking

---

### **stock.yaml** - Stock Movements & Ledger
```
POST   /api/inventory/movement                   Record movement
GET    /api/inventory/history                    Get ledger history
```
**Features**: IN/OUT movements, Quantity validation, Stock ledger, Pagination, Full-text search

---

## 🔐 Security Overview

### **Public Endpoints** (13 total)
No JWT authentication required:
- `POST /api/contact`
- `POST /api/users/signin`
- `POST /api/users/forgot-password`
- `GET /api/users/reset-password/:token`
- `POST /api/users/reset-password`
- `GET /api/invitations/:token`
- `POST /api/invitations/accept-login`
- `POST /api/invitations/accept-register`
- `GET /health`
- `GET /api/docs`
- `GET /api/docs.json`

### **Protected Endpoints** (16 total)
Require JWT Bearer token:
- All `/api/users/profile` endpoints
- All `/api/organizations/*` endpoints
- All `/api/inventory/*` endpoints

### **Role Requirements**
- **Admin**: Organization CRUD, member management, role changes, logo upload
- **Employee**: Profile access, inventory read/write, limited history access

---

## 🎯 Common Workflows

### User Registration & Onboarding
1. Admin: `POST /api/organizations/:id/invite` → Send invitation
2. User: `GET /api/invitations/:token` → Validate token
3. New User: `POST /api/invitations/accept-register` → Create account
4. Existing User: `POST /api/invitations/accept-login` → Join organization

### Password Recovery
1. User: `POST /api/users/forgot-password` → Request reset
2. User: `GET /api/users/reset-password/:token` → Check token validity
3. User: `POST /api/users/reset-password` → Complete reset

### Inventory Management
1. Admin: `POST /api/inventory/items` → Create item
2. User: `POST /api/inventory/movement` → Record stock change
3. User: `GET /api/inventory/history` → View ledger
4. User: `GET /api/inventory/items` → Browse items

### Organization Setup
1. Admin: `PUT /api/organizations/:id` → Update details
2. Admin: `POST /api/organizations/:id/upload-logo` → Upload branding
3. Admin: `POST /api/organizations/:id/invite` → Add team members
4. Admin: `GET /api/organizations/:id/history` → View audit log

---

## 📊 Data Flow Examples

### Example 1: User Authentication Flow
```
Client                          Server
  |                              |
  |--- POST /users/signin ------>|
  |                              | (Verify credentials)
  |<---- JWT Token + User --------|
  |                              |
  |--- POST /users/profile ------>|  (With Bearer token)
  |     (Authorization header)    |
  |<---- User Profile ------------|
```

### Example 2: Stock Movement Flow
```
Client                          Server
  |                              |
  |--- POST /inventory/movement ->|
  |     (type: "IN", qty: 5)      | (Update item quantity)
  |<---- Updated Quantity --------|
  |                              |
  |--- GET /inventory/history ---->|
  |     (with pagination)         | (Fetch ledger)
  |<---- Stock Movements ---------|
```

### Example 3: Invitation Flow
```
Client                          Server                       Email Service
  |                              |                                |
  |--- POST /invite ------------->|                                |
  |                              | (Generate token)              |
  |                              |--- Send Email -----+----------> Send Invite
  |<---- Success ------------------|                              |
  |                              |                                |
  | (User clicks email link)      |                                |
  |                              |                                |
  |--- GET /invitations/:token -->|                                |
  |<---- Invitation Valid ---------|                                |
  |                              |                                |
  |--- POST /accept-register ----->|                                |
  |     (password, token)         | (Create user + join org)      |
  |<---- JWT + User Profile ------|                                |
```

---

## 🔍 Data Model References

### Core Models
- **User** - User accounts with roles and memberships
- **Organization** - Company/entity with branding and settings
- **Item** - Inventory items with SKU and quantities
- **StockMovement** - Transaction history for inventory
- **Invitation** - Pending invitations (auto-expire after 7 days)
- **AuditLog** - Activity and change tracking
- **ContactMessage** - Public contact form submissions

### Relationships
```
User ---|belongs to|--- Organization (many-to-many via memberships)
Organization ---|has|--- Item (one-to-many)
Item ---|has|--- StockMovement (one-to-many)
User ---|performs|--- AuditLog (one-to-many)
Organization ---|has|--- Invitation (one-to-many)
```

---

## 📈 Statistics & Metrics

### Endpoint Distribution
- **GET**: 11 endpoints (38%)
- **POST**: 14 endpoints (48%)
- **PUT**: 3 endpoints (10%)
- **DELETE**: 1 endpoint (3%)

### Authentication Distribution
- **Public**: 13 endpoints (45%)
- **Protected**: 16 endpoints (55%)

### Module Distribution
- **Core Auth**: 4 endpoints
- **User Management**: 4 endpoints
- **Organization**: 5 endpoints
- **Team**: 5 endpoints
- **Inventory**: 6 endpoints
- **Audit/History**: 1 endpoint
- **Invitations**: 3 endpoints
- **General**: 1 endpoint

---

## 🚀 Integration Checklist

When integrating the Bambu ERP API:

- [ ] Read the `README.md` in `/src/docs/`
- [ ] Review authentication requirements
- [ ] Understand role-based access control
- [ ] Test with provided seed credentials
- [ ] Review all error codes and handlers
- [ ] Implement pagination for list endpoints
- [ ] Handle JWT token refresh/expiration
- [ ] Set up file upload handling for avatars/logos
- [ ] Configure email settings for password/invitations
- [ ] Test audit logging functionality

---

## 📞 Support & Questions

### For API Integration Help
1. Check the specific endpoint YAML file
2. Review the `README.md` documentation
3. Check the test credentials in `seed.js`
4. Run `npm run seed:local` to populate test data
5. Access Swagger UI at `http://localhost:3040/api/docs`

### For Errors
1. Check the error message code
2. Find the error in the endpoint documentation
3. Verify request format and required fields
4. Ensure JWT token is valid and not expired
5. Verify user has required permissions

---

**Last Updated**: May 15, 2025 | **Total Endpoints**: 29 | **Status**: ✅ Complete
