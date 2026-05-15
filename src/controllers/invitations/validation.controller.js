// src/controllers/invitations/validation.controller.js
import asyncHandler from "express-async-handler";
import Invitation from "../../models/Invitation.js";
import User from "../../models/User.js";

export const validateInvitation = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const invitation = await Invitation.findOne({ token }).populate(
    "organizationId",
    "name logo",
  );

  if (!invitation) {
    res.status(404);
    throw new Error("INVITATION_INVALID");
  }

  const userExists = await User.findOne({ email: invitation.email });

  res.status(200).json({
    isValid: true,
    email: invitation.email,
    firstName: invitation.firstName,
    lastName: invitation.lastName,
    role: invitation.role,
    organization: invitation.organizationId,
    userExists: !!userExists,
  });
});
