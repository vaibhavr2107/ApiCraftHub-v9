import { parse } from 'java-parser';

export class JavaParser {
  // Parse Java source code into AST
  static parseContent(content: string) {
    try {
      return parse(content);
    } catch (error) {
      console.error('Failed to parse Java content:', error);
      return null;
    }
  }

  // Find all class declarations with specific annotations
  static findAnnotatedClasses(ast: any, annotations: string[]) {
    const classes = [];
    
    if (!ast || !ast.children) return classes;

    const visit = (node: any) => {
      if (node.type === 'ClassDeclaration') {
        const classAnnotations = this.getAnnotations(node);
        if (classAnnotations.some(ann => annotations.includes(ann.name))) {
          classes.push({
            name: node.name.identifier,
            annotations: classAnnotations,
            methods: this.findMethods(node)
          });
        }
      }

      if (node.children) {
        Object.values(node.children).forEach(child => {
          if (Array.isArray(child)) {
            child.forEach(visit);
          } else {
            visit(child);
          }
        });
      }
    };

    visit(ast);
    return classes;
  }

  // Get all annotations from a node
  static getAnnotations(node: any) {
    const annotations = [];
    if (node.children && node.children.annotation) {
      node.children.annotation.forEach((ann: any) => {
        const name = ann.children.At[0].image + ann.children.Identifier[0].image;
        const args = this.getAnnotationArguments(ann);
        annotations.push({ name, args });
      });
    }
    return annotations;
  }

  // Extract method details including annotations and parameters
  static findMethods(classNode: any) {
    const methods = [];
    
    if (!classNode.children || !classNode.children.classBody) return methods;

    classNode.children.classBody[0].children.classBodyDeclaration.forEach((decl: any) => {
      if (decl.children.methodDeclaration) {
        const method = decl.children.methodDeclaration[0];
        const annotations = this.getAnnotations(decl);
        
        methods.push({
          name: method.children.methodHeader[0].children.Identifier[0].image,
          annotations,
          returnType: this.getMethodReturnType(method),
          parameters: this.getMethodParameters(method)
        });
      }
    });

    return methods;
  }

  // Get method return type
  static getMethodReturnType(methodNode: any) {
    const header = methodNode.children.methodHeader[0];
    if (header.children.result[0].children.unannType) {
      return this.extractType(header.children.result[0].children.unannType[0]);
    }
    return 'void';
  }

  // Get method parameters with their types and annotations
  static getMethodParameters(methodNode: any) {
    const parameters = [];
    const header = methodNode.children.methodHeader[0];
    
    if (!header.children.methodParameters) return parameters;

    header.children.methodParameters[0].children.methodParameter.forEach((param: any) => {
      parameters.push({
        name: param.children.variableDeclaratorId[0].children.Identifier[0].image,
        type: this.extractType(param.children.unannType[0]),
        annotations: this.getAnnotations(param)
      });
    });

    return parameters;
  }

  // Extract full type information including generics
  static extractType(typeNode: any) {
    if (typeNode.children.unannClassType) {
      const baseType = typeNode.children.unannClassType[0].children.Identifier[0].image;
      if (typeNode.children.unannClassType[0].children.typeArguments) {
        const typeArgs = typeNode.children.unannClassType[0].children.typeArguments[0].children.typeArgumentList[0]
          .children.typeArgument.map((arg: any) => this.extractType(arg.children.referenceType[0]));
        return `${baseType}<${typeArgs.join(', ')}>`;
      }
      return baseType;
    }
    return 'Object';
  }

  // Get annotation arguments
  static getAnnotationArguments(annotationNode: any) {
    const args: Record<string, any> = {};
    
    if (!annotationNode.children.annotationArguments) return args;

    const elementValuePairs = annotationNode.children.annotationArguments[0].children.elementValuePairList;
    if (elementValuePairs) {
      elementValuePairs[0].children.elementValuePair.forEach((pair: any) => {
        const key = pair.children.Identifier[0].image;
        const value = this.extractElementValue(pair.children.elementValue[0]);
        args[key] = value;
      });
    } else {
      const singleValue = annotationNode.children.annotationArguments[0].children.elementValue;
      if (singleValue) {
        args.value = this.extractElementValue(singleValue[0]);
      }
    }

    return args;
  }

  // Extract element value from annotation
  static extractElementValue(elementValueNode: any) {
    if (elementValueNode.children.StringLiteral) {
      return elementValueNode.children.StringLiteral[0].image.slice(1, -1);
    }
    if (elementValueNode.children.Identifier) {
      return elementValueNode.children.Identifier[0].image;
    }
    return null;
  }
}
