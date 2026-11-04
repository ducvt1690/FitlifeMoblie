'use strict';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const isUuid = value => typeof value === 'string' && UUID.test(value);
const isDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const isText = (value, max, min = 1) => typeof value === 'string'
  && value.trim().length >= min && [...value.trim()].length <= max;
const isPlainBody = (body, allowed) => !!body && typeof body === 'object' && !Array.isArray(body)
  && Object.keys(body).every(key => allowed.includes(key));
// Shift a YYYY-MM-DD business day by whole days without timezone drift.
const addDays = (day, delta) => new Date(Date.parse(`${day}T00:00:00Z`) + delta * 86400000).toISOString().slice(0, 10);
module.exports = { UUID, isUuid, isDate, isText, isPlainBody, addDays };
