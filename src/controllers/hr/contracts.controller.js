// src/controllers/hr/contracts.controller.js
import asyncHandler from "express-async-handler";
import Contract from "../../models/hr/Contract.js";
import { logAudit } from "../../middlewares/audit.service.js";

// @desc    Get all contracts for an employee
// @route   GET /api/organizations/:orgId/hr/employees/:employeeId/contracts
// @access  Private
export const getEmployeeContracts = asyncHandler(async (req, res) => {
  const { orgId, employeeId } = req.params;

  const contracts = await Contract.find({ 
    employeeRecordId: employeeId, 
    organizationId: orgId 
  }).sort({ startDate: -1 });

  res.status(200).json(contracts);
});

// @desc    Create a new contract
// @route   POST /api/organizations/:orgId/hr/employees/:employeeId/contracts
// @access  Private (Admin/HR)
export const createContract = asyncHandler(async (req, res) => {
  const { orgId, employeeId } = req.params;

  const newContract = await Contract.create({
    employeeRecordId: employeeId,
    organizationId: orgId,
    ...req.body
  });

  logAudit({
    organizationId: orgId,
    actor: req.user._id,
    module: "HR",
    action: "CONTRACT_CREATED",
    targetModel: "Contract",
    targetId: newContract._id,
  });

  res.status(201).json(newContract);
});

// @desc    Update a contract
// @route   PUT /api/organizations/:orgId/hr/employees/:employeeId/contracts/:contractId
// @access  Private (Admin/HR)
export const updateContract = asyncHandler(async (req, res) => {
  const { orgId, employeeId, contractId } = req.params;

  const contract = await Contract.findOneAndUpdate(
    { _id: contractId, employeeRecordId: employeeId, organizationId: orgId },
    req.body,
    { new: true, runValidators: true }
  );

  if (!contract) {
    res.status(404);
    throw new Error("CONTRACT_NOT_FOUND");
  }

  logAudit({
    organizationId: orgId,
    actor: req.user._id,
    module: "HR",
    action: "CONTRACT_UPDATED",
    targetModel: "Contract",
    targetId: contract._id,
  });

  res.status(200).json(contract);
});