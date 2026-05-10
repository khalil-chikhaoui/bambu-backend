/**
 * @fileoverview Organization Controller
 * Manages the lifecycle of Organization entities, including team management,
 * branding, membership limits, roles, and audit history.
 */

import asyncHandler from "express-async-handler";
import Organization from "../models/Organization.js";
import User from "../models/User.js";
import Invitation from "../models/Invitation.js"; 
import crypto from "crypto";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getTransporter } from "../config/mail.js";
import AuditLog from "../models/AuditLog.js"; // Needed for fetching history
import { logAudit } from "../middlewares/audit.service.js"; // New polymorphic service

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VALID_ROLES = ["admin", "employee"];

// ==========================================
// --- Organization Profile & CRUD ---
// ==========================================

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

  const {
    name, legalName, description, email, phoneNumber, address,
    socialLinks, website, registrationNumber, taxId, timezone, maxMembers
  } = req.body;

  if (maxMembers && maxMembers !== organization.maxMembers) {
    const currentMemberCount = await User.countDocuments({
      "memberships.organizationId": organization._id,
    });

    if (maxMembers < currentMemberCount) {
      res.status(400);
      throw new Error(`ORG_LIMIT_CONFLICT: Currently have ${currentMemberCount} active members.`);
    }
    organization.maxMembers = maxMembers;
  }

  let isAddressUpdated = !!address;
  let isProfileUpdated = !!(name || legalName || description || email || website || registrationNumber || taxId || timezone || phoneNumber || socialLinks || maxMembers);

  if (name !== undefined) organization.name = name;
  if (legalName !== undefined) organization.legalName = legalName;
  if (description !== undefined) organization.description = description;
  if (email !== undefined) organization.email = email;
  if (website !== undefined) organization.website = website;
  if (registrationNumber !== undefined) organization.registrationNumber = registrationNumber;
  if (taxId !== undefined) organization.taxId = taxId;
  if (timezone !== undefined) organization.timezone = timezone;
  
  if (phoneNumber) organization.phoneNumber = { ...organization.phoneNumber, ...phoneNumber };
  if (address) organization.address = { ...organization.address, ...address };
  if (socialLinks) organization.socialLinks = { ...organization.socialLinks, ...socialLinks };

  const updatedOrganization = await organization.save();

  // --- POLYMORPHIC AUDIT LOG ---
  if (isAddressUpdated) {
    logAudit({
      organizationId: organization._id,
      actor: req.user._id,
      module: "SETTINGS",
      action: "ORG_ADDRESS_UPDATED",
      targetModel: "Organization",
      targetId: organization._id,
    });
  }

  if (isProfileUpdated && Object.keys(req.body).some(key => key !== 'address')) {
    logAudit({
      organizationId: organization._id,
      actor: req.user._id,
      module: "SETTINGS",
      action: "ORG_UPDATED",
      targetModel: "Organization",
      targetId: organization._id,
    });
  }
  
  res.json({
    organization: updatedOrganization,
    message: "ORG_UPDATED" 
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

export const uploadOrganizationLogo = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("UPLOAD_NO_FILE");
  }

  const organization = await Organization.findById(req.params.id);

  if (!organization) {
    if (req.file.path) fs.unlinkSync(req.file.path);
    res.status(404);
    throw new Error("ORG_NOT_FOUND");
  }

  if (organization.logo && organization.logo.includes("/api/images/")) {
    try {
      const oldFileName = organization.logo.split("/").pop();
      const storagePath = process.env.UPLOAD_PATH || path.join(__dirname, "../../images");
      const oldPath = path.join(storagePath, "organizations", oldFileName);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    } catch (err) {
      console.error("Failed to delete old organization logo:", err.message);
    }
  }

  organization.logo = `${process.env.BACKEND_URL}/api/images/organizations/${req.file.filename}`;
  await organization.save();

  logAudit({
    organizationId: organization._id,
    actor: req.user._id,
    module: "SETTINGS",
    action: "ORG_LOGO_UPLOADED",
    targetModel: "Organization",
    targetId: organization._id,
  });

  res.status(200).json({
    message: "LOGO_UPLOADED",
    logo: organization.logo,
  });
});

