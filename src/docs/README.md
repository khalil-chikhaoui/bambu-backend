# 🚀 Bambu ERP API Documentation

Complete OpenAPI 3.0.0 documentation for the Bambu ERP Backend. All endpoints are fully documented with request/response examples, authentication requirements, and error handling.

## 📋 Table of Contents

### 1. **General** (`general.yaml`)
Public endpoints for contact form and communication.
- `POST /api/contact` - Create contact message (with honeypot spam protection)

### 2. **Authentication** (`auth.yaml`)
Public authentication endpoints for user login and password management.
- `POST /api/users/signin` - User login
- `POST /api/users/forgot-password` - Request password reset
- `GET /api/users/reset-password/:token` - Validate reset token
- `POST /api/users/reset-password` - Complete password reset

### 3. **User Profile** (`profile.yaml`)
Protected endpoints for user profile management.
- `GET /api/users/profile` - Get authenticated user profile
- `PUT /api/users/profile` - Update user profile
- `POST /api/users/avatar` - Upload user avatar
- `DELETE /api/users/avatar` - Delete user avatar

### 4. **Organizations** (`organizations.yaml`)
Endpoints for managing organization settings and branding.
- `GET /api/organizations/:id` - Get organization details
- `PUT /api/organizations/:id` - Update organization profile
- `DELETE /api/organizations/:id` - Delete organization
- `POST /api/organizations/:id/upload-logo` - Upload organization logo
- `DELETE /api/organizations/:id/logo` - Delete organization logo

### 5. **Team Members** (`members.yaml`)
Endpoints for managing team members and invitations.
- `GET /api/organizations/:id/members` - Get all members (active + pending)
- `POST /api/organizations/:id/invite` - Invite new member
- `PUT /api/organizations/:id/members/:memberId/role` - Update member role
- `DELETE /api/organizations/:id/members/:memberId` - Remove member or cancel invitation
- `POST /api/organizations/:id/leave` - Leave organization

### 6. **Organization History** (`history.yaml`)
Audit trail and activity log endpoints.
- `GET /api/organizations/:id/history` - Get organization audit logs with filtering

### 7. **Invitations** (`invitations.yaml`)
Public endpoints for handling invitation acceptance flows.
- `GET /api/invitations/:token` - Validate invitation token
- `POST /api/invitations/accept-login` - Accept invitation (existing user)
- `POST /api/invitations/accept-register` - Accept invitation (new user)

### 8. **Inventory Items** (`items.yaml`)
Endpoints for managing inventory items.
- `GET /api/inventory/items` - Get all items with search/filter
- `POST /api/inventory/items` - Create new item
- `GET /api/inventory/items/:id` - Get item details
- `PUT /api/inventory/items/:id` - Update item details

### 9. **Inventory Stock** (`stock.yaml`)
Endpoints for stock movements and ledger history.
- `POST /api/inventory/movement` - Record stock IN/OUT movement
- `GET /api/inventory/history` - Get inventory ledger with pagination

---

## 🔐 Security & Authentication

### JWT Bearer Token
Most endpoints require JWT bearer token authentication. Include in request header:
```
Authorization: Bearer <jwt_token>
```

### Public Endpoints (No Auth Required)
- `POST /api/contact` - Contact form
- `POST /api/users/signin` - Sign in
- `POST /api/users/forgot-password` - Forgot password
- `GET /api/users/reset-password/:token` - Validate reset token
- `POST /api/users/reset-password` - Reset password
- `GET /api/invitations/:token` - Validate invitation
- `POST /api/invitations/accept-login` - Accept invite (existing user)
- `POST /api/invitations/accept-register` - Accept invite (new user)

### Role-Based Access
- **Admin**: Full control over organization settings, members, inventory
- **Employee**: Limited to profile, reading organization data, inventory operations

---

## 📊 Data Models Summary

### User
```json
{
  "_id": "ObjectId",
  "firstName": "string",
  "lastName": "string",
  "email": "string (unique)",
  "password": "string (hashed)",
  "profileImage": "string",
  "phoneNumber": { "country": "string", "number": "string" },
  "address": { "street", "city", "state", "zipCode", "country" },
  "memberships": [
    {
      "organizationId": "ObjectId",
      "role": "admin|employee",
      "title": "string"
    }
  ],
  "createdAt": "ISO DateTime",
  "updatedAt": "ISO DateTime"
}
```

