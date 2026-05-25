import { Router } from "express";
import { protect } from "../middlewares/auth.js";
import {
  createTeam,
  getTeams,
  getTeamById,
  updateTeam,
  deleteTeam,
  addMembersToTeam,
  removeMemberFromTeam,
  leaveTeam,
  uploadTeamLogo,
  deleteTeamLogo,
} from "../controllers/teams.controller.js";
import { uploadTeamLogo as uploadTeamLogoMiddleware } from "../config/localUpload.js";

// mergeParams: true allows access to the :orgId from the parent router
const router = Router({ mergeParams: true });

// ALL PROTECTED
router.use(protect);

router.route("/")
  .post(createTeam)
  .get(getTeams);

router.route("/:teamId")
  .get(getTeamById)
  .put(updateTeam)
  .delete(deleteTeam);

router.post("/:teamId/upload-logo", uploadTeamLogoMiddleware.single("file"), uploadTeamLogo);
router.delete("/:teamId/logo", deleteTeamLogo);

router.route("/:teamId/members")
  .post(addMembersToTeam);

router.route("/:teamId/members/:memberId")
  .delete(removeMemberFromTeam);

router.route("/:teamId/leave")
  .post(leaveTeam);

export default router;