export const deleteOrganizationLogo = asyncHandler(async (req, res) => {
  const organization = await Organization.findById(req.params.id);

  if (!organization) {
    res.status(404);
    throw new Error("ORG_NOT_FOUND");
  }

  if (organization.logo && organization.logo.includes("/api/images/")) {
    try {
      const fileName = organization.logo.split("/").pop();
      const storagePath = process.env.UPLOAD_PATH || path.join(__dirname, "../../images");
      const filePath = path.join(storagePath, "organizations", fileName);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (error) {
      console.error("Persistent Organization Logo Delete Error:", error.message);
    }
  }

  organization.logo = "";
  await organization.save();

  logAudit({
    organizationId: organization._id,
    actor: req.user._id,
    module: "SETTINGS",
    action: "ORG_LOGO_DELETED",
    targetModel: "Organization",
    targetId: organization._id,
  });

  res.json({ message: "LOGO_REMOVED", logo: "" });
});

// ==========================================
// --- Member & Invitation Management ---
// ==========================================

export const inviteMember = asyncHandler(async (req, res) => {
  const { email, name, role, title } = req.body;
  const organizationId = req.params.id;

  const organization = await Organization.findById(organizationId);
  if (!organization) {
    res.status(404);
    throw new Error("ORG_NOT_FOUND");
  }

  const activeMembers = await User.countDocuments({ "memberships.organizationId": organizationId });
  const pendingInvites = await Invitation.countDocuments({ organizationId, status: "Pending" });
  
  if ((activeMembers + pendingInvites) >= organization.maxMembers) {
    res.status(403);
    throw new Error("ORG_MAX_MEMBERS_EXCEEDED");
  }

  const assignedRole = VALID_ROLES.includes(role) ? role : "employee";

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    const isAlreadyMember = existingUser.memberships.some(
      (m) => m.organizationId.toString() === organizationId,
    );
    if (isAlreadyMember) {
      res.status(400);
      throw new Error("MEMBER_ALREADY_EXISTS");
    }
  }

  const token = crypto.randomBytes(32).toString("hex");
  const inviteUrl = `${process.env.FRONTEND_URL}/accept-invitation/${token}`;

  const newInvitation = await Invitation.create({
    name,
    email,
    organizationId,
    role: assignedRole,
    title: title || "Staff",
    token,
    invitedBy: req.user._id,
    status: "Pending",
  });

  logAudit({
    organizationId,
    actor: req.user._id,
    module: "TEAM",
    action: "INVITE_SENT",
    targetModel: "Invitation",
    targetId: newInvitation._id,
    metadata: { targetEmail: email, role: assignedRole, targetName: name },
  });
  
  try {
    const transporter = getTransporter();

    await transporter.sendMail({
      from: `"Bambu ERP" <${process.env.SMTP_EMAIL}>`,
      to: email,
      subject: `Invitation à rejoindre ${organization.name}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 12px;">
          <h2 style="color: #184c16;">Bonjour ${name || ""}!</h2>
          <p>Vous avez été invité(e) à rejoindre <strong>${organization.name}</strong>.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" style="background: #184c16; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Accepter l'invitation</a>
          </div>
          <p style="font-size: 12px; color: #999;">Envoyé par ${req.user.name}.</p>
        </div>
      `,
    });

    res.status(200).json({ message: "INVITATION_SENT" });
  } catch (err) {
    console.error("Email Error:", err);
    if (newInvitation) await Invitation.findByIdAndDelete(newInvitation._id);
    res.status(500);
    throw new Error("INVITATION_FAILED");
  }
});

export const getOrganizationMembers = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const organizationId = req.params.id;
  const oId = new mongoose.Types.ObjectId(organizationId);

  let userQuery = { "memberships.organizationId": oId };
  let inviteQuery = { organizationId: oId, status: "Pending" };

  if (search) {
    const searchRegex = { $regex: search, $options: "i" };
    userQuery.$or = [{ name: searchRegex }, { email: searchRegex }];
    inviteQuery.$or = [{ email: searchRegex }];
  }

  const [users, invitations] = await Promise.all([
    User.find(userQuery).select("name email profileImage memberships"),
    Invitation.find(inviteQuery),
  ]);

  const activeMembers = users.map((user) => {
    const membership = user.memberships.find(
      (m) => m.organizationId.toString() === organizationId,
    );
    return {
      id: user._id,
      name: user.name,
      email: user.email,
      profileImage: user.profileImage,
      role: membership.role,
      title: membership.title,
      invitationStatus: "Accepted",
    };
  });

  const pendingInvites = invitations.map((invite) => ({
    id: invite._id,
    name: invite.name || invite.email.split("@")[0],
    email: invite.email,
    profileImage: "",
    role: invite.role,
    title: invite.title,
    invitationStatus: "Pending",
    createdAt: invite.createdAt,
  }));

  res.json([...activeMembers, ...pendingInvites]);
});

