// src/controllers/organizations/organization.controller.js
import asyncHandler from "express-async-handler";
import Organization from "../../models/Organization.js";
import User from "../../models/User.js";
import Invitation from "../../models/Invitation.js";
import mongoose from "mongoose";
import { logAudit } from "../../middlewares/audit.service.js";

export const getOrganizationById = asyncHandler(async (req, res) => {
  const organization = await Organization.findById(req.params.id);
  if (!organization) {
    res.status(404);
    throw new Error("ORG_NOT_FOUND");
  }
  res.json(organization);
});

export const updateOrganization = asyncHandler(async (req, res) => {
  const organization = await Organization.findById(req.params.id);

  if (!organization) {
    res.status(404);
    throw new Error("ORG_NOT_FOUND");
  }

  const diffProfile = { before: {}, after: {} };
  const diffAddress = { before: {}, after: {} };
  let profileChanged = false;
  let addressChanged = false;

  // Check Max Members Conflict
  if (req.body.maxMembers && req.body.maxMembers !== organization.maxMembers) {
    const currentMemberCount = await User.countDocuments({
      "memberships.organizationId": organization._id,
    });
    if (req.body.maxMembers < currentMemberCount) {
      res.status(400);
      throw new Error(
        `ORG_LIMIT_CONFLICT: Currently have ${currentMemberCount} active members.`,
      );
    }
  }

  // Diff Standard Profile Fields
  const standardFields = [
    "name",
    "legalName",
    "description",
    "email",
    "website",
    "registrationNumber",
    "taxId",
    "timezone",
    "maxMembers",
  ];

  standardFields.forEach((key) => {
    if (req.body[key] !== undefined && req.body[key] !== organization[key]) {
      diffProfile.before[key] = organization[key] || "";
      diffProfile.after[key] = req.body[key];
      organization[key] = req.body[key];
      profileChanged = true;
    }
  });

  // Diff Phone Number
  if (req.body.phoneNumber) {
    const oldPhone = organization.phoneNumber?.number || "";
    const newPhone = req.body.phoneNumber.number || "";
    if (oldPhone !== newPhone) {
      diffProfile.before.phoneNumber = oldPhone;
      diffProfile.after.phoneNumber = newPhone;
      organization.phoneNumber = {
        ...organization.phoneNumber,
        ...req.body.phoneNumber,
      };
      profileChanged = true;
    }
  }

  // Diff Address
  if (req.body.address) {
    const addrKeys = ["street", "city", "state", "zipCode", "country"];
    addrKeys.forEach((key) => {
      const oldVal = organization.address?.[key] || "";
      const newVal = req.body.address[key] || "";

      if (req.body.address[key] !== undefined && oldVal !== newVal) {
        diffAddress.before[key] = oldVal;
        diffAddress.after[key] = newVal;
        addressChanged = true;
      }
    });
    if (addressChanged) {
      organization.address = { ...organization.address, ...req.body.address };
    }
  }

  // Diff Social Links (Optional, if you want to track them precisely)
  if (req.body.socialLinks) {
    organization.socialLinks = {
      ...organization.socialLinks,
      ...req.body.socialLinks,
    };
    // You can add diff logic here similarly if needed
  }

  const updatedOrganization = await organization.save();

  // Log the precise Address changes
  if (addressChanged) {
    logAudit({
      organizationId: organization._id,
      actor: req.user._id,
      module: "SETTINGS",
      action: "ORG_ADDRESS_UPDATED",
      targetModel: "Organization",
      targetId: organization._id,
      diff: diffAddress,
    });
  }

  // Log the precise Profile changes
  if (profileChanged) {
    logAudit({
      organizationId: organization._id,
      actor: req.user._id,
      module: "SETTINGS",
      action: "ORG_UPDATED",
      targetModel: "Organization",
      targetId: organization._id,
      diff: diffProfile,
    });
  }

  res.json({
    organization: updatedOrganization,
    message: "ORG_UPDATED",
  });
});

export const deleteOrganization = asyncHandler(async (req, res) => {
  const organizationId = req.params.id;
  const organization = await Organization.findById(organizationId);

  if (!organization) {
    res.status(404);
    throw new Error("ORG_NOT_FOUND");
  }

  await organization.deleteOne();

  await User.updateMany(
    { "memberships.organizationId": organizationId },
    { $pull: { memberships: { organizationId: organizationId } } },
  );
  await Invitation.deleteMany({ organizationId });

  res.status(200).json({ message: "ORG_DELETED" });
});