### Organization
```json
{
  "_id": "ObjectId",
  "name": "string",
  "legalName": "string",
  "description": "string",
  "logo": "string (URL)",
  "maxMembers": "number",
  "email": "string",
  "website": "string",
  "phoneNumber": { "country": "string", "number": "string" },
  "address": { "street", "city", "state", "zipCode", "country" },
  "taxId": "string",
  "registrationNumber": "string",
  "socialLinks": { "facebook", "twitter", "linkedin", "instagram" },
  "timezone": "string",
  "createdAt": "ISO DateTime",
  "updatedAt": "ISO DateTime"
}
```

### Inventory Item
```json
{
  "_id": "ObjectId",
  "organizationId": "ObjectId (ref)",
  "name": "string",
  "sku": "string (unique per org)",
  "category": "string",
  "currentQuantity": "number",
  "minThreshold": "number",
  "createdAt": "ISO DateTime",
  "updatedAt": "ISO DateTime"
}
```

### Stock Movement
```json
{
  "_id": "ObjectId",
  "organizationId": "ObjectId",
  "itemId": "ObjectId (ref)",
  "actor": "ObjectId (ref to User)",
  "type": "CREATED|IN|OUT|UPDATED",
  "quantity": "number",
  "projectId": "ObjectId (optional)",
  "notes": "string",
  "createdAt": "ISO DateTime"
}
```

### Invitation
```json
{
  "_id": "ObjectId",
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "organizationId": "ObjectId (ref)",
  "role": "admin|employee",
  "title": "string",
  "token": "string (unique, 32-byte hex)",
  "status": "Pending|Accepted",
  "invitedBy": "ObjectId (ref to User)",
  "createdAt": "ISO DateTime (expires in 7 days)",
  "expiresAt": "ISO DateTime"
}
```

### Audit Log
```json
{
  "_id": "ObjectId",
  "organizationId": "ObjectId",
  "actor": "ObjectId (ref to User)",
  "module": "SETTINGS|TEAM|INVENTORY",
  "action": "string (e.g., ORG_UPDATED, INVITE_SENT)",
  "targetModel": "Organization|User|Invitation|Item|StockMovement",
  "targetId": "ObjectId",
  "metadata": "object (context-specific)",
  "diff": "object (before/after for updates)",
  "createdAt": "ISO DateTime",
  "updatedAt": "ISO DateTime"
}
```

---

## 🔗 API Base URL

```
Development: http://localhost:3040/api
Documentation: http://localhost:3040/api/docs
JSON Spec: http://localhost:3040/api/docs.json
```

---

## 🎯 Common Use Cases

### User Onboarding Flow
1. **New User Signup**: Admin invites user → Email sent with token
2. **User Accepts (New Account)**: `POST /api/invitations/accept-register` → Account created + joined org
3. **User Accepts (Existing Account)**: `POST /api/invitations/accept-login` → Password verified + joined org

### Password Recovery Flow
1. **Request Reset**: `POST /api/users/forgot-password`
2. **Validate Token**: `GET /api/users/reset-password/:token`
3. **Complete Reset**: `POST /api/users/reset-password`

### Member Management Flow
1. **Invite Member**: `POST /api/organizations/:id/invite`
2. **View Members**: `GET /api/organizations/:id/members`
3. **Update Role**: `PUT /api/organizations/:id/members/:memberId/role`
4. **Remove Member**: `DELETE /api/organizations/:id/members/:memberId`

### Stock Management Flow
1. **Create Item**: `POST /api/inventory/items`
2. **Record Movement**: `POST /api/inventory/movement` (IN or OUT)
3. **View Ledger**: `GET /api/inventory/history`
4. **Update Item**: `PUT /api/inventory/items/:id`

---

## ⚠️ Error Handling

All error responses follow standard format:
```json
{
  "status": "error",
  "message": "ERROR_CODE"
}
```

### Common HTTP Status Codes
- `200 OK` - Successful GET/POST
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid input or validation error
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

