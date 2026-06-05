// src/controllers/users/profile.controller.js
import asyncHandler from "express-async-handler";
import User from "../../models/User.js";
import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

export const confirmUserAvatar = asyncHandler(async (req, res) => {
  const { secureUrl, publicId } = req.body;

  if (!secureUrl || !publicId) {
    res.status(400);
    throw new Error("UPLOAD_MISSING_DATA");
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error("AUTH_USER_NOT_FOUND");
  }

  // Delete previous Cloudinary image if it exists and is different
  if (user.profileImagePublicId && user.profileImagePublicId !== publicId) {
    try {
      await cloudinary.uploader.destroy(user.profileImagePublicId);
    } catch (err) {
      console.log("Failed to delete old Cloudinary avatar:", err.message);
    }
  }

  user.profileImage = secureUrl;
  user.profileImagePublicId = publicId;
  await user.save();
  await user.populate("memberships.organizationId");

  const userResponse = user.toObject();
  delete userResponse.password;

  res.status(200).json({
    message: "AVATAR_CONFIRMED",
    user: userResponse,
  });
});

export const deleteUserAvatar = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error("AUTH_USER_NOT_FOUND");
  }

  if (user.profileImagePublicId) {
    try {
      await cloudinary.uploader.destroy(user.profileImagePublicId);
    } catch (error) {
      console.log("Cloudinary File Delete Error:", error.message);
    }
  }

  user.profileImage = "";
  user.profileImagePublicId = "";
  await user.save();
  await user.populate("memberships.organizationId");

  const userResponse = user.toObject();
  delete userResponse.password;

  res.json({
    message: "AVATAR_DELETED",
    user: userResponse,
  });
});