import express from 'express';
import { z } from 'zod';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Validation schema for import request
const importRequestSchema = z.object({
  serviceName: z.string(),
  devUrl: z.string().optional(),
  qa01Url: z.string().optional(),
  qa02Url: z.string().optional(),
  qa03Url: z.string().optional(),
  perfUrl: z.string().optional(),
  gitUrl: z.string(),
  username: z.string(),
  password: z.string(),
});

// Temporary directory for cloning repositories
const TEMP_DIR = path.join(__dirname, '../temp');

router.post('/import', async (req, res) => {
  try {
    const importData = importRequestSchema.parse(req.body);
    
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    const repoDir = path.join(TEMP_DIR, importData.serviceName);
    
    // Clone repository
    const gitCommand = `git clone https://${importData.username}:${importData.password}@${importData.gitUrl.replace('https://', '')} ${repoDir}`;
    execSync(gitCommand);

    // Scan for endpoints
    const endpoints = await scanRepository(repoDir);

    // Clean up
    fs.rmSync(repoDir, { recursive: true, force: true });

    res.json({ endpoints });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to import service' 
    });
  }
});

async function scanRepository(repoPath: string) {
  const endpoints: any[] = [];

  // Read all files recursively
  function scanDir(dir: string) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        scanDir(filePath);
      } else {
        const ext = path.extname(file).toLowerCase();
        if (['.java', '.ts', '.js', '.cs'].includes(ext)) {
          const content = fs.readFileSync(filePath, 'utf8');
          
          // Scan for REST endpoints
          scanForRestEndpoints(content, endpoints);
          
          // Scan for SOAP endpoints
          scanForSoapEndpoints(content, endpoints);
        }
      }
    });
  }

  scanDir(repoPath);
  return endpoints;
}

function scanForRestEndpoints(content: string, endpoints: any[]) {
  // REST endpoint patterns
  const patterns = [
    // Spring annotations
    /@(Get|Post|Put|Delete|Patch)Mapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/g,
    // Express patterns
    /\.(get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/g,
    // ASP.NET patterns
    /\[Http(Get|Post|Put|Delete|Patch)\s*\(\s*["']([^"']+)["']\s*\)]/g
  ];

  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      endpoints.push({
        path: match[2],
        method: match[1].toUpperCase(),
        type: 'REST'
      });
    }
  });
}

function scanForSoapEndpoints(content: string, endpoints: any[]) {
  // SOAP endpoint patterns
  const patterns = [
    // WebService annotation
    /@WebService\s*\(\s*(?:targetNamespace\s*=\s*)?["']([^"']+)["']/g,
    // SOAP action
    /@SOAPAction\s*\(\s*["']([^"']+)["']/g,
    // WCF service contract
    /\[ServiceContract\s*\(\s*(?:Namespace\s*=\s*)?["']([^"']+)["']/g
  ];

  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      endpoints.push({
        path: match[1],
        type: 'SOAP'
      });
    }
  });
}

export default router;
