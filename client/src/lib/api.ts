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
  try {
    // Validate URL
    if (!url) {
      throw new Error("URL is required");
    }

    // Ensure URL is properly formatted
    const requestUrl = url.startsWith('http') ? url : `https://${url}`;

    // Add timeout to fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(requestUrl, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      let data;
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      return {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        data,
        time: 0, // Will be calculated by the calling component
        size: new TextEncoder().encode(JSON.stringify(data)).length
      };
    } catch (fetchError) {
      if (fetchError.name === 'AbortError') {
        throw new Error("Request timed out. The server took too long to respond.");
      }

      if (!navigator.onLine) {
        throw new Error("No internet connection. Please check your network and try again.");
      }

      // Handle DNS resolution failures and other network errors
      if (fetchError instanceof TypeError) {
        throw new Error("Could not connect to the server. The URL might be invalid or the server might be down.");
      }

      throw fetchError;
    }
  } catch (error) {
    throw new Error(
      error instanceof Error 
        ? error.message 
        : "An unexpected error occurred while making the request."
    );
  }
}