### Common Error Messages
| Code | Meaning |
|------|---------|
| `AUTH_INVALID_CREDENTIALS` | Wrong email/password |
| `AUTH_USER_NOT_FOUND` | User doesn't exist |
| `AUTH_TOKEN_INVALID` | JWT token is invalid/expired |
| `ORG_NOT_FOUND` | Organization doesn't exist |
| `ORG_MAX_MEMBERS_EXCEEDED` | Org has reached member limit |
| `MEMBER_NOT_FOUND` | Member doesn't exist |
| `ITEM_NOT_FOUND` | Inventory item doesn't exist |
| `INSUFFICIENT_STOCK` | Not enough stock for OUT movement |
| `INVITATION_INVALID` | Invitation token invalid/expired |
| `UPLOAD_NO_FILE` | No file provided for upload |

---

## 📝 Testing with Examples

### Example 1: Create Contact Message
```bash
curl -X POST http://localhost:3040/api/contact \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Demande d'\''information",
    "firstName": "Jean",
    "lastName": "Dupont",
    "email": "jean@example.com",
    "message": "Bonjour, je suis intéressé par vos services...",
    "phone": "+33612345678",
    "language": "fr",
    "wantsPhoneMeeting": true
  }'
```

### Example 2: Sign In
```bash
curl -X POST http://localhost:3040/api/users/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@bambu-services.com",
    "password": "password123",
    "rememberMe": true
  }'
```

### Example 3: Create Inventory Item
```bash
curl -X POST http://localhost:3040/api/inventory/items \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt_token>" \
  -d '{
    "organizationId": "507f1f77bcf86cd799439011",
    "name": "Laptop Dell XPS 15",
    "sku": "DELL-XPS-15-001",
    "category": "IT",
    "minThreshold": 5
  }'
```

### Example 4: Record Stock Movement
```bash
curl -X POST http://localhost:3040/api/inventory/movement \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt_token>" \
  -d '{
    "organizationId": "507f1f77bcf86cd799439011",
    "itemId": "507f1f77bcf86cd799439012",
    "type": "IN",
    "quantity": 5,
    "notes": "Received shipment from supplier XYZ"
  }'
```

---

## 🔄 Seed Data Available

The database includes pre-seeded data for testing:

### Organizations
- **Bambu HQ** - Primary organization
  - Logo: Bambu official logo
  - Max Members: 20
  - Email: contact@bambu-services.com
  
- **NovaTech Solutions** - Secondary organization
  - Max Members: 50
  - Email: hello@novatech.fr

### Users
- **Admin System** (admin@bambu-services.com)
  - Password: `password123`
  - Roles: Admin in both organizations
  
- **Khalil Chikhaoui** (chikhaouikhl@gmail.com)
  - Password: `21459708Az*`
  - Role: Admin in NovaTech Solutions

---

## 🚀 Getting Started

1. **Start the server**:
   ```bash
   npm run start:local
   ```

2. **View API documentation**:
   ```
   http://localhost:3040/api/docs
   ```

3. **Access API endpoint**:
   ```
   http://localhost:3040/api
   ```

4. **Seed the database** (optional):
   ```bash
   npm run seed:local
   ```

---

## 📚 Documentation Files

| File | Endpoints | Purpose |
|------|-----------|---------|
| `general.yaml` | 1 | Contact form & public messages |
| `auth.yaml` | 4 | User authentication & password management |
| `profile.yaml` | 4 | User profile & avatar management |
| `organizations.yaml` | 5 | Organization settings & branding |
| `members.yaml` | 5 | Team member & invitation management |
| `history.yaml` | 1 | Organization audit logs & activity |
| `invitations.yaml` | 3 | Invitation validation & acceptance |
| `items.yaml` | 4 | Inventory item management |
| `stock.yaml` | 2 | Stock movements & ledger |

**Total: 29 Fully Documented Endpoints**

---

## ✅ Quality Assurance

All documentation includes:
- ✅ Detailed endpoint descriptions
- ✅ Full request/response schemas with examples
- ✅ Authentication requirements clearly marked
- ✅ All HTTP status codes & error messages
- ✅ Real data examples from seed.js
- ✅ Parameter descriptions & constraints
- ✅ Use case workflows and patterns
- ✅ OpenAPI 3.0.0 compliance
- ✅ Swagger UI integration ready

---

**Last Updated**: May 15, 2025 | **API Version**: 1.0.0 | **Status**: ✅ Complete
