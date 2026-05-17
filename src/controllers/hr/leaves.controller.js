// src/controllers/hr/leaves.controller.js
import asyncHandler from "express-async-handler";
import LeaveRequest from "../../models/hr/LeaveRequest.js";
import EmployeeRecord from "../../models/hr/EmployeeRecord.js";
import { logAudit } from "../../middlewares/audit.service.js";

// @desc    Get all leave requests for the organization
// @route   GET /api/organizations/:orgId/hr/leaves
// @access  Private (Admin/HR)
export const getOrgLeaves = asyncHandler(async (req, res) => {
  const { orgId } = req.params;
  const leaves = await LeaveRequest.find({ organizationId: orgId })
    .populate({
      path: "employeeRecordId",
      populate: { path: "userId", select: "firstName lastName profileImage" }
    })
    .sort({ startDate: -1 });

  res.status(200).json(leaves);
});

// @desc    Get leave requests for a specific employee
// @route   GET /api/organizations/:orgId/hr/employees/:employeeId/leaves
// @access  Private
export const getEmployeeLeaves = asyncHandler(async (req, res) => {
  const { orgId, employeeId } = req.params;
  const leaves = await LeaveRequest.find({ employeeRecordId: employeeId, organizationId: orgId })
    .sort({ createdAt: -1 });

  res.status(200).json(leaves);
});

// @desc    Submit a new leave request
// @route   POST /api/organizations/:orgId/hr/employees/:employeeId/leaves
// @access  Private
export const createLeaveRequest = asyncHandler(async (req, res) => {
  const { orgId, employeeId } = req.params;

  const newLeave = await LeaveRequest.create({
    employeeRecordId: employeeId,
    organizationId: orgId,
    ...req.body,
    status: "PENDING"
  });

  res.status(201).json(newLeave);
});

// @desc    Approve/Reject a leave request (Adjusts balances)
// @route   PUT /api/organizations/:orgId/hr/employees/:employeeId/leaves/:leaveId/status
// @access  Private (Admin/HR)
export const updateLeaveStatus = asyncHandler(async (req, res) => {
  const { orgId, employeeId, leaveId } = req.params;
  const { status, managerComment } = req.body; // status: "APPROVED", "REJECTED"

  const leave = await LeaveRequest.findOne({ _id: leaveId, employeeRecordId: employeeId, organizationId: orgId });
  if (!leave) {
    res.status(404);
    throw new Error("LEAVE_REQUEST_NOT_FOUND");
  }

  // Prevent modifying an already processed leave without proper logic
  if (leave.status !== "PENDING" && status === "APPROVED") {
    res.status(400);
    throw new Error("LEAVE_ALREADY_PROCESSED");
  }

  leave.status = status;
  leave.managerComment = managerComment;
  leave.approvedBy = req.user._id;

  // Deduct balance if approved
  if (status === "APPROVED") {
    const employee = await EmployeeRecord.findById(employeeId);
    if (leave.type === "CP") {
      employee.leaveBalances.cpBalance -= leave.totalDays;
    } else if (leave.type === "RTT") {
      employee.leaveBalances.rttBalance -= leave.totalDays;
    }
    await employee.save();
  }

  const updatedLeave = await leave.save();

  logAudit({
    organizationId: orgId,
    actor: req.user._id,
    module: "HR",
    action: `LEAVE_${status}`, // e.g., LEAVE_APPROVED
    targetModel: "LeaveRequest",
    targetId: updatedLeave._id,
  });

  res.status(200).json(updatedLeave);
});