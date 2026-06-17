import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import passwordResetRouter from "./password-reset";
import resumeRouter from "./resume";
import parseFileRouter from "./parse-file";
import interviewRouter from "./interview";
import jdPrepRouter from "./jd-prep";
import dashboardRouter from "./dashboard";
import paymentRouter from "./payment";

import salaryRouter from "./salary";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/auth", passwordResetRouter);
router.use("/resume", resumeRouter);
router.use("/resume", parseFileRouter);
router.use("/interview", interviewRouter);
router.use("/interview", jdPrepRouter);
router.use("/dashboard", dashboardRouter);
router.use("/payment", paymentRouter);

router.use("/salary", salaryRouter);

export default router;
