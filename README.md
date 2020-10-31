# use-openapi

Generate routes from openapi object. 

The route will:
- mount to lots node.js web framework(e.g. express/koa/fastify)
- validate the request with schema generated from openapi

## Usage

### Express
```js
const app = express();
const useApi = require("use-openapi");
const spec = require("./openapi.json");
const routes = useApi(spec);

app.use(bodyParser.json());
routes.forEach(route => {
    /**
     * A exmpale route object
     *  {
     *      method: "put",
     *      operationId: "updatePet",
     *      path: "/pet",
     *      security: [
     *      {
     *          "petstore_auth": [
     *              "write:pets",
     *              "read:pets",
     *          ],
     *      },
     *      xProps: {
     *         "x-swagger-router-controller": "OrderController" ,
     *      },
     *  }
    */
    const middlewares = [];

    // apply security middleward

    const auth_config = route.security.find(v => v["petstore_auth"]);
    if (auth_config) middlewares.push(auth(auth_config))

    // mount route
    app[route.method](route.path, ...middlewares, (req, res, next) => {
        // validate with the schema generated by openapi
        const errors = route.validate(getValidateData(req));
        if (errors) {
            res.status(405).json({ errors });
        }
    })
})

function getValidateData(req) {
    const { headers, params, query, body } = req;
    return { headers, params, query, body };
}
```
