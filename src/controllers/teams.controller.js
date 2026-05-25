import asyncHandler from "express-async-handler";
import Team from "../models/Team.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import { logAudit } from "../middlewares/audit.service.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// @desc    Create a new team
// @route   POST /api/organizations/:orgId/teams
// @access  Private
export const createTeam = asyncHandler(async (req, res) => {
  const { orgId } = req.params;
  const { name, description, leaderId, memberIds } = req.body;

  if (!name) {
    res.status(400);
    throw new Error("TEAM_NAME_REQUIRED");
  }

  // Check if team with same name exists
  const existingTeam = await Team.findOne({ organizationId: orgId, name });
  if (existingTeam) {
    res.status(400);
    throw new Error("TEAM_ALREADY_EXISTS");
  }

  const teamMembers = Array.isArray(memberIds) ? memberIds : [];

  if (leaderId && !teamMembers.includes(leaderId)) {
    teamMembers.push(leaderId);
  }

  const team = await Team.create({
    name,
    description: description || "",
    organizationId: orgId,
    leader: leaderId || undefined,
    members: teamMembers,
  });

  logAudit({
    organizationId: orgId,
    actor: req.user._id,
    module: "TEAM",
    action: "TEAM_CREATED",
    targetModel: "Team",
    targetId: team._id,
    metadata: {
      teamName: team.name,
      memberCount: teamMembers.length,
    },
  });

  res.status(201).json(team);
});

// @desc    Get all teams for an organization
// @route   GET /api/organizations/:orgId/teams
// @access  Private
export const getTeams = asyncHandler(async (req, res) => {
  const { orgId } = req.params;

  const teams = await Team.find({ organizationId: orgId })
    .populate("leader", "firstName lastName email profileImage")
    .populate("members", "firstName lastName email profileImage");

  res.json(teams);
});

// @desc    Get a specific team by ID
// @route   GET /api/organizations/:orgId/teams/:teamId
// @access  Private
export const getTeamById = asyncHandler(async (req, res) => {
  const { orgId, teamId } = req.params;

  const team = await Team.findOne({ _id: teamId, organizationId: orgId })
    .populate("leader", "firstName lastName email profileImage")
    .populate("members", "firstName lastName email profileImage");

  if (!team) {
    res.status(404);
    throw new Error("TEAM_NOT_FOUND");
  }

  res.json(team);
});

// @desc    Update team details (name, description, leader)
// @route   PUT /api/organizations/:orgId/teams/:teamId
// @access  Private
export const updateTeam = asyncHandler(async (req, res) => {
  const { orgId, teamId } = req.params;
  const { name, description, leaderId } = req.body;

  const team = await Team.findOne({ _id: teamId, organizationId: orgId });

  if (!team) {
    res.status(404);
    throw new Error("TEAM_NOT_FOUND");
  }

  let changed = false;
  const diff = { before: {}, after: {} };

  if (name && name !== team.name) {
    // Check name uniqueness if changed
    const existingTeam = await Team.findOne({ organizationId: orgId, name });
    if (existingTeam && existingTeam._id.toString() !== teamId) {
      res.status(400);
      throw new Error("TEAM_ALREADY_EXISTS");
    }
    diff.before.name = team.name;
    diff.after.name = name;
    team.name = name;
    changed = true;
  }

  if (description !== undefined && description !== team.description) {
    diff.before.description = team.description;
    diff.after.description = description;
    team.description = description;
    changed = true;
  }

  const oldLeaderStr = team.leader ? team.leader.toString() : null;
  const newLeaderStr = leaderId ? leaderId.toString() : null;

  if (newLeaderStr !== oldLeaderStr) {
    diff.before.leaderId = oldLeaderStr;
    diff.after.leaderId = newLeaderStr;
    team.leader = leaderId || undefined;
    changed = true;
    
    // Ensure the new leader is part of the members list
    if (newLeaderStr && !team.members.map(m => m.toString()).includes(newLeaderStr)) {
      team.members.push(leaderId);
    }
  }

  const updatedTeam = await team.save();

  if (changed) {
    logAudit({
      organizationId: orgId,
      actor: req.user._id,
      module: "TEAM",
      action: "TEAM_UPDATED",
      targetModel: "Team",
      targetId: team._id,
      diff,
    });
  }

  const populatedTeam = await Team.findById(team._id)
    .populate("leader", "firstName lastName email profileImage")
    .populate("members", "firstName lastName email profileImage");

  res.json(populatedTeam);
});

// @desc    Delete a team
// @route   DELETE /api/organizations/:orgId/teams/:teamId
// @access  Private
export const deleteTeam = asyncHandler(async (req, res) => {
  const { orgId, teamId } = req.params;

  const team = await Team.findOne({ _id: teamId, organizationId: orgId });

  if (!team) {
    res.status(404);
    throw new Error("TEAM_NOT_FOUND");
  }

  await team.deleteOne();

  logAudit({
    organizationId: orgId,
    actor: req.user._id,
    module: "TEAM",
    action: "TEAM_DELETED",
    targetModel: "Team",
    targetId: teamId,
    metadata: {
      teamName: team.name,
    },
  });

  res.json({ message: "TEAM_DELETED" });
});

