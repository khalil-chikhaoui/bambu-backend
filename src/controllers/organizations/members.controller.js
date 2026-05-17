// src/controllers/organizations/members.controller.js
import asyncHandler from "express-async-handler";
import Organization from "../../models/Organization.js";
import User from "../../models/User.js";
import Invitation from "../../models/Invitation.js";
import crypto from "crypto";
import mongoose from "mongoose";
import { getTransporter } from "../../config/mail.js";
import { logAudit } from "../../middlewares/audit.service.js";
import EmployeeRecord from "../../models/hr/EmployeeRecord.js";

const VALID_ROLES = ["admin", "employee"];

export const inviteMember = asyncHandler(async (req, res) => {
  const { email, firstName, lastName, role, title } = req.body;
  const organizationId = req.params.id;

  const organization = await Organization.findById(organizationId);
  if (!organization) {
    res.status(404);
    throw new Error("ORG_NOT_FOUND");
  }

  // Business Logic: Check total seats (Active + Pending)
  const activeMembers = await User.countDocuments({
    "memberships.organizationId": organizationId,
  });
  const pendingInvites = await Invitation.countDocuments({
    organizationId,
    status: "Pending",
  }); 

  if (activeMembers + pendingInvites >= organization.maxMembers) {
    res.status(403);
    throw new Error("ORG_MAX_MEMBERS_EXCEEDED");
  }

  const assignedRole = VALID_ROLES.includes(role) ? role : "employee";

  // Check if user is already a member
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

  // Create Invitation
  const newInvitation = await Invitation.create({
    firstName, // Fixed: Using correctly destructured variable
    lastName, // Fixed: Using correctly destructured variable
    email,
    organizationId,
    role: assignedRole,
    title: title || "Staff",
    token,
    invitedBy: req.user._id,
    status: "Pending",
  });

  const inviteFullName = `${firstName} ${lastName}`.trim();

  // Log to Audit Ledger
  logAudit({
    organizationId,
    actor: req.user._id,
    module: "TEAM",
    action: "INVITE_SENT",
    targetModel: "Invitation",
    targetId: newInvitation._id,
    metadata: {
      targetEmail: email,
      role: assignedRole,
      targetName: inviteFullName,
    },
  });

  try {
    const transporter = getTransporter();

    await transporter.sendMail({
      from: `"Bambu ERP" <${process.env.SMTP_EMAIL}>`,
      to: email,
      subject: `Invitation à rejoindre ${organization.name}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 12px;">
          <h2 style="color: #184c16;">Bonjour ${firstName}!</h2>
          <p>Vous avez été invité(e) à rejoindre <strong>${organization.name}</strong>.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" style="background: #184c16; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Accepter l'invitation</a>
          </div>
          <p style="font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 10px;">
            Envoyé par ${req.user.firstName} ${req.user.lastName} de ${organization.name}.
          </p>
        </div>
      `,
    });

    res.status(200).json({ message: "INVITATION_SENT" });
  } catch (err) {
    console.log("Email Error:", err);
    // Cleanup if email fails
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
    userQuery.$or = [
      { firstName: searchRegex },
      { lastName: searchRegex },
      { email: searchRegex },
    ];
    inviteQuery.$or = [
      { firstName: searchRegex },
      { lastName: searchRegex },
      { email: searchRegex },
    ];
  }

  const [users, invitations] = await Promise.all([
    User.find(userQuery).select(
      "firstName lastName email profileImage memberships",
    ),
    Invitation.find(inviteQuery),
  ]);

  const activeMembers = users.map((user) => {
    const membership = user.memberships.find(
      (m) => m.organizationId.toString() === organizationId,
    );
    return {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      profileImage: user.profileImage,
      role: membership.role,
      title: membership.title,
      invitationStatus: "Accepted",
    };
  });

  const pendingInvites = invitations.map((invite) => ({
    id: invite._id,
    firstName: invite.firstName,
    lastName: invite.lastName,
    name:
      `${invite.firstName} ${invite.lastName}`.trim() ||
      invite.email.split("@")[0],
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
    metadata: {
      role: role,
      oldRole: oldRole,
      targetEmail: member.email,
      targetName: `${member.firstName} ${member.lastName}`.trim(),
    },
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
      metadata: {
        targetEmail: invitation.email,
        targetName: `${invitation.firstName} ${invitation.lastName}`.trim(),
      },
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
      metadata: {
        targetEmail: user.email,
        targetName: `${user.firstName} ${user.lastName}`.trim(),
      },
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
      _id: { $ne: user._id },
      memberships: {
        $elemMatch: {
          organizationId: organizationId,
          role: "admin",
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
    metadata: {
      targetEmail: user.email,
      targetName: `${user.firstName} ${user.lastName}`.trim(),
    },
  });

  res.status(200).json({ message: "LEFT_ORG", user });
});


// @desc    Get organization members who DO NOT have an HR employee record yet
// @route   GET /api/organizations/:id/members-without-records
// @access  Private (Admin/HR)
export const getMembersWithoutEmployeeRecord = asyncHandler(async (req, res) => {
  const organizationId = req.params.id;
  const oId = new mongoose.Types.ObjectId(organizationId);

  // 1. Get all active members of the organization
  const users = await User.find({ "memberships.organizationId": oId })
    .select("firstName lastName email profileImage");

  // 2. Get all existing EmployeeRecord userIds for this specific organization
  const existingRecords = await EmployeeRecord.find({ organizationId: oId })
    .select("userId")
    .lean();
  
  // Create a Set of strings for efficient lookup O(1)
  const existingUserIds = new Set(existingRecords.map(rec => rec.userId.toString()));

  // 3. Filter out users who already have an HR record
  const availableMembers = users
    .filter(user => !existingUserIds.has(user._id.toString()))
    .map(user => ({
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      profileImage: user.profileImage,
    }));

  res.status(200).json(availableMembers);
});