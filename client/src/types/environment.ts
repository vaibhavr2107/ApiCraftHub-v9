export type Environment = "dev" | "qa01" | "qa02" | "qa03" | "perf" | "prod";

export interface EnvironmentConfig {
  baseUrl: string;
  bearerToken: string;
}

export interface EnvironmentStore {
  environments: Record<Environment, EnvironmentConfig>;
  selected: Environment;
}

export const DEFAULT_ENVIRONMENTS: Record<Environment, EnvironmentConfig> = {
  dev: {
    baseUrl: "https://api-dev.example.com",
    bearerToken: ""
  },
  qa01: {
    baseUrl: "https://api-qa01.example.com",
    bearerToken: ""
  },
  qa02: {
    baseUrl: "https://api-qa02.example.com",
    bearerToken: ""
  },
  qa03: {
    baseUrl: "https://api-qa03.example.com",
    bearerToken: ""
  },
  perf: {
    baseUrl: "https://api-perf.example.com",
    bearerToken: ""
  },
  prod: {
    baseUrl: "https://api-prod.example.com",
    bearerToken: ""
  }
};
