import type { ResponseData } from "@/types/api-request";

interface RequestOptions {
  method: string;
  url: string;
  body?: any;
  headers?: Record<string, string>;
}

export async function makeRequest({
  method,
  url,
  body,
  headers = {},
}: RequestOptions): Promise<ResponseData> {
  let timeoutId: NodeJS.Timeout;
  let controller: AbortController;

  try {
    // Validate URL
    if (!url) {
      throw new Error("URL is required");
    }

    // Ensure URL is properly formatted
    let requestUrl: string;
    try {
      requestUrl = url.startsWith('http') ? url : `https://${url}`;
      new URL(requestUrl); // Validate URL format
    } catch (urlError) {
      throw new Error("Invalid URL format. Please check the URL and try again.");
    }

    // Setup timeout controller
    controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    // Create headers with content type
    const requestHeaders = {
      "Content-Type": "application/json",
      ...headers,
    };

    // Create request options
    const requestOptions = {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    };

    let response: Response;

    try {
      // Make the request within a Promise.race to handle timeouts
      response = await Promise.race([
        fetch(requestUrl, requestOptions),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error("Request timed out after 30 seconds"));
          }, 30000);
        }),
      ]) as Response;

    } catch (error: any) {
      // Clear timeout if it exists
      if (timeoutId) clearTimeout(timeoutId);

      // Check online status
      if (!navigator.onLine) {
        throw new Error("No internet connection. Please check your network and try again.");
      }

      // Get hostname for error message
      const hostname = new URL(requestUrl).hostname;

      // Handle specific error types
      if (error.name === 'AbortError') {
        throw new Error("Request timed out after 30 seconds");
      }

      // Handle failed to fetch and other network errors
      throw new Error(`Cloud Agent Error: Couldn't resolve host "${hostname}". Make sure the domain is publicly accessible.`);
    }

    // Clear timeout since request completed
    if (timeoutId) clearTimeout(timeoutId);

    // Process response headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // Process response data
    let data;
    const contentType = response.headers.get("content-type");
    try {
      if (contentType?.includes("application/json")) {
        data = await response.json();
      } else {
        data = await response.text();
      }
    } catch (parseError) {
      throw new Error("Failed to parse response data");
    }

    // Return formatted response
    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      data,
      time: 0, // Will be calculated by the calling component
      size: new TextEncoder().encode(JSON.stringify(data)).length
    };

  } catch (error: any) {
    // Cleanup timeout if it exists
    if (timeoutId) clearTimeout(timeoutId);

    // Return formatted error
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    throw new Error(errorMessage);
  }
}