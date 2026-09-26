import { Router, type IRouter } from "express";
import healthRouter from "./health";
import assignmentRouter from "./assignment";

const router: IRouter = Router();

router.use(healthRouter);
router.use(assignmentRouter);

export default router;
