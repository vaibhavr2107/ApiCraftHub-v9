
import express from 'express';
import githubRoutes from './github';
import openApiRoutes from './openapi';
import wsdlRoutes from './wsdl';
import fileRoutes from './file';

const router = express.Router();

// Mount the modular routes
router.use('/github', githubRoutes);
router.use('/openapi', openApiRoutes);
router.use('/wsdl', wsdlRoutes);
router.use('/file', fileRoutes);

export default router;
