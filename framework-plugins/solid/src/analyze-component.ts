import type { ComponentAnalysis } from "@previewjs/core";
import {
  dereferenceType,
  EMPTY_OBJECT_TYPE,
  objectType,
  TypeResolver,
  UNKNOWN_TYPE,
} from "@previewjs/type-analyzer";
import type { Logger } from "pino";
import ts from "typescript";

export function analyzeSolidComponent(
  logger: Logger,
  typeResolver: TypeResolver,
  signature: ts.Signature
): ComponentAnalysis {
  const firstParam = signature.getParameters()[0];
  if (!firstParam) {
    return {
      propsType: EMPTY_OBJECT_TYPE,
      types: {},
    };
  }
  if (!firstParam.valueDeclaration) {
    return {
      propsType: UNKNOWN_TYPE,
      types: {},
    };
  }
  const type = typeResolver.checker.getTypeOfSymbolAtLocation(
    firstParam,
    firstParam.valueDeclaration
  );
  try {
    let { type: propsType, collected } = typeResolver.resolveType(type);
    [propsType] = dereferenceType(propsType, collected, []);
    stripUnusedProps: if (
      propsType.kind === "object" &&
      ts.isParameter(firstParam.valueDeclaration)
    ) {
      if (ts.isObjectBindingPattern(firstParam.valueDeclaration.name)) {
        const bindingPattern = firstParam.valueDeclaration.name;
        const usedProps = new Set<string>();
        for (const element of bindingPattern.elements) {
          if (element.dotDotDotToken) {
            break stripUnusedProps;
          }
          const elementName = element.propertyName || element.name;
          if (!ts.isIdentifier(elementName)) {
            break stripUnusedProps;
          }
          usedProps.add(elementName.text);
        }
        propsType = objectType(
          Object.fromEntries(
            Object.entries(propsType.fields).filter(([key]) =>
              usedProps.has(key)
            )
          )
        );
      }
    }
    return { propsType, types: collected };
  } catch (e) {
    logger.warn(
      `Unable to resolve props type for ${typeResolver.checker.typeToString(
        type
      )}`,
      e
    );
  }
  return {
    propsType: UNKNOWN_TYPE,
    types: {},
  };
}
