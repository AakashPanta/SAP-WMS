import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sapRouter from "./sap";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sapRouter);

export default router;
