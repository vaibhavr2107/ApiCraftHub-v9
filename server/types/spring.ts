export interface SpringParameter {
  name: string;
  type: string;
  required: boolean;
  in: 'path' | 'query' | 'header' | 'body';
}

export interface SpringEndpoint {
  path: string;
  method: string;
  type: 'REST' | 'SOAP';
  parameters: SpringParameter[];
  requestBody?: {
    type: string;
    fields: Record<string, any>;
    required: boolean;
  };
  responseBody?: {
    type: string;
    fields: Record<string, any>;
  };
  headers: Record<string, string>;
  consumes?: string[];
  produces?: string[];
}
