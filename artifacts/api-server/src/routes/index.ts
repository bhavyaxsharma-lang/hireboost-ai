import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import resumeRouter from "./resume";
import interviewRouter from "./interview";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/resume", resumeRouter);
router.use("/interview", interviewRouter);
router.use("/dashboard", dashboardRouter);

export default router;
