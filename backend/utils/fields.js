'use strict';
const { HttpError } = require('./http-error');
const { isUuid, isText } = require('./validate');

// Field rules shared by trainer/admin catalogs. Each rule returns the cleaned value or undefined when invalid.
const rules = {
  uuid: () => value => (isUuid(value) ? value : undefined),
  text: (max, min = 1) => value => (isText(value, max, min) ? value.trim() : undefined),
  // Optional free text: empty string is allowed.
  note: max => value => (typeof value === 'string' && [...value.trim()].length <= max ? value.trim() : undefined),
  int: (min, max) => value => (Number.isInteger(value) && value >= min && value <= max ? value : undefined),
  bool: () => value => (typeof value === 'boolean' ? value : undefined),
  oneOf: (...values) => value => (values.includes(value) ? value : undefined),
};

// Validate a request body against { key: [rule, message] }. With partial, every key is optional but at least one is required.
function readFields(body, spec, { partial = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Nội dung yêu cầu không hợp lệ.');
  const unknown = Object.keys(body).filter(key => !Object.hasOwn(spec, key));
  if (unknown.length) throw new HttpError(400, `Trường không được hỗ trợ: ${unknown.join(', ')}.`);
  const out = {};
  for (const [key, [rule, message]] of Object.entries(spec)) {
    if (body[key] === undefined) {
      if (!partial) throw new HttpError(400, message);
      continue;
    }
    const value = rule(body[key]);
    if (value === undefined) throw new HttpError(400, message);
    out[key] = value;
  }
  if (partial && !Object.keys(out).length) throw new HttpError(400, 'Không có thay đổi nào.');
  return out;
}

const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const readPage = value => {
  const page = value === undefined ? 1 : Number(value);
  if (!Number.isInteger(page) || page < 1 || page > 10000) throw new HttpError(400, 'page phải là số nguyên dương.');
  return page;
};

module.exports = { rules, readFields, escapeRegex, readPage };
