/**
 * @fileoverview Organization Controller
 * Manages the lifecycle of Organization entities, including team management,
 * branding, membership limits, and roles.
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
import MemberHistory from "../models/MemberHistory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Valid roles for the current application scope
const VALID_ROLES = ["admin", "employee"];

// ==========================================
// --- Organization Profile & CRUD ---
// ==========================================

/**
 * @desc    Retrieve a single organization by its ID
 * @route   GET /api/organizations/:id
 * @access  Private
 */
export const getOrganizationById = asyncHandler(async (req, res) => {
  const organization = await Organization.findById(req.params.id);
  if (!organization) {
    res.status(404);
    throw new Error("ORG_NOT_FOUND");
  }
  res.json(organization);
});

/**
 * @desc    Update organization profile and settings
 * @route   PUT /api/organizations/:id
 * @access  Private (Admin only)
 */
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

  // --- MEMBER LIMIT VALIDATION ---
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

  // --- TRACKING DES CHANGEMENTS ---
  let isAddressUpdated = !!address;
  let isProfileUpdated = !!(name || legalName || description || email || website || registrationNumber || taxId || timezone || phoneNumber || socialLinks || maxMembers);

  // Top-Level Field Updates
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

  // --- ENREGISTREMENT DANS L'HISTORIQUE ---
  if (isAddressUpdated) {
    await MemberHistory.create({
      organizationId: organization._id,
      action: "ORG_ADDRESS_UPDATED",
      actor: req.user._id,
    });
  }

  // S'il y a d'autres champs mis à jour que l'adresse, on trace aussi "ORG_UPDATED"
  if (isProfileUpdated && Object.keys(req.body).some(key => key !== 'address')) {
    await MemberHistory.create({
      organizationId: organization._id,
      action: "ORG_UPDATED",
      actor: req.user._id,
    });
  }
  
  res.json({
    organization: updatedOrganization,
    message: "ORG_UPDATED" 
  });
});

/**
 * @desc    Permanently delete an organization
 * @route   DELETE /api/organizations/:id
 * @access  Private (Admin only)
 */
export const deleteOrganization = asyncHandler(async (req, res) => {
  const organizationId = req.params.id;
  const organization = await Organization.findById(organizationId);
  
  if (!organization) {
    res.status(404);
    throw new Error("ORG_NOT_FOUND");
  }

  await organization.deleteOne();

  // Cleanup: Remove this organization from all users' memberships
  await User.updateMany(
    { "memberships.organizationId": organizationId },
    { $pull: { memberships: { organizationId: organizationId } } },
  );
  // Cleanup: Delete pending invitations
  await Invitation.deleteMany({ organizationId });

  res.status(200).json({ message: "ORG_DELETED" });
});

/**
 * @desc    Upload organization logo
 * @route   POST /api/organizations/:id/upload-logo
 * @access  Private
 */
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

  // Delete old logo
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

  // --- ENREGISTREMENT DANS L'HISTORIQUE ---
  await MemberHistory.create({
    organizationId: organization._id,
    action: "ORG_LOGO_UPLOADED",
    actor: req.user._id,
  });

  res.status(200).json({
    message: "LOGO_UPLOADED",
    logo: organization.logo,
  });
});

/**
 * @desc    Remove organization logo
 * @route   DELETE /api/organizations/:id/logo
 * @access  Private
 */
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

  // --- ENREGISTREMENT DANS L'HISTORIQUE ---
  await MemberHistory.create({
    organizationId: organization._id,
    action: "ORG_LOGO_DELETED",
    actor: req.user._id,
  });

  res.json({ message: "LOGO_REMOVED", logo: "" });
});

// ==========================================
// --- Member & Invitation Management ---
// ==========================================

/**
 * @desc    Invite a new member via email (Enforces maxMembers)
 * @route   POST /api/organizations/:id/invite
 * @access  Private (Admin only)
 */
