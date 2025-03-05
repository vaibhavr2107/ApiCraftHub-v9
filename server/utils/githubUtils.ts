
import { execSync } from 'child_process';
import path from 'path';
import crypto from 'crypto';
import fsSync from 'fs';
import { cleanupDirectory } from './fileUtils';

/**
 * Clones a GitHub repository to a temporary directory
 */
export async function cloneRepository(
  githubUrl: string,
  username: string,
  password: string,
  tempDir: string
): Promise<string> {
  // Create a unique directory for this import
  const importId = crypto.randomUUID();
  const repoDir = path.join(tempDir, importId);

  // Clean up existing directory if it exists
  cleanupDirectory(repoDir);

  try {
    // Format git URL for authentication
    const gitUrl = githubUrl.replace('https://', '');
    const gitCommand = `git clone https://${username}:${password}@${gitUrl} ${repoDir}`;

    // Execute git clone command
    execSync(gitCommand);

    return repoDir;
  } catch (error) {
    console.error('Error cloning repository:', error);
    throw new Error(`Failed to clone repository: ${error}`);
  }
}

/**
 * Identifies API type (REST/SOAP) by searching for relevant files
 */
export async function identifyApiType(
  repoDir: string,
  getAllFiles: (dir: string) => Promise<string[]>
): Promise<{ 
  type: 'REST' | 'SOAP' | 'UNKNOWN',
  mainFilePath: string | null
}> {
  try {
    // Get all files recursively
    const allFiles = await getAllFiles(repoDir);

    // Look for OpenAPI files
    const openApiFiles = allFiles.filter(file => {
      const fileName = path.basename(file).toLowerCase();
      const ext = path.extname(file).toLowerCase();
      return (
        fileName === 'swagger.json' || 
        fileName === 'swagger.yaml' || 
        fileName === 'swagger.yml' ||
        fileName === 'openapi.json' || 
        fileName === 'openapi.yaml' || 
        fileName === 'openapi.yml' ||
        (ext === '.json' || ext === '.yaml' || ext === '.yml') && 
        fsSync.readFileSync(file, 'utf8').includes('"openapi"') ||
        fsSync.readFileSync(file, 'utf8').includes('openapi:')
      );
    });

    // Look for WSDL files
    const wsdlFiles = allFiles.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ext === '.wsdl' || ext === '.xsd';
    });

    if (openApiFiles.length > 0) {
      // Find main OpenAPI file (prefer root-level files)
      const rootOpenApiFiles = openApiFiles.filter(file => {
        const relativePath = path.relative(repoDir, file);
        return !relativePath.includes(path.sep) || relativePath.split(path.sep).length <= 2;
      });

      const mainFilePath = rootOpenApiFiles.length > 0 ? rootOpenApiFiles[0] : openApiFiles[0];
      return { type: 'REST', mainFilePath };
    }

    if (wsdlFiles.length > 0) {
      // Find main WSDL file (look for .wsdl files, not .xsd)
      const wsdlOnlyFiles = wsdlFiles.filter(file => path.extname(file).toLowerCase() === '.wsdl');
      const mainFilePath = wsdlOnlyFiles.length > 0 ? wsdlOnlyFiles[0] : wsdlFiles[0];
      return { type: 'SOAP', mainFilePath };
    }

    return { type: 'UNKNOWN', mainFilePath: null };
  } catch (error) {
    console.error('Error identifying API type:', error);
    return { type: 'UNKNOWN', mainFilePath: null };
  }
}
