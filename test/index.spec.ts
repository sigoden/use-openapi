/* eslint-disable @typescript-eslint/no-var-requires  */
import useApi from "../src";

const petstore = require("./spec/petstore.json");
const routes = useApi(petstore);

test("parsed route object", () => {
  const {
    method, operationId, path, security, xProps, validate,
  } = routes.find(v => v.operationId === "updatePet");
  expect({ method, operationId, path, security, xProps }).toEqual({
    method: "put",
    operationId: "updatePet",
    path: "/pet",
    security: [
      {
        "petstore_auth": [
          "write:pets",
          "read:pets",
        ],
      },
    ],
    xProps: {},
  });
  expect(validate(
    {
      body: {
        id: 10,
        name: "doggie",
        category: { 
          id: 1,
          name: "Dogs",
        },
        photoUrls: [
          "<url:img>",
        ],
        tags: [ 
          {
            id: 1,
            name: "dog",
          },
        ],
        status: "available", 
      },
    }
  )).toEqual(null);
});

test("validate query and params", () => {
  const route = routes.find(v => v.operationId === "updatePetWithForm");
  const errors1 = route.validate({
    query: {
      name: "Tim",
      status: "available",
    },
    params: {
      petId: "32",
    },
  });
  expect(errors1).toEqual(null);
  const errors2 = route.validate({
    query: {
      name: "Tim",
      status: "available",
    },
    params: {
      petId: "abc",
    },
  });
  expect(errors2).toEqual([
    {
      "keyword": "type",
      "dataPath": ".params.petId",
      "schemaPath": "#/properties/params/properties/petId/type",
      "params": {
        "type": "integer",
      },
      "message": "should be integer",
    },
  ]);
});


test("collect xprops", () => {
  const route = routes.find(v => v.operationId === "getInventory");
  expect(route.xProps).toEqual({ "x-swagger-router-controller": "OrderController" });
});

