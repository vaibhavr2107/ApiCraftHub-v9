import { JavaParser } from './JavaParser';
import { SpringEndpoint } from '../types/spring';
import fs from 'fs';
import path from 'path';

export class SpringParser {
  private static modelCache: Map<string, Record<string, any>> = new Map();

  static async scanProject(projectPath: string) {
    console.log('Starting Spring project scan...');
    
    const endpoints: SpringEndpoint[] = [];
    this.modelCache.clear();

    // First pass: Scan and cache all models/DTOs
    await this.scanForModels(projectPath);
    console.log(`Found ${this.modelCache.size} models/DTOs`);

    // Second pass: Scan for endpoints
    await this.scanForEndpoints(projectPath, endpoints);
    console.log(`Found ${endpoints.length} endpoints`);

    return {
      endpoints,
      models: Object.fromEntries(this.modelCache)
    };
  }

  private static async scanForModels(dir: string) {
    const files = await fs.promises.readdir(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = await fs.promises.stat(filePath);

      if (stat.isDirectory()) {
        if (!['build', 'target', 'node_modules', '.git'].includes(file)) {
          await this.scanForModels(filePath);
        }
      } else if (file.endsWith('.java')) {
        const content = await fs.promises.readFile(filePath, 'utf8');
        
        // Check if file contains model/DTO
        if (file.endsWith('DTO.java') || file.endsWith('Model.java') || content.includes('@Entity')) {
          const ast = JavaParser.parseContent(content);
          if (!ast) continue;

          const modelClasses = JavaParser.findAnnotatedClasses(ast, ['@Entity', '@Data', '@Getter', '@Setter']);
          modelClasses.forEach(modelClass => {
            this.modelCache.set(modelClass.name, this.extractModelFields(modelClass));
          });
        }
      }
    }
  }

  private static async scanForEndpoints(dir: string, endpoints: SpringEndpoint[]) {
    const files = await fs.promises.readdir(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = await fs.promises.stat(filePath);

      if (stat.isDirectory()) {
        if (!['build', 'target', 'node_modules', '.git'].includes(file)) {
          await this.scanForEndpoints(filePath, endpoints);
        }
      } else if (file.endsWith('.java')) {
        const content = await fs.promises.readFile(filePath, 'utf8');
        
        // Parse REST controllers
        if (content.includes('@RestController') || content.includes('@Controller')) {
          console.log(`Processing REST controller: ${file}`);
          const ast = JavaParser.parseContent(content);
          if (!ast) continue;

          const controllers = JavaParser.findAnnotatedClasses(ast, ['@RestController', '@Controller']);
          controllers.forEach(controller => {
            const restEndpoints = this.processRestController(controller);
            endpoints.push(...restEndpoints);
          });
        }

        // Parse SOAP endpoints
        if (content.includes('@WebService')) {
          console.log(`Processing SOAP service: ${file}`);
          const ast = JavaParser.parseContent(content);
          if (!ast) continue;

          const services = JavaParser.findAnnotatedClasses(ast, ['@WebService']);
          services.forEach(service => {
            const soapEndpoints = this.processSoapService(service);
            endpoints.push(...soapEndpoints);
          });
        }
      }
    }
  }

  private static processRestController(controller: any): SpringEndpoint[] {
    const endpoints: SpringEndpoint[] = [];
    const basePath = this.getBaseRequestMapping(controller.annotations);

    controller.methods.forEach(method => {
      const mappingAnn = method.annotations.find(ann => 
        ann.name.endsWith('Mapping') || ann.name === '@RequestMapping'
      );

      if (!mappingAnn) return;

      const endpoint: SpringEndpoint = {
        type: 'REST',
        path: path.join(basePath, mappingAnn.args.value || ''),
        method: this.getHttpMethod(mappingAnn.name),
        parameters: this.processMethodParameters(method),
        headers: {},
        consumes: [],
        produces: []
      };

      // Process request body
      const requestBodyParam = method.parameters.find(p => 
        p.annotations.some(a => a.name === '@RequestBody')
      );
      if (requestBodyParam) {
        endpoint.requestBody = {
          type: requestBodyParam.type,
          fields: this.modelCache.get(requestBodyParam.type) || {},
          required: true
        };
      }

      // Process response body
      if (method.returnType !== 'void' && this.modelCache.has(method.returnType)) {
        endpoint.responseBody = {
          type: method.returnType,
          fields: this.modelCache.get(method.returnType) || {}
        };
      }

      endpoints.push(endpoint);
    });

    return endpoints;
  }

  private static processSoapService(service: any): SpringEndpoint[] {
    const endpoints: SpringEndpoint[] = [];
    const webServiceAnn = service.annotations.find(ann => ann.name === '@WebService');
    const namespace = webServiceAnn?.args?.targetNamespace || '';

    service.methods.forEach(method => {
      const webMethodAnn = method.annotations.find(ann => ann.name === '@WebMethod');
      if (!webMethodAnn) return;

      const endpoint: SpringEndpoint = {
        type: 'SOAP',
        path: `${namespace}/${webMethodAnn.args.operationName || method.name}`,
        method: 'POST',
        parameters: this.processMethodParameters(method),
        headers: {
          'Content-Type': 'text/xml',
          'SOAPAction': `${namespace}/${webMethodAnn.args.operationName || method.name}`
        },
        consumes: ['text/xml'],
        produces: ['text/xml']
      };

      // Process request wrapper
      const requestWrapperAnn = method.annotations.find(ann => ann.name === '@RequestWrapper');
      if (requestWrapperAnn && method.parameters.length > 0) {
        const paramType = method.parameters[0].type;
        endpoint.requestBody = {
          type: paramType,
          fields: this.modelCache.get(paramType) || {},
          required: true
        };
      }

      // Process response wrapper
      const responseWrapperAnn = method.annotations.find(ann => ann.name === '@ResponseWrapper');
      if (responseWrapperAnn && method.returnType !== 'void') {
        endpoint.responseBody = {
          type: method.returnType,
          fields: this.modelCache.get(method.returnType) || {}
        };
      }

      endpoints.push(endpoint);
    });

    return endpoints;
  }

  private static getBaseRequestMapping(annotations: any[]): string {
    const requestMapping = annotations.find(ann => ann.name === '@RequestMapping');
    return requestMapping?.args?.value || '';
  }

  private static getHttpMethod(mappingAnnotation: string): string {
    const methodMap: Record<string, string> = {
      '@GetMapping': 'GET',
      '@PostMapping': 'POST',
      '@PutMapping': 'PUT',
      '@DeleteMapping': 'DELETE',
      '@PatchMapping': 'PATCH',
      '@RequestMapping': 'GET'
    };
    return methodMap[mappingAnnotation] || 'GET';
  }

  private static processMethodParameters(method: any) {
    return method.parameters.map(param => {
      const paramType = param.annotations.find(a => 
        ['@PathVariable', '@RequestParam', '@RequestHeader', '@RequestBody'].includes(a.name)
      );

      return {
        name: param.name,
        type: param.type,
        required: true,
        in: this.getParameterType(paramType?.name)
      };
    });
  }

  private static getParameterType(annotationType: string | undefined): string {
    const typeMap: Record<string, string> = {
      '@PathVariable': 'path',
      '@RequestParam': 'query',
      '@RequestHeader': 'header',
      '@RequestBody': 'body'
    };
    return typeMap[annotationType || ''] || 'query';
  }

  private static extractModelFields(modelClass: any): Record<string, any> {
    const fields: Record<string, any> = {};
    // Process fields based on JavaParser's structure
    // Add field extraction logic here
    return fields;
  }
}