export const inviteMember = asyncHandler(async (req, res) => {
  const { email, name, role, title } = req.body;
  const organizationId = req.params.id;

  const organization = await Organization.findById(organizationId);
  if (!organization) {
    res.status(404);
    throw new Error("ORG_NOT_FOUND");
  }

  // ENFORCE LIMIT: Count active members + pending invites
  const activeMembers = await User.countDocuments({ "memberships.organizationId": organizationId });
  const pendingInvites = await Invitation.countDocuments({ organizationId, status: "Pending" });
  
  if ((activeMembers + pendingInvites) >= organization.maxMembers) {
    res.status(403);
    throw new Error("ORG_MAX_MEMBERS_EXCEEDED");
  }

  const assignedRole = VALID_ROLES.includes(role) ? role : "employee";

  // Check if the user is already an active member
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

  // 1. Création de l'invitation
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

  // 2. Création de l'historique 
  const newHistory = await MemberHistory.create({
    organizationId,
    action: "INVITE_SENT",
    actor: req.user._id,
    targetEmail: email,
    details: { role: assignedRole },
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
    
    // --- ROLLBACK
    if (newInvitation) await Invitation.findByIdAndDelete(newInvitation._id);
    if (newHistory) await MemberHistory.findByIdAndDelete(newHistory._id); 
    
    res.status(500);
    throw new Error("INVITATION_FAILED");
  }
});

/**
 * @desc    Fetch all active members and pending invitations for an organization
 * @route   GET /api/organizations/:id/members
 * @access  Private
 */
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

/**
 * @desc    Modify a member's role
 * @route   PUT /api/organizations/:id/members/:memberId/role
 * @access  Private (Admin only)
 */
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

  // Mettre à jour le rôle
  member.memberships[membershipIndex].role = role;
  await member.save();

  // --- CRÉER L'HISTORIQUE ---
  await MemberHistory.create({
    organizationId,
    action: "ROLE_UPDATED",
    actor: req.user._id,
    targetUser: memberId,
    targetEmail: member.email,
    details: { role: role, oldRole: oldRole }, 
  });

  res.status(200).json({ message: "ROLE_UPDATED", role });
});

/**
 * @desc    Remove a member from the organization or cancel a pending invitation
 * @route   DELETE /api/organizations/:id/members/:memberId
 * @access  Private (Admin only)
 */
export const removeMember = asyncHandler(async (req, res) => {
  const { id: organizationId, memberId } = req.params;

  // Case 1: Pending invitation
  const invitation = await Invitation.findById(memberId);
  if (invitation) {
    await Invitation.findByIdAndDelete(memberId);

    // --- HISTORIQUE ---
    await MemberHistory.create({
      organizationId,
      action: "INVITE_CANCELLED",
      actor: req.user._id,
      targetEmail: invitation.email,
    });

    return res.status(200).json({ message: "INVITATION_CANCELLED" });
  }

  // Case 2: Active User
  const user = await User.findById(memberId);
  if (user) {
    user.memberships = user.memberships.filter(
      (m) => m.organizationId.toString() !== organizationId,
    );
    await user.save();

    // --- HISTORIQUE ---
    await MemberHistory.create({
      organizationId,
      action: "MEMBER_REMOVED",
      actor: req.user._id,
      targetUser: memberId,
      targetEmail: user.email,
    });

    return res.status(200).json({ message: "MEMBER_REMOVED" });
  }

  res.status(404);
  throw new Error("MEMBER_NOT_FOUND");
});

/**
 * @desc    Allow the logged-in user to leave an organization
 * @route   POST /api/organizations/:id/leave
 * @access  Private
 */
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

  // Prevention: Don't allow the last Admin to leave
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

  await MemberHistory.create({
    organizationId,
    action: "MEMBER_LEFT",
    actor: req.user._id,        
    targetUser: req.user._id,   
    targetEmail: user.email,
  });

  res.status(200).json({ message: "LEFT_ORG", user });
});


/**
 * @desc    Get organization history (audit logs) with pagination
 * @route   GET /api/organizations/:id/history
 * @access  Private (Admin recommended)
 */
export const getOrganizationHistory = asyncHandler(async (req, res) => {
  const organizationId = req.params.id;
  
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const organization = await Organization.findById(organizationId);
  if (!organization) {
    res.status(404);
    throw new Error("ORG_NOT_FOUND");
  }

  const totalItems = await MemberHistory.countDocuments({ organizationId });

  const history = await MemberHistory.find({ organizationId })
    .populate("actor", "name email profileImage") 
    .populate("targetUser", "name email profileImage") 
    .sort({ createdAt: -1 }) 
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    data: history,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit),
      totalItems,
      limit,
      hasNextPage: page * limit < totalItems,
      hasPrevPage: page > 1,
    },
  });
});