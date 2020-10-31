import Decimal from "decimal.js";

const RANGES = {
  byte: {
    min: new Decimal("-128"),
    max: new Decimal("127"),
  },

  int32: {
    min: new Decimal("-2147483648"),
    max: new Decimal("2147483647"),
  },

  int64: {
    min: new Decimal("-9223372036854775808"),
    max: new Decimal("9223372036854775807"),
  },

  float: {
    min: new Decimal(2).pow(128).negated(),
    max: new Decimal(2).pow(128),
  },

  double: {
    min: new Decimal(2).pow(1024).negated(),
    max: new Decimal(2).pow(1024),
  },
};

function int32(data) {
  return (
    Number.isInteger(+data) && RANGES.int32.max.greaterThanOrEqualTo(data) && RANGES.int32.min.lessThanOrEqualTo(data)
  );
}

function int64(data) {
  return (
    Number.isInteger(+data) && RANGES.int64.max.greaterThanOrEqualTo(data) && RANGES.int64.min.lessThanOrEqualTo(data)
  );
}

function float(data) {
  return RANGES.float.max.greaterThanOrEqualTo(data) && RANGES.float.min.lessThanOrEqualTo(data);
}

function double(data) {
  return RANGES.double.max.greaterThanOrEqualTo(data) && RANGES.double.min.lessThanOrEqualTo(data);
}

function byte(data) {
  /* eslint-disable no-useless-escape */
  const notBase64 = /[^A-Z0-9+\/=]/i;
  /* eslint-enable no-useless-escape */

  const len = data.length;
  if (!len || len % 4 !== 0 || notBase64.test(data)) {
    return false;
  }
  const firstPaddingChar = data.indexOf("=");
  return (
    firstPaddingChar === -1 || firstPaddingChar === len - 1 || (firstPaddingChar === len - 2 && data[len - 1] === "=")
  );
}

export default {
  int32: {
    type: "number",
    validate: int32,
  },
  int64: {
    type: "number",
    validate: int64,
  },
  float: {
    type: "number",
    validate: float,
  },
  double: {
    type: "number",
    validate: double,
  },
  byte: {
    type: "byte",
    validate: byte,
  },
};

