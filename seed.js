import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

// Import Models
import User from "./src/models/User.js";
import Organization from "./src/models/Organization.js";
import Invitation from "./src/models/Invitation.js";
import Item from "./src/models/Item.js";
import StockMovement from "./src/models/StockMovement.js";
import Resource from "./src/models/Resource.js";
import Booking from "./src/models/Booking.js";
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
    await Resource.deleteMany({});
    await Booking.deleteMany({});
    await Organization.deleteMany({});
    console.log("🧹 Scrubbed the database clean.");

    // ==========================================
    // 3A. Create Organization 1 (Bambu HQ)
    // ==========================================
    const organization1 = await Organization.create({
      name: "Bambu HQ",
      legalName: "Bambu Services SAS",
      description: "Système ERP Principal pour la gestion des services Bambu.",
      logo: "https://res.cloudinary.com/dkh0hsbjg/image/upload/v1773570075/logo-beige_taidas.png", 
      maxMembers: 20, 
      email: "contact@bambu-services.com",
      phoneNumber: { country: "FR", number: "+33 6 41 08 90 49" },
      website: "https://bambu-services.com",
      address: {
        street: "128 Rue La Boétie", city: "Paris", state: "Île-de-France", zipCode: "75008", country: "France",
      },
      taxId: "FR12345678901",
      registrationNumber: "123 456 789 00012",
      timezone: "Europe/Paris",
    });

    // ==========================================
    // 3B. Create Organization 2 (NovaTech)
    // ==========================================
    const organization2 = await Organization.create({
      name: "NovaTech Solutions",
      legalName: "NovaTech France SAS",
      description: "Agence de développement digital et conseil IT.",
      maxMembers: 50, 
      email: "hello@novatech.fr",
      phoneNumber: { country: "FR", number: "+33 1 23 45 67 89" },
      address: {
        street: "15 Avenue des Champs-Élysées", city: "Paris", state: "Île-de-France", zipCode: "75008", country: "France",
      },
      timezone: "Europe/Paris",
    });

    // ==========================================
    // 4A. Create Genesis Admin
    // ==========================================
    const adminUser = await User.create({
      firstName: "Admin",
      lastName: "System",
      email: "admin@bambu-services.com",
      password: "password123", 
      profileImage: "https://ui-avatars.com/api/?name=Admin+System&background=184C16&color=fff",
      phoneNumber: { country: "FR", number: "+33 6 12 34 56 78" },
      address: {
        street: "10 Rue de la Paix",
        city: "Paris",
        state: "Île-de-France",
        zipCode: "75002",
        country: "France",
      },
      memberships: [
        {
          organizationId: organization1._id,
          role: "admin",
          title: "Fondateur & CEO",
        },
        {
          organizationId: organization2._id,
          role: "admin",
          title: "Superviseur Externe",
        },
      ],
    });
    console.log(`👨‍💻 Admin created: ${adminUser.email}`);

    // ==========================================
    // 4B. Create Khalil User
    // ==========================================
    const khalilUser = await User.create({
      firstName: "Khalil",
      lastName: "Chikhaoui",
      email: "chikhaouikhl@gmail.com",
      password: "21459708Az*", 
      profileImage: "https://ui-avatars.com/api/?name=Khalil+Chikhaoui&background=0ba5ec&color=fff",
      phoneNumber: { country: "TN", number: "+216 21 459 708" },
      address: {
        street: "Avenue Habib Bourguiba",
        city: "Tunis",
        state: "Tunis",
        zipCode: "1001",
        country: "Tunisie",
      },
      memberships: [
        {
          organizationId: organization2._id,
          role: "admin",
          title: "Lead Developer",
        },
      ],
    });
    console.log(`👨‍💻 User created: ${khalilUser.email}`);

   console.log("🌱 Database seeded successfully!");
    await mongoose.disconnect(); // Clean disconnection
    process.exit(0); 
  } catch (error) {
    console.error("❌ Error seeding database:", error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedDatabase();