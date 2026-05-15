import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Import your controllers and models
import { 
  getItems, 
  getItemById, 
  createItem, 
  updateItem 
} from '../../../src/controllers/inventory/items.controller.js';
import Item from '../../../src/models/Item.js';
import StockMovement from '../../../src/models/StockMovement.js';

// Setup Fake App & Middleware
const app = express();
app.use(express.json());

// Mocking the authenticated user (req.user._id is used in create and update)
const testUserId = new mongoose.Types.ObjectId();
const fakeAuth = (req, res, next) => {
  req.user = { _id: testUserId };
  next();
};

// Route Definitions
app.get('/api/inventory/items', getItems);
app.get('/api/inventory/items/:id', getItemById);
app.post('/api/inventory/items', fakeAuth, createItem);
app.put('/api/inventory/items/:id', fakeAuth, updateItem);

// Centralized error handler for the test app
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({ message: err.message });
});

describe('Inventory Items Controller Tests', () => {
  let mongoServer;
  const testOrgId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await Item.deleteMany({});
    await StockMovement.deleteMany({});
  });

  // ---------------------------------------------------------
  // CREATE ITEM
  // ---------------------------------------------------------
  describe('POST /api/inventory/items', () => {
    it('should create an item and verify the automatic stock movement log', async () => {
      const payload = {
        organizationId: testOrgId,
        name: 'Industrial Drill',
        sku: 'DRL-700',
        category: 'Power Tools',
        minThreshold: 10
      };

      const response = await request(app).post('/api/inventory/items').send(payload);

      expect(response.status).toBe(201);
      expect(response.body.sku).toBe('DRL-700');

      // Verify the Ledger entry (StockMovement) was created automatically
      const movement = await StockMovement.findOne({ itemId: response.body._id });
      expect(movement).not.toBeNull();
      expect(movement.type).toBe('CREATED');
      expect(movement.notes).toBe("Création de l'article");
    });
  });

  // ---------------------------------------------------------
  // GET ITEMS & SEARCH
  // ---------------------------------------------------------
  describe('GET /api/inventory/items', () => {
    beforeEach(async () => {
      await Item.create([
        { name: 'Laptop Pro', sku: 'LAP-001', category: 'IT', organizationId: testOrgId },
        { name: 'Monitor 4K', sku: 'MON-99', category: 'IT', organizationId: testOrgId },
        { name: 'Office Chair', sku: 'CHR-12', category: 'Furniture', organizationId: testOrgId }
      ]);
    });

    it('should return all items for the specific organization', async () => {
      const response = await request(app)
        .get('/api/inventory/items')
        .query({ organizationId: testOrgId.toString() });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);
    });

    it('should filter items by search string (case-insensitive)', async () => {
      const response = await request(app)
        .get('/api/inventory/items')
        .query({ organizationId: testOrgId.toString(), search: 'laptop' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].sku).toBe('LAP-001');
    });

    it('should filter items by category', async () => {
      const response = await request(app)
        .get('/api/inventory/items')
        .query({ organizationId: testOrgId.toString(), category: 'Furniture' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Office Chair');
    });
  });

  // ---------------------------------------------------------
  // UPDATE ITEM & LEDGER
  // ---------------------------------------------------------
  describe('PUT /api/inventory/items/:id', () => {
    let existingItem;

    beforeEach(async () => {
      existingItem = await Item.create({
        name: 'Original Name',
        sku: 'ORIG-1',
        category: 'Old Cat',
        minThreshold: 5,
        organizationId: testOrgId
      });
    });

    it('should update fields and record a precise diff in StockMovement', async () => {
      const response = await request(app)
        .put(`/api/inventory/items/${existingItem._id}`)
        .send({ 
          name: 'Updated Name', 
          category: 'New Cat',
          sku: 'NEW-SKU-1' // Controller will uppercase this
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Name');
      expect(response.body.sku).toBe('NEW-SKU-1');

      // Check the diff logging
      const movement = await StockMovement.findOne({ itemId: existingItem._id, type: 'UPDATED' });
      expect(movement.diff.before.name).toBe('Original Name');
      expect(movement.diff.after.name).toBe('Updated Name');
      expect(movement.diff.after.sku).toBe('NEW-SKU-1');
    });

    it('should fail if the user attempts to change to an existing SKU', async () => {
      await Item.create({ name: 'Other', sku: 'TAKEN-SKU', category: 'IT', organizationId: testOrgId });

      const response = await request(app)
        .put(`/api/inventory/items/${existingItem._id}`)
        .send({ sku: 'taken-sku' }); // Should be case-insensitive check in controller

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('SKU_ALREADY_EXISTS');
    });

    it('should NOT create a movement log if no data actually changed', async () => {
      await request(app)
        .put(`/api/inventory/items/${existingItem._id}`)
        .send({ name: 'Original Name' }); // Sending the same name

      const movement = await StockMovement.findOne({ type: 'UPDATED' });
      expect(movement).toBeNull();
    });
  });
});