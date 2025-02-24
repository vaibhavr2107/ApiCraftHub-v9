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

    // Wrap the fetch call in a try-catch block
    let response: Response;
    try {
      // Execute the fetch request and handle network errors
      response = await fetch(requestUrl, requestOptions).catch((error) => {
        // Handle network errors here
        if (!navigator.onLine) {
          throw new Error("No internet connection. Please check your network and try again.");
        }
        const hostname = new URL(requestUrl).hostname;
        throw new Error(`Cloud Agent Error: Couldn't resolve host "${hostname}". Make sure the domain is publicly accessible.`);
      });

      clearTimeout(timeoutId);

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
      // Handle AbortError (timeout)
      if (error.name === 'AbortError') {
        throw new Error("Request timed out after 30 seconds");
      }
      // Re-throw the error with our custom message
      throw error;
    }
  } catch (error: any) {
    // Cleanup timeout if it exists
    if (timeoutId) clearTimeout(timeoutId);

    // Return formatted error
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    throw new Error(errorMessage);
  }
}