// @desc    Add members to a team
// @route   POST /api/organizations/:orgId/teams/:teamId/members
// @access  Private
export const addMembersToTeam = asyncHandler(async (req, res) => {
  const { orgId, teamId } = req.params;
  const { memberIds } = req.body;

  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    res.status(400);
    throw new Error("MEMBER_IDS_REQUIRED");
  }

  const team = await Team.findOne({ _id: teamId, organizationId: orgId });

  if (!team) {
    res.status(404);
    throw new Error("TEAM_NOT_FOUND");
  }

  const currentMemberIds = team.members.map((m) => m.toString());
  const newMembers = memberIds.filter((id) => !currentMemberIds.includes(id));

  if (newMembers.length > 0) {
    team.members.push(...newMembers);
    await team.save();

    logAudit({
      organizationId: orgId,
      actor: req.user._id,
      module: "TEAM",
      action: "TEAM_MEMBER_ADDED",
      targetModel: "Team",
      targetId: team._id,
      metadata: {
        teamName: team.name,
        addedMemberIds: newMembers,
      },
    });
  }

  // Return updated team populated
  const updatedTeam = await Team.findById(teamId)
    .populate("leader", "firstName lastName email profileImage")
    .populate("members", "firstName lastName email profileImage");

  res.json(updatedTeam);
});

// @desc    Remove a member from a team
// @route   DELETE /api/organizations/:orgId/teams/:teamId/members/:memberId
// @access  Private
export const removeMemberFromTeam = asyncHandler(async (req, res) => {
  const { orgId, teamId, memberId } = req.params;

  const team = await Team.findOne({ _id: teamId, organizationId: orgId });

  if (!team) {
    res.status(404);
    throw new Error("TEAM_NOT_FOUND");
  }

  const memberIndex = team.members.findIndex((m) => m.toString() === memberId);

  if (memberIndex === -1) {
    res.status(404);
    throw new Error("MEMBER_NOT_IN_TEAM");
  }

  team.members.splice(memberIndex, 1);

  // If the member was the leader, remove them as leader too
  if (team.leader && team.leader.toString() === memberId) {
    team.leader = undefined;
  }

  await team.save();

  logAudit({
    organizationId: orgId,
    actor: req.user._id,
    module: "TEAM",
    action: "TEAM_MEMBER_REMOVED",
    targetModel: "Team",
    targetId: team._id,
    metadata: {
      teamName: team.name,
      targetUserId: memberId,
    },
  });

  res.json({ message: "TEAM_MEMBER_REMOVED" });
});

// @desc    Leave a team
// @route   POST /api/organizations/:orgId/teams/:teamId/leave
// @access  Private
export const leaveTeam = asyncHandler(async (req, res) => {
  const { orgId, teamId } = req.params;
  const userId = req.user._id.toString();

  const team = await Team.findOne({ _id: teamId, organizationId: orgId });

  if (!team) {
    res.status(404);
    throw new Error("TEAM_NOT_FOUND");
  }

  const memberIndex = team.members.findIndex((m) => m.toString() === userId);

  if (memberIndex === -1) {
    res.status(400);
    throw new Error("NOT_A_TEAM_MEMBER");
  }

  team.members.splice(memberIndex, 1);

  // If the member was the leader, remove them as leader
  if (team.leader && team.leader.toString() === userId) {
    team.leader = undefined;
  }

  await team.save();

  logAudit({
    organizationId: orgId,
    actor: req.user._id,
    module: "TEAM",
    action: "TEAM_MEMBER_LEFT",
    targetModel: "Team",
    targetId: team._id,
    metadata: {
      teamName: team.name,
      targetUserId: userId,
    },
  });

  res.json({ message: "LEFT_TEAM" });
});

// @desc    Upload team logo
// @route   POST /api/organizations/:orgId/teams/:teamId/upload-logo
// @access  Private
export const uploadTeamLogo = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("UPLOAD_NO_FILE");
  }

  const { orgId, teamId } = req.params;
  const team = await Team.findOne({ _id: teamId, organizationId: orgId });

  if (!team) {
    if (req.file.path) fs.unlinkSync(req.file.path);
    res.status(404);
    throw new Error("TEAM_NOT_FOUND");
  }

  if (team.logo && team.logo.includes("/api/images/")) {
    try {
      const oldFileName = team.logo.split("/").pop();
      const storagePath = process.env.UPLOAD_PATH || path.join(__dirname, "../../../images");
      const oldPath = path.join(storagePath, "teams", oldFileName);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    } catch (err) {
      console.log("Failed to delete old team logo:", err.message);
    }
  }

  team.logo = `${process.env.BACKEND_URL}/api/images/teams/${req.file.filename}`;
  await team.save();

  logAudit({
    organizationId: orgId,
    actor: req.user._id,
    module: "TEAM",
    action: "TEAM_LOGO_UPDATED",
    targetModel: "Team",
    targetId: team._id,
    metadata: {
      teamName: team.name,
    },
  });

  res.status(200).json({
    message: "LOGO_UPLOADED",
    logo: team.logo,
  });
});

// @desc    Delete team logo
// @route   DELETE /api/organizations/:orgId/teams/:teamId/logo
// @access  Private
export const deleteTeamLogo = asyncHandler(async (req, res) => {
  const { orgId, teamId } = req.params;
  const team = await Team.findOne({ _id: teamId, organizationId: orgId });

  if (!team) {
    res.status(404);
    throw new Error("TEAM_NOT_FOUND");
  }

  if (team.logo && team.logo.includes("/api/images/")) {
    try {
      const fileName = team.logo.split("/").pop();
      const storagePath = process.env.UPLOAD_PATH || path.join(__dirname, "../../../images");
      const filePath = path.join(storagePath, "teams", fileName);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (error) {
      console.log("Persistent Team Logo Delete Error:", error.message);
    }
  }

  team.logo = "";
  await team.save();

  logAudit({
    organizationId: orgId,
    actor: req.user._id,
    module: "TEAM",
    action: "TEAM_LOGO_DELETED",
    targetModel: "Team",
    targetId: team._id,
    metadata: {
      teamName: team.name,
    },
  });

  res.json({ message: "LOGO_REMOVED", logo: "" });
});
