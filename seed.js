import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

// Import Models
import User from "./src/models/User.js";
import Organization from "./src/models/Organization.js";
import Invitation from "./src/models/Invitation.js";
import Item from "./src/models/Item.js";
import StockMovement from "./src/models/StockMovement.js";
import AuditLog from "./src/models/AuditLog.js";

// Load Environment Variables
const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.local";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const seedDatabase = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing in your .env file.");
    }

    // 1. Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB.");

    // 2. Wipe ALL existing data
    await Invitation.deleteMany({});
    await User.deleteMany({});
    await Item.deleteMany({});
    await StockMovement.deleteMany({});
    await AuditLog.deleteMany({});
    await Organization.deleteMany({});
    console.log("🧹 Scrubbed the database clean.");

    // ==========================================
    // 3. Create Organizations (Fictional French ONGs)
    // ==========================================

    // Org 1: Solidarité Globale (Dummy)
    const orgSolidarite = await Organization.create({
      name: "Solidarité Globale",
      legalName: "Solidarité Globale France",
      description: "Organisation non gouvernementale fictive pour l'aide humanitaire et le développement.",
      maxMembers: 100,
      email: "contact@solidarite-globale.dummy.fr",
      phoneNumber: { country: "FR", number: "+33 1 12 34 56 78" },
      website: "https://www.solidarite-globale.dummy.fr",
      address: {
        street: "12 Rue de la Paix",
        city: "Paris",
        state: "Île-de-France",
        zipCode: "75002",
        country: "France",
      },
      taxId: "FR11223344556",
      registrationNumber: "112 233 445 00067",
      timezone: "Europe/Paris",
    });

    // Org 2: Éco Espoir (Dummy)
    const orgEcoEspoir = await Organization.create({
      name: "Éco Espoir",
      legalName: "Éco Espoir Initiative",
      description: "Association fictive de protection de l'environnement et de développement durable.",
      maxMembers: 80,
      email: "hello@eco-espoir.dummy.fr",
      phoneNumber: { country: "FR", number: "+33 4 98 76 54 32" },
      website: "https://www.eco-espoir.dummy.fr",
      address: {
        street: "45 Avenue de la Liberté",
        city: "Lyon",
        state: "Auvergne-Rhône-Alpes",
        zipCode: "69003",
        country: "France",
      },
      taxId: "FR99887766554",
      registrationNumber: "998 877 665 00043",
      timezone: "Europe/Paris",
    });

    // Org 3: Éducation Pour Tous (Dummy)
    const orgEducation = await Organization.create({
      name: "Éducation Pour Tous",
      legalName: "Éducation Pour Tous ONG",
      description: "Association fictive œuvrant pour l'accès à l'éducation dans les zones rurales.",
      maxMembers: 150,
      email: "contact@education-pourtous.dummy.fr",
      phoneNumber: { country: "FR", number: "+33 4 11 22 33 44" },
      website: "https://www.education-pourtous.dummy.fr",
      address: {
        street: "8 Boulevard des Écoles",
        city: "Marseille",
        state: "Provence-Alpes-Côte d'Azur",
        zipCode: "13001",
        country: "France",
      },
      taxId: "FR55443322110",
      registrationNumber: "554 433 221 00019",
      timezone: "Europe/Paris",
    });

    console.log("🏢 Created 3 dummy NGO organizations.");

    // ==========================================
    // 4. Create Users 
    // ==========================================

    // User 1: Khalil Chikhaoui (Access to 3 Orgs)
    const khalilUser = await User.create({
      firstName: "Khalil",
      lastName: "Chikhaoui",
      email: "chikhaouikhl@gmail.com",
      password: "21459708Az*",
      memberships: [
        {
          organizationId: orgSolidarite._id,
          role: "admin",
          title: "Lead Developer",
        },
        {
          organizationId: orgEcoEspoir._id,
          role: "admin",
          title: "Consultant IT",
        },
        {
          organizationId: orgEducation._id,
          role: "admin",
          title: "Bénévole Technique",
        }
      ],
    });
    console.log(`👨‍💻 User created with 3 orgs: ${khalilUser.email}`);

    // User 2: Admin System (Access to 2 Orgs)
    const adminUser = await User.create({
      firstName: "Admin",
      lastName: "System",
      email: "admin@bambu-services.com",
      password: "21459708Az*",
      memberships: [
        {
          organizationId: orgSolidarite._id,
          role: "admin",
          title: "Superviseur",
        },
        {
          organizationId: orgEcoEspoir._id,
          role: "admin",
          title: "Administrateur Réseau",
        }
      ],
    });
    console.log(`👨‍💻 User created with 2 orgs: ${adminUser.email}`);

    // User 3: The "Other" / Contact (Access to 1 Org)
    const contactUser = await User.create({
      firstName: "Khaoula",
      lastName: "Chikhaoui",
      email: "contact@bambu-services.com",
      password: "21459708Az*",
      memberships: [
        {
          organizationId: orgSolidarite._id,
          role: "admin",
          title: "Fondatrice",
        }
      ],
    });
    console.log(`👨‍💻 User created with 1 org: ${contactUser.email}`);

    console.log("🌱 Database seeded successfully!");
    await mongoose.disconnect(); 
    process.exit(0); 
  } catch (error) {
    console.log("❌ Error seeding database:", error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedDatabase();