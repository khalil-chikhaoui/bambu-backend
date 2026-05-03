/**
 * @fileoverview Invitation Controller
 * Manages the multi-step invitation acceptance process for Organizations.
 */

import asyncHandler from "express-async-handler";
import Invitation from "../models/Invitation.js";
import User from "../models/User.js";
import Organization from "../models/Organization.js";
import { generateToken } from "../middlewares/auth.js";
import MemberHistory from "../models/MemberHistory.js";

/**
 * @desc    Validate invitation token & check user existence
 * @route   GET /api/invitations/:token
 * @access  Public
 */
export const validateInvitation = asyncHandler(async (req, res) => {
  const { token } = req.params;

  // Use organizationId as defined in your new Invitation model
  const invitation = await Invitation.findOne({ token }).populate(
    "organizationId",
    "name logo"
  );

  if (!invitation) {
    res.status(404);
    throw new Error("INVITATION_INVALID");
  }

  const userExists = await User.findOne({ email: invitation.email });

  res.status(200).json({
    isValid: true,
    email: invitation.email,
    name: invitation.name,
    role: invitation.role,
    organization: invitation.organizationId,
    userExists: !!userExists,
  });
});

/**
 * @desc    Accept invitation & Login for EXISTING users
 * @route   POST /api/invitations/accept-login
 * @access  Public
 */
export const acceptInviteLogin = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  // 1. Verification
  const invitation = await Invitation.findOne({ token });
  if (!invitation) {
    res.status(404);
    throw new Error("INVITATION_INVALID");
  }

  const user = await User.findOne({ email: invitation.email });
  if (!user) {
    res.status(404);
    throw new Error("AUTH_USER_NOT_FOUND");
  }

  // 2. Authenticate user
  if (!(await user.matchPassword(password))) {
    res.status(401);
    throw new Error("AUTH_INVALID_CREDENTIALS");
  }

  // 3. Enforce Max Members Limit (in case the org filled up while the invite was pending)
  const organization = await Organization.findById(invitation.organizationId);
  if (!organization) {
    res.status(404);
    throw new Error("ORG_NOT_FOUND");
  }

  const currentMembers = await User.countDocuments({
    "memberships.organizationId": organization._id,
  });

  if (currentMembers >= organization.maxMembers) {
    res.status(403);
    throw new Error("ORG_MAX_MEMBERS_EXCEEDED");
  }

  // 4. Add organization to memberships if not already present
  const alreadyMember = user.memberships.some(
    (m) => m.organizationId.toString() === invitation.organizationId.toString()
  );

  if (!alreadyMember) {
    user.memberships.push({
      organizationId: invitation.organizationId,
      role: invitation.role,
      title: invitation.title || "Staff",
    });
    await user.save();
  }

  // 5. Cleanup and Response
  await Invitation.findByIdAndDelete(invitation._id);

  await MemberHistory.create({
    organizationId: invitation.organizationId,
    action: "INVITE_ACCEPTED",
    actor: user._id,
    targetUser: user._id,
    targetEmail: user.email,
    details: { role: invitation.role },
  });

  await user.populate("memberships.organizationId");

  const userResponse = user.toObject();
  delete userResponse.password;

  res.status(200).json({
    user: userResponse,
    token: generateToken(user._id),
    message: "INVITATION_ACCEPTED",
  });
});

/**
 * @desc    Accept invitation & Register for NEW users
 * @route   POST /api/invitations/accept-register
 * @access  Public
 */
export const acceptInviteRegister = asyncHandler(async (req, res) => {
  const { token, password, name } = req.body; // Removed language

  // 1. Verification
  const invitation = await Invitation.findOne({ token });
  if (!invitation) {
    res.status(404);
    throw new Error("INVITATION_INVALID");
  }

  const userExists = await User.findOne({ email: invitation.email });
  if (userExists) {
    res.status(400);
    throw new Error("AUTH_USER_EXISTS");
  }

  // 2. Enforce Max Members Limit
  const organization = await Organization.findById(invitation.organizationId);
  if (!organization) {
    res.status(404);
    throw new Error("ORG_NOT_FOUND");
  }

  const currentMembers = await User.countDocuments({
    "memberships.organizationId": organization._id,
  });

  if (currentMembers >= organization.maxMembers) {
    res.status(403);
    throw new Error("ORG_MAX_MEMBERS_EXCEEDED");
  }

  // 3. Create the new user (Cleaned up: no language or verification fields)
  const newUser = await User.create({
    name: name || invitation.name,
    email: invitation.email,
    password: password,
    memberships: [
      {
        organizationId: invitation.organizationId,
        role: invitation.role,
        title: invitation.title || "Staff",
      },
    ],
  });

  // 4. Delete invitation
  await Invitation.findByIdAndDelete(invitation._id);

  await MemberHistory.create({
    organizationId: invitation.organizationId,
    action: "INVITE_ACCEPTED",
    actor: newUser._id,
    targetUser: newUser._id,
    targetEmail: newUser.email,
    details: { role: invitation.role },
  });

  if (newUser) {
    await newUser.populate("memberships.organizationId");

    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json({
      user: userResponse,
      token: generateToken(newUser._id),
      message: "INVITATION_ACCEPTED",
    });
  } else {
    res.status(400);
    throw new Error("AUTH_INVALID_DATA");
  }
});