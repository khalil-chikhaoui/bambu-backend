import asyncHandler from "express-async-handler";
import User from "../../models/User.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error("AUTH_USER_NOT_FOUND");
  }

  // Basic Info
  if (req.body.firstName) user.firstName = req.body.firstName;
  if (req.body.lastName) user.lastName = req.body.lastName;

  // Update Title in Membership
  if (req.body.title && req.body.organizationId) {
    const membership = user.memberships.find(
      (m) => m.organizationId.toString() === req.body.organizationId,
    );
    if (membership) {
      membership.title = req.body.title;
    }
  }

  if (req.body.phoneNumber) {
    user.phoneNumber = { ...user.phoneNumber, ...req.body.phoneNumber };
  }

  if (req.body.address) {
    user.address = { ...user.address, ...req.body.address };
  }

  const updatedUser = await user.save();
  await updatedUser.populate("memberships.organizationId");

  const userResponse = updatedUser.toObject();
  delete userResponse.password;

  res.json({
    user: userResponse,
    message: "PROFILE_UPDATED",
  });
});

export const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate(
    "memberships.organizationId",
  );

  if (user) {
    const userResponse = user.toObject();
    delete userResponse.password;
    res.json(userResponse);
  } else {
    res.status(404);
    throw new Error("AUTH_USER_NOT_FOUND");
  }
});

export const uploadUserAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("UPLOAD_NO_FILE");
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    if (req.file.path) fs.unlinkSync(req.file.path);
    res.status(404);
    throw new Error("AUTH_USER_NOT_FOUND");
  }

  if (user.profileImage && user.profileImage.includes("/api/images/")) {
    try {
      const oldFileName = user.profileImage.split("/").pop();
      const storagePath =
        process.env.UPLOAD_PATH || path.join(__dirname, "../../../images");
      const oldPath = path.join(storagePath, "users", oldFileName);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    } catch (err) {
      console.log("Failed to delete old user avatar:", err.message);
    }
  }

  user.profileImage = `${process.env.BACKEND_URL}/api/images/users/${req.file.filename}`;
  await user.save();
  await user.populate("memberships.organizationId");

  const userResponse = user.toObject();
  delete userResponse.password;

  res.status(200).json({
    message: "AVATAR_UPLOADED",
    user: userResponse,
  });
});

export const deleteUserAvatar = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error("AUTH_USER_NOT_FOUND");
  }

  if (user.profileImage && user.profileImage.includes("/api/images/")) {
    try {
      const filename = user.profileImage.split("/").pop();
      const storagePath =
        process.env.UPLOAD_PATH || path.join(__dirname, "../../../images");
      const filePath = path.join(storagePath, "users", filename);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.log("Persistent File Delete Error:", error.message);
    }
  }

  user.profileImage = "";
  await user.save();
  await user.populate("memberships.organizationId");

  const userResponse = user.toObject();
  delete userResponse.password;

  res.json({
    message: "AVATAR_DELETED",
    user: userResponse,
  });
});
