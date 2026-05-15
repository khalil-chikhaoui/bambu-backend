import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Import your code
import { recordStockMovement, getInventoryLedger } from '../../../src/controllers/inventory/stock.controller.js';
import Item from '../../../src/models/Item.js';
import StockMovement from '../../../src/models/StockMovement.js';
import User from '../../../src/models/User.js';

// Setup Fake App & Middleware
const app = express();
app.use(express.json());

const testUserId = new mongoose.Types.ObjectId();
const fakeAuth = (req, res, next) => {
  req.user = { _id: testUserId };
  next();
};

app.post('/api/inventory/movement', fakeAuth, recordStockMovement);
app.get('/api/inventory/history', getInventoryLedger);

app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({ message: err.message });
});

describe('Stock Controller (Inventory Ledger) Tests', () => {
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
    await User.deleteMany({});
  });

  // ---------------------------------------------------------
  // RECORD STOCK MOVEMENT (IN / OUT)
  // ---------------------------------------------------------
  describe('POST /api/inventory/movement', () => {
    let testItem;

    beforeEach(async () => {
      testItem = await Item.create({
        organizationId: testOrgId,
        name: 'Hammer',
        sku: 'HAM-01',
        category: 'Tools',
        currentQuantity: 10,
        minThreshold: 5
      });
    });

    it('should successfully record a stock IN and increase quantity', async () => {
      const response = await request(app)
        .post('/api/inventory/movement')
        .send({
          organizationId: testOrgId,
          itemId: testItem._id,
          type: 'IN',
          quantity: 5,
          notes: 'Adding new stock'
        });

      expect(response.status).toBe(200);
      expect(response.body.currentQuantity).toBe(15);

      // Verify StockMovement entry
      const movement = await StockMovement.findOne({ itemId: testItem._id, type: 'IN' });
      expect(movement.quantity).toBe(5);
    });

    it('should successfully record a stock OUT and decrease quantity', async () => {
      const response = await request(app)
        .post('/api/inventory/movement')
        .send({
          organizationId: testOrgId,
          itemId: testItem._id,
          type: 'OUT',
          quantity: 3
        });

      expect(response.status).toBe(200);
      expect(response.body.currentQuantity).toBe(7);
    });

    it('should fail (400) if quantity OUT exceeds current quantity', async () => {
      const response = await request(app)
        .post('/api/inventory/movement')
        .send({
          organizationId: testOrgId,
          itemId: testItem._id,
          type: 'OUT',
          quantity: 50 // More than 10
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('INSUFFICIENT_STOCK');
    });

    it('should handle negative numbers by taking the absolute value', async () => {
      const response = await request(app)
        .post('/api/inventory/movement')
        .send({
          organizationId: testOrgId,
          itemId: testItem._id,
          type: 'IN',
          quantity: -10 
        });

      expect(response.status).toBe(200);
      expect(response.body.currentQuantity).toBe(20); // 10 + Math.abs(-10)
    });
  });

  // ---------------------------------------------------------
  // GET INVENTORY LEDGER / HISTORY
  // ---------------------------------------------------------
  describe('GET /api/inventory/history', () => {
    it('should return paginated stock history with populated data', async () => {
      const item = await Item.create({ name: 'Cable', sku: 'CAB-1', category: 'IT', organizationId: testOrgId });
      const actor = await User.create({ _id: testUserId, firstName: 'Khalil', lastName: 'C', email: 'k@b.com', password: 'p' });

      await StockMovement.create({
        organizationId: testOrgId,
        itemId: item._id,
        actor: actor._id,
        type: 'IN',
        quantity: 100,
        notes: 'Initial Bulk'
      });

      const response = await request(app)
        .get('/api/inventory/history')
        .query({ organizationId: testOrgId.toString() });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].itemId.name).toBe('Cable'); // Testing Population
      expect(response.body.pagination.totalItems).toBe(1);
    });

    it('should search history by item name via the search query', async () => {
      const item1 = await Item.create({ name: 'Apple', sku: 'A1', category: 'Food', organizationId: testOrgId });
      const item2 = await Item.create({ name: 'Banana', sku: 'B1', category: 'Food', organizationId: testOrgId });

      await StockMovement.create([
        { organizationId: testOrgId, itemId: item1._id, actor: testUserId, type: 'IN', quantity: 5 },
        { organizationId: testOrgId, itemId: item2._id, actor: testUserId, type: 'IN', quantity: 5 }
      ]);

      const response = await request(app)
        .get('/api/inventory/history')
        .query({ organizationId: testOrgId.toString(), search: 'apple' });

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].itemId.sku).toBe('A1');
    });
  });
});