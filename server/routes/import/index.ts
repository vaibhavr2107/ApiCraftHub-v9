
import express from "express";
import { fileURLToPath } from "url";
import { dirname } from "path";
import githubRoutes from "./github";
import wsdlRoutes from "./wsdl";
import openApiRoutes from "./openapi";
import fileRoutes from "./file";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Register sub-routes
router.use('/github', githubRoutes);
router.use('/wsdl', wsdlRoutes);
router.use('/openapi', openApiRoutes);
router.use('/collection', fileRoutes);

export default router;
