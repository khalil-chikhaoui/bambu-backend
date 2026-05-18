import asyncHandler from "express-async-handler";
import EmployeeRecord from "../../models/hr/EmployeeRecord.js";
import User from "../../models/User.js";
import { logAudit } from "../../middlewares/audit.service.js"; 

export const getEmployees = asyncHandler(async (req, res) => {
  const { orgId } = req.params;
  const employees = await EmployeeRecord.find({ organizationId: orgId })
    .populate("userId", "firstName lastName email profileImage")
    .sort({ createdAt: -1 });

  res.status(200).json(employees);
});

export const getEmployeeById = asyncHandler(async (req, res) => {
  const { orgId, employeeId } = req.params;
  
  const employee = await EmployeeRecord.findOne({ 
    _id: employeeId, 
    organizationId: orgId 
  }).populate("userId", "firstName lastName email profileImage");

  if (!employee) {
    res.status(404);
    throw new Error("EMPLOYEE_RECORD_NOT_FOUND");
  }

  res.status(200).json(employee);
});

export const createEmployee = asyncHandler(async (req, res) => {
  const { orgId } = req.params;
  const { userId, ...recordData } = req.body;

  const user = await User.findOne({ _id: userId, "memberships.organizationId": orgId });
  if (!user) {
    res.status(400);
    throw new Error("USER_NOT_IN_ORGANIZATION");
  }

  const existingRecord = await EmployeeRecord.findOne({ userId, organizationId: orgId });
  if (existingRecord) {
    res.status(400);
    throw new Error("EMPLOYEE_RECORD_ALREADY_EXISTS");
  }

  const newEmployee = await EmployeeRecord.create({
    userId,
    organizationId: orgId,
    ...recordData
  });

  logAudit({
    organizationId: orgId,
    actor: req.user._id,
    module: "HR",
    action: "EMPLOYEE_RECORD_CREATED",
    targetModel: "EmployeeRecord",
    targetId: newEmployee._id,
  });

  res.status(201).json(newEmployee);
});

export const updateEmployee = asyncHandler(async (req, res) => {
  const { orgId, employeeId } = req.params;

  const employee = await EmployeeRecord.findOne({ _id: employeeId, organizationId: orgId });
  if (!employee) {
    res.status(404);
    throw new Error("EMPLOYEE_RECORD_NOT_FOUND");
  }

  const originalData = employee.toObject();
  const diff = { before: {}, after: {} };

  const updatableFields = [
    "socialSecurityNumber", "birthDate", "birthPlace", "nationality", 
    "emergencyContact", "bankDetails", "personalContact", "address", 
    "familySituation", "workAuthorization"
  ];
  
  updatableFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      let oldVal = originalData[field] || null;
      let newVal = req.body[field];

      // Gérer la comparaison des Dates ---
      if (field === 'birthDate') {
        const oldDate = oldVal ? new Date(oldVal).toISOString().split('T')[0] : null;
        const newDate = newVal ? new Date(newVal).toISOString().split('T')[0] : null;
        
        if (oldDate === newDate) {
          employee[field] = newVal;
          return; 
        }
      }

      // Merge pour les objets imbriqués
      if (typeof newVal === 'object' && newVal !== null && !Array.isArray(newVal)) {
        newVal = { ...(originalData[field] || {}), ...req.body[field] };
      }
      
      employee[field] = newVal;

      // Seulement si les données sont VRAIMENT différentes
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        diff.before[field] = oldVal;
        diff.after[field] = newVal;
      }
    }
  });

  const updatedEmployee = await employee.save();

  if (Object.keys(diff.after).length > 0) {
    logAudit({
      organizationId: orgId,
      actor: req.user._id,
      module: "HR",
      action: "EMPLOYEE_RECORD_UPDATED",
      targetModel: "EmployeeRecord",
      targetId: employee._id,
      diff: diff 
    });
  }

  res.status(200).json(updatedEmployee);
});

export const updateAssurances = asyncHandler(async (req, res) => {
  const { orgId, employeeId } = req.params;

  const employee = await EmployeeRecord.findOneAndUpdate(
    { _id: employeeId, organizationId: orgId },
    { assurances: req.body },
    { new: true, runValidators: true }
  );

  if (!employee) {
    res.status(404);
    throw new Error("EMPLOYEE_RECORD_NOT_FOUND");
  }

  res.status(200).json(employee);
});