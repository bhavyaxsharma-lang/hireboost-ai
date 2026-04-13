import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import resumeRouter from "./resume";
import parseFileRouter from "./parse-file";
import paymentRouter from "./payment";
import interviewRouter from "./interview";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/resume", resumeRouter);
router.use("/resume", parseFileRouter);
router.use("/payment", paymentRouter);
router.use("/interview", interviewRouter);
router.use("/dashboard", dashboardRouter);

export default router;