export const updateMemberRole = asyncHandler(async (req, res) => {
  const { id: organizationId, memberId } = req.params;
  const { role } = req.body;

  if (!VALID_ROLES.includes(role)) {
    res.status(400);
    throw new Error("INVALID_ROLE");
  }

  const member = await User.findById(memberId);
  if (!member) {
    res.status(404);
    throw new Error("MEMBER_NOT_FOUND");
  }

  const membershipIndex = member.memberships.findIndex(
    (m) => m.organizationId.toString() === organizationId,
  );

  if (membershipIndex === -1) {
    res.status(404);
    throw new Error("MEMBER_NOT_IN_ORG");
  }

  const oldRole = member.memberships[membershipIndex].role;
  member.memberships[membershipIndex].role = role;
  await member.save();

  logAudit({
    organizationId,
    actor: req.user._id,
    module: "TEAM",
    action: "ROLE_UPDATED",
    targetModel: "User",
    targetId: memberId,
    metadata: { role: role, oldRole: oldRole, targetEmail: member.email, targetName: member.name },
  });

  res.status(200).json({ message: "ROLE_UPDATED", role });
});

export const removeMember = asyncHandler(async (req, res) => {
  const { id: organizationId, memberId } = req.params;

  const invitation = await Invitation.findById(memberId);
  if (invitation) {
    await Invitation.findByIdAndDelete(memberId);

    logAudit({
      organizationId,
      actor: req.user._id,
      module: "TEAM",
      action: "INVITE_CANCELLED",
      targetModel: "Invitation",
      targetId: memberId,
      metadata: { targetEmail: invitation.email, targetName: invitation.name },
    });

    return res.status(200).json({ message: "INVITATION_CANCELLED" });
  }

  const user = await User.findById(memberId);
  if (user) {
    user.memberships = user.memberships.filter(
      (m) => m.organizationId.toString() !== organizationId,
    );
    await user.save();

    logAudit({
      organizationId,
      actor: req.user._id,
      module: "TEAM",
      action: "MEMBER_REMOVED",
      targetModel: "User",
      targetId: memberId,
      metadata: { targetEmail: user.email, targetName: user.name },
    });

    return res.status(200).json({ message: "MEMBER_REMOVED" });
  }

  res.status(404);
  throw new Error("MEMBER_NOT_FOUND");
});

export const leaveOrganization = asyncHandler(async (req, res) => {
  const organizationId = req.params.id;
  const user = await User.findById(req.user._id);

  const membershipIndex = user.memberships.findIndex(
    (m) => m.organizationId.toString() === organizationId,
  );

  if (membershipIndex === -1) {
    res.status(400);
    throw new Error("MEMBER_NOT_IN_ORG");
  }

  if (user.memberships[membershipIndex].role === "admin") {
    const otherAdmins = await User.countDocuments({
      memberships: {
        $elemMatch: {
          organizationId: organizationId,
          role: "admin",
          _id: { $ne: user._id },
        },
      },
    });

    if (otherAdmins === 0) {
      res.status(400);
      throw new Error("CANNOT_LEAVE_AS_LAST_ADMIN");
    }
  }

  user.memberships.splice(membershipIndex, 1);
  await user.save();

  logAudit({
    organizationId,
    actor: req.user._id,
    module: "TEAM",
    action: "MEMBER_LEFT",
    targetModel: "User",
    targetId: req.user._id,
    metadata: { targetEmail: user.email, targetName: user.name },
  });

  res.status(200).json({ message: "LEFT_ORG", user });
});

/**
 * @desc    Get organization history (audit logs) with pagination and module/target filtering
 * @route   GET /api/organizations/:id/history?module=TEAM&page=1&targetId=123
 * @access  Private
 */
export const getOrganizationHistory = asyncHandler(async (req, res) => {
  const organizationId = req.params.id;
  const { page = 1, limit = 10, module, targetId } = req.query;
  const skip = (page - 1) * limit;

  const organization = await Organization.findById(organizationId);
  if (!organization) {
    res.status(404);
    throw new Error("ORG_NOT_FOUND");
  }

  // Support module filtering
  const query = { organizationId };
  if (module) query.module = module;
  // FILTER BY SPECIFIC ITEM/USER
  if (targetId) query.targetId = targetId;

  const totalItems = await AuditLog.countDocuments(query);

  const history = await AuditLog.find(query)
    .populate("actor", "name email profileImage") 
    .populate("targetId", "name email profileImage") // Optional: depending on your frontend needs
    .sort({ createdAt: -1 }) 
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    data: history,
    pagination: {
      currentPage: Number(page),
      totalPages: Math.ceil(totalItems / limit),
      totalItems,
      limit: Number(limit),
      hasNextPage: page * limit < totalItems,
      hasPrevPage: page > 1,
    },
  });
});