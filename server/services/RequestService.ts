
import fs from 'fs/promises';
import path from 'path';
import { Request, RequestSchema } from '@shared/schema';

export class RequestService {
  /**
   * Creates requests in the API system
   */
  public static async createRequests(
    requests: Request[],
    apiFolder: string
  ): Promise<{ success: number, failure: number, updated: number }> {
    let success = 0;
    let failure = 0;
    let updated = 0;

    // Ensure API folder exists
    try {
      await fs.access(apiFolder);
    } catch {
      await fs.mkdir(apiFolder, { recursive: true });
    }

    // Save each request to a file
    for (const request of requests) {
      try {
        // Set default auth to bearer-tiaa if not specified
        if (!request.auth || request.auth.type === 'none') {
          request.auth = { type: "bearer-tiaa" };
        }

        // Validate request with schema
        const validatedRequest = RequestSchema.parse(request);

        // Check for duplicates by matching path and method
        const apiFiles = await fs.readdir(apiFolder);
        const existingFiles = apiFiles.filter(file => file.endsWith('.json'));

        let isDuplicate = false;

        for (const file of existingFiles) {
          try {
            const content = await fs.readFile(path.join(apiFolder, file), 'utf-8');
            const existingRequest = JSON.parse(content);

            // Compare based on path and method to find duplicates
            if (existingRequest.method === request.method && 
                existingRequest.baseUrl === request.baseUrl && 
                existingRequest.name === request.name) {

              // Update the existing request but keep its ID
              const mergedRequest = {
                ...validatedRequest,
                requestId: existingRequest.requestId,
                routeId: existingRequest.routeId,
                historyId: existingRequest.historyId,
                historyRequests: existingRequest.historyRequests,
                updatedAt: new Date().toISOString()
              };

              await fs.writeFile(path.join(apiFolder, file), JSON.stringify(mergedRequest, null, 2));
              updated++;
              isDuplicate = true;
              break;
            }
          } catch (fileError) {
            console.warn(`Error reading file ${file} for duplicate check:`, fileError);
          }
        }

        if (!isDuplicate) {
          // Create the file for new request
          const filename = `${validatedRequest.routeId}.json`;
          const filePath = path.join(apiFolder, filename);

          await fs.writeFile(filePath, JSON.stringify(validatedRequest, null, 2));
          success++;
        }
      } catch (error) {
        console.error(`Error creating request ${request.name}:`, error);
        failure++;
      }
    }

    return { success, failure, updated };
  }
}
