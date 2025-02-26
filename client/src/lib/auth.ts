import { Environment } from "@/types/environment";

export type TokenEnvironment = "dev" | "qa01" | "qa02" | "qa03" | "perf" | "prod";

export async function getTiaaToken(environment: TokenEnvironment): Promise<string> {
  const tokenEndpoints = {
    dev: "/sit-token",
    qa01: "/sit-token",
    qa02: "/pte-token",
    qa03: "/pte-token",
    perf: "/perf-token",
    prod: "/perf-token"
  };

  const baseUrl = import.meta.env.VITE_OAUTH_PROVIDER_URL || "https://{oauth-provider-url}";
  const endpoint = tokenEndpoints[environment];
  
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch token: ${response.statusText}`);
    }

    const data = await response.json();
    return data.token; // Now correctly extracts token from {"token": "ACTUAL TOKEN"} format
  } catch (error) {
    console.error('Error fetching TIAA token:', error);
    throw error;
  }
}

export const getAuthHeader = async (authType: string, authConfig: any, environment: string): Promise<Record<string, string>> => {
  if (authType === "bearer-tiaa") {
    const token = await getTiaaToken(environment as TokenEnvironment);
    return {
      'Authorization': `Bearer ${token}`
    };
  }
  
  // Handle other auth types
  return {};
};
