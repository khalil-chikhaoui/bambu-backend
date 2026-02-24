import express from "express";
import { createContactMessage } from "../controllers/general.controller.js";

const router = express.Router();

router.post("/contact", createContactMessage);

export default router;