import { OpenAPIV3 } from "openapi-types";
import * as Ajv from "ajv";
import * as lodashMerge from "lodash.merge";
import * as lodashGet from "lodash.get";
import ajvFormats from "./ajvFormats";
import derefSchema from "./derefSchema";

const METHODS = ["get", "put", "delete", "post", "options"];
const PARAMETER_MAP = { header: "headers", query: "query", path: "params" };

/**
 * 
 * @param spec Openapi spec3 object
 * @param ajvOptions  Ajv options see https://ajv.js.org/#options
 */
function useApp(spec: OpenAPIV3.Document, ajvOptions: Ajv.Options = {}): Route[] {
  spec = derefSchema(spec);
  ajvOptions = lodashMerge({
    unknownFormats: "ignore",
    useDefaults: true,
    coerceTypes: true,
    formats: ajvFormats,
  }, ajvOptions);
  const ajv = new Ajv(ajvOptions);
  const routes: Route[] = [];
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const method of METHODS) {
      const operation = pathItem[method] as OpenAPIV3.OperationObject;
      if (!operation) continue;
      const xProps = Object.keys(operation).filter(key => key.startsWith("x-") || key.startsWith("x")).reduce((a, c) => {
        a[c] = operation[c];
        return a;
      }, {});
      if (!operation.operationId) {
        throw new Error(`endpoint ${method.toUpperCase()} ${path} miss operationId`);
      }
      const endpointSchema = createDefaultSchema() ;
      const addParamaterSchema = (key, obj: OpenAPIV3.ParameterObject) => {
        const dataKey = PARAMETER_MAP[key];
        if (!dataKey) return;
        let data = endpointSchema.properties[dataKey];
        if (!data) {
          data = endpointSchema.properties[dataKey] = createDefaultSchema();
        }
        data.properties[obj.name] = obj.schema;
        if (obj.required) data.required.push(obj.name);
      };
      if (Array.isArray(operation.parameters)) {
        for (const parameter of operation.parameters as any) {
          addParamaterSchema(parameter.in, parameter);
        }
      }
      const bodySchema = lodashGet(operation, ["requestBody", "content", "application/json", "schema"]);
      if (bodySchema) {
        endpointSchema.properties["body"] = bodySchema;
      }

      const validate = ajv.compile(endpointSchema);

      routes.push({
        path: path.replace(/{([^}]+)}/g, ":$1").replace(/\/$/, ""),
        method,
        security: operation.security,
        operationId: operation.operationId,
        xProps,
        validate: data => {
          const isValid = validate(data);
          return { isValid: !!isValid, errors:  validate.errors };
        },
      });
    }
  }
  return routes;
}

function createDefaultSchema() {
  return { type: "object", properties: {}, required: [] };
}

export enum Method {
  Get = "get",
  Put = "put",
  Delete = "delete",
  Post = "post",
  Patch = "patch",
}

export interface Route {
  path: string;
  method: string;
  operationId?: string;
  security: OpenAPIV3.SecurityRequirementObject[];
  xProps: {[k: string]: any};
  validate: ValidateFn;
}
export type ValidateFn = (data: ValidateData) => { isValid: boolean; errors: Ajv.ErrorObject[] };

export interface ValidateData {
  headers?: {[k: string]: any};
  params?: {[k: string]: any};
  query?: {[k: string]: any};
  body?: any;
}

export { useApp };
export default useApp;