// src/controllers/invitations/acceptance.controller.js
import asyncHandler from "express-async-handler";
import Invitation from "../../models/Invitation.js";
import User from "../../models/User.js";
import Organization from "../../models/Organization.js";
import { generateToken } from "../../middlewares/auth.js";
import { logAudit } from "../../middlewares/audit.service.js";

export const acceptInviteLogin = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

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

  if (!(await user.matchPassword(password))) {
    res.status(400);
    throw new Error("AUTH_INVALID_CREDENTIALS");
  }

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

  const alreadyMember = user.memberships.some(
    (m) => m.organizationId.toString() === invitation.organizationId.toString(),
  );

  if (!alreadyMember) {
    user.memberships.push({
      organizationId: invitation.organizationId,
      role: invitation.role,
      title: invitation.title || "Staff",
    });
    await user.save();
  }

  await Invitation.findByIdAndDelete(invitation._id);

  logAudit({
    organizationId: invitation.organizationId,
    actor: user._id,
    module: "TEAM",
    action: "INVITE_ACCEPTED",
    targetModel: "User",
    targetId: user._id,
    metadata: {
      role: invitation.role,
      targetEmail: user.email,
      targetName: `${user.firstName} ${user.lastName}`,
    },
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

export const acceptInviteRegister = asyncHandler(async (req, res) => {
  const { token, password, firstName, lastName } = req.body;

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

  const newUser = await User.create({
    firstName,
    lastName,
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

  await Invitation.findByIdAndDelete(invitation._id);

  logAudit({
    organizationId: invitation.organizationId,
    actor: newUser._id,
    module: "TEAM",
    action: "INVITE_ACCEPTED",
    targetModel: "User",
    targetId: newUser._id,
    metadata: {
      role: invitation.role,
      targetEmail: newUser.email,
      targetName: `${newUser.firstName} ${newUser.lastName}`,
    },
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
