import { ResponseData } from "@/pages/home";

interface RequestOptions {
  method: string;
  url: string;
  body?: any;
}

export async function makeRequest({
  method,
  url,
  body,
}: RequestOptions): Promise<ResponseData> {
  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      status: response.status,
      statusText: response.statusText,
      headers,
      data: await response.json(),
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Request failed: ${error.message}`);
    }
    throw new Error("Request failed");
  }
}
