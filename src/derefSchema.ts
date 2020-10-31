import * as lodashGet from "lodash.get";
import * as traverse from "traverse";
import * as clone from "clone";
import DAG from "dag-map";

/**
 * Derefs $ref types in a schema
 */
function derefSchema(spec, options: Options = {}) {
  const state = {
    graph: new DAG(),
    circular: false,
    circularRefs: [],
    error: null,
    missing: [],
    history: [],
  };

  const schema = clone(spec);
  const isCircular = checkLocalCircular(schema);
  if (isCircular instanceof Error) {
    throw isCircular;
  }

  const check = () => {
    if (state.circular) {
      throw new Error(`circular references found: ${state.circularRefs.toString()}`);
    } else if (state.error) {
      throw state.error;
    }
  };

  check();

  traverse(schema).forEach(function (node) {
    const self = this; // eslint-disable-line

    if (node == null || typeof node === "undefined") {
      return;
    }

    if (typeof node.$ref !== "string") {
      return;
    }

    const refVal = getRefValue(node);

    const addOk = addToHistory(state, refVal);
    if (!addOk) {
      state.circular = true;
      state.circularRefs.push(refVal);
      return;
    }


    let newValue = getRefPathValue(schema, refVal);

    check();

    state.history.pop();

    if (typeof newValue === "undefined") {
      if (state.missing.indexOf(refVal) === -1) {
        state.missing.push(refVal);
      }
      if (options.failOnMiss) {
        state.error = new Error(`Missing $ref: ${refVal}`);
        return check();
      }
      return check();
    }

    let obj;

    if (self.parent && self.parent.node && self.parent.node[self.key]) {
      obj = self.parent.node;
    } else if (self.node && self.node[self.key]) {
      obj = self.node;
    }

    if (obj && typeof newValue !== "undefined") {
      if (options.mergeAdditionalProperties) {
        delete node.$ref;
        newValue = Object.assign({}, newValue, node);
      }

      if (options.removeIds && newValue.hasOwnProperty("$id")) {
        delete newValue.$id;
      }

      obj[self.key] = newValue;

      if (state.missing.indexOf(refVal) !== -1) {
        state.missing.splice(state.missing.indexOf(refVal), 1);
      }
    } else if (self.isRoot && typeof newValue !== "undefined") {
      // special case of root schema being replaced
      state.history.pop();
      if (state.missing.indexOf(refVal) === -1) {
        state.missing.push(refVal);
      }
    }
  });

  return schema;
}

export interface Options {
  /*
   * By default missing / unresolved refs will be left as is with their ref value intact.
   * If set to <code>true</code> we will error out on first missing ref that we cannot
   * resolve. Default: <code>false</code>.
   */
  failOnMiss?: boolean;

  /* By default properties in a object with $ref will be removed in the output.
   * If set to <code>true</code> they will be added/overwrite the output.
   * Default: <code>false</code>
   */
  mergeAdditionalProperties?: boolean;

  /* By default <code>$id</code> fields will get copied when dereferencing.
   * If set to <code>true</code> they will be removed.
   * Default: <code>false</code>.
   */
  removeIds?: boolean;
}


export default derefSchema;


/**
 * Add to state history
 * @param {String} type ref type
 * @param {String} value ref value
 * @private
 */
function addToHistory(state, value) {

  if (value === "#") {
    return false;
  }
  const dest = value.toLowerCase();
  if (state.history.indexOf(dest) >= 0) {
    return false;
  }

  state.history.push(dest);
  return true;
}


/**
 * Check the schema for local circular refs using DAG
 * @param {Object} schema the schema
 * @return {Error|undefined} <code>Error</code> if circular ref, <code>undefined</code> otherwise if OK
 * @private
 */
function checkLocalCircular(schema) {
  const dag = new DAG();
  const locals = traverse(schema).reduce(function (acc, node) {
    if (node !== null && typeof node !== "undefined" && typeof node.$ref === "string") {
      const value = getRefValue(node);
      if (value) {
        const path = this.path.join("/");
        acc.push({
          from: path,
          to: value,
        });
      }
    }
    return acc;
  }, []);

  if (!locals || !locals.length) {
    return;
  }

  if (locals.some(elem => elem.to === "#")) {
    return new Error("Circular self reference");
  }

  const check = locals.find(elem => {
    const from = elem.from.concat("/");
    const dest = elem.to.substring(2).concat("/");
    try {
      dag.add(from, dest);
    } catch (err) {
      return elem;
    }

    if (from.indexOf(dest) === 0) {
      return elem;
    }
  });

  if (check) {
    return new Error(`Circular self reference from ${check.from} to ${check.to}`);
  }
}


/**
 * Gets the ref value of a search result from prop-search or ref object
 * @param ref The search result object from prop-search
 * @returns {*} The value of $ref or undefined if not present in search object
 * @private
 */
function getRefValue(ref) {
  const thing = ref ? (ref.value ? ref.value : ref) : null;
  if (thing && thing.$ref && typeof thing.$ref === "string") {
    return thing.$ref;
  }
}

/**
 * Gets the value at the ref path within schema
 * @param schema the (root) json schema to search
 * @param refPath string ref path to get within the schema. Ex. `#/definitions/id`
 * @returns {*} Returns the value at the path location or undefined if not found within the given schema
 * @private
 */
function getRefPathValue(schema, refPath) {
  let rpath = refPath;
  const hashIndex = refPath.indexOf("#");
  if (hashIndex >= 0) {
    rpath = refPath.substring(hashIndex);
    if (rpath.length > 1) {
      rpath = refPath.substring(1);
    } else {
      rpath = "";
    }
  }

  if (rpath.charAt(0) === "/") {
    rpath = rpath.substring(1);
  }

  if (rpath.indexOf("/") >= 0) {
    rpath = rpath.replace(/\//gi, ".");
  }

  if (rpath) {
    return lodashGet(schema, rpath);
  }
  return schema;
}

