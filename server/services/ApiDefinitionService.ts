import path from 'path';
import { Request } from '@shared/schema';
import { TEMP_DIR, API_FOLDER, getAllFiles, ensureDirectories } from '../utils/fileUtils';
import { cloneRepository, identifyApiType } from '../utils/githubUtils';
import { WsdlService } from './WsdlService';
import { OpenApiService } from './OpenApiService';
import { RequestService } from './RequestService';

export interface ApiEnvironments {
  dev?: string;
  qa01?: string;
  qa02?: string;
  qa03?: string;
  perf?: string;
}

export class ApiDefinitionService {
  /**
   * Extracts WSDL requests - wrapper for WsdlService
   */
  public static extractWsdlRequests(wsdlContent: string, environments: ApiEnvironments): Request[] {
    return WsdlService.extractWsdlRequests(wsdlContent, environments);
  }

  /**
   * Extracts OpenAPI requests - wrapper for OpenApiService
   */
  public static extractOpenApiRequests(apiSpec: any, environments: ApiEnvironments): Request[] {
    return OpenApiService.extractOpenApiRequests(apiSpec, environments);
  }

  /**
   * Creates requests in the API system - wrapper for RequestService
   */
  public static async createRequests(requests: Request[]): Promise<{ success: number; failure: number; updated: number }> {
    return RequestService.createRequests(requests, API_FOLDER);
  }

  /**
   * Main method to process a GitHub repository
   */
  public static async processGithubRepo(
    githubUrl: string,
    username: string,
    password: string,
    projectName: string,
    wsdlPath: string = '',
    openApiPath: string = '',
    environments: ApiEnvironments = {}
  ): Promise<{
    type: 'REST' | 'SOAP' | 'UNKNOWN';
    requests: Request[];
    stats: { success: number; failure: number; updated: number };
  }> {
    try {
      // Ensure necessary directories exist
      await ensureDirectories([TEMP_DIR, API_FOLDER]);

      // Clone repository
      const repoDir = await cloneRepository(githubUrl, username, password, TEMP_DIR);

      // Identify API type
      let { type, mainFilePath } = await identifyApiType(repoDir, getAllFiles);

      // If paths were provided, use them
      if (wsdlPath && type !== 'SOAP') {
        const fs = await import('fs');
        const providedWsdlPath = path.resolve(repoDir, wsdlPath);
        if (fs.existsSync(providedWsdlPath)) {
          type = 'SOAP';
          mainFilePath = providedWsdlPath;
        }
      }

      if (openApiPath && type !== 'REST') {
        const fs = await import('fs');
        const providedOpenApiPath = path.resolve(repoDir, openApiPath);
        if (fs.existsSync(providedOpenApiPath)) {
          type = 'REST';
          mainFilePath = providedOpenApiPath;
        }
      }

      // Process based on API type
      let requests: Request[] = [];

      if (type === 'REST' && mainFilePath) {
        // Process OpenAPI
        const resolvedSpec = await OpenApiService.resolveOpenApiReferences(mainFilePath, repoDir);
        requests = this.extractOpenApiRequests(resolvedSpec, environments);
      } else if (type === 'SOAP' && mainFilePath) {
        // Process WSDL
        const resolvedWsdl = await WsdlService.resolveWsdlReferences(mainFilePath, repoDir);
        requests = this.extractWsdlRequests(resolvedWsdl, environments);
      }

      // Create requests in system
      const stats = await this.createRequests(requests);

      // Clean up
      try {
        const fs = await import('fs');
        fs.rmSync(repoDir, { recursive: true, force: true });
      } catch (error) {
        console.warn('Error cleaning up temporary directory:', error);
      }

      return { type, requests, stats };
    } catch (error) {
      console.error('Error processing GitHub repository:', error);
      throw error;
    }
  }
}