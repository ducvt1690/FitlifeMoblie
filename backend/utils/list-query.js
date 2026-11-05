'use strict';
const { HttpError } = require('./http-error');
const { escapeRegex, readPage } = require('./fields');
const { isDate } = require('./validate');
const fail = message => new HttpError(400, message);
function listQuery(query = {}, sorts = ['created_at', 'title', 'assigned_at', 'full_name']) {
  for (const key of ['page', 'page_size']) if (query[key] !== undefined && !['string', 'number'].includes(typeof query[key])) throw fail(`${key} phải là số nguyên.`);
  const page = readPage(query.page);
  const page_size = query.page_size === undefined ? 20 : Number(query.page_size);
  if (!Number.isInteger(page_size) || page_size < 1 || page_size > 100) throw fail('page_size phải từ 1 đến 100.');
  if (query.q !== undefined && (typeof query.q !== 'string' || query.q.length > 100)) throw fail('Từ khóa tối đa 100 ký tự.');
  const aliases = { newest: `-${sorts[0]}`, oldest: sorts[0], name: sorts.includes('full_name') ? 'full_name' : 'title' };
  const sort = query.sort ? (aliases[query.sort] || query.sort) : `-${sorts[0]}`;
  if (typeof sort !== 'string' || !sorts.includes(sort.replace(/^-/, ''))) throw fail('sort không hợp lệ.');
  return { page, page_size, skip: (page - 1) * page_size,
    sort: { [sort.replace(/^-/, '')]: sort.startsWith('-') ? -1 : 1, _id: 1 },
    regex: query.q?.trim() ? { $regex: escapeRegex(query.q.trim()), $options: 'i' } : null };
}
function dates(query, field) {
  const range = {};
  for (const key of ['from', 'to']) {
    if (query[key] === undefined || query[key] === '') continue;
    if (typeof query[key] !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(query[key])
      || !isDate(query[key].slice(0, 10)) || !Number.isFinite(Date.parse(query[key]))) throw fail(`${key} phải là ngày ISO hợp lệ, timestamp cần múi giờ.`);
    const value = new Date(query[key]);
    if (query[key].length === 10 && value.toISOString().slice(0, 10) !== query[key]) throw fail(`${key} không hợp lệ.`);
    if (key === 'to' && query[key].length === 10) value.setUTCHours(23, 59, 59, 999);
    range[key === 'from' ? '$gte' : '$lte'] = value;
  }
  if (range.$gte && range.$lte && range.$gte > range.$lte) throw fail('from phải trước to.');
  return Object.keys(range).length ? { [field]: range } : {};
}
async function pageRows(collection, key, filter, query = {}, sorts, extra = {}) {
  const p = listQuery(query, sorts);
  const [rows, total] = await Promise.all([
    collection.find(filter, { projection: { _id: 0 }, ...extra }).sort(p.sort).skip(p.skip).limit(p.page_size).toArray(),
    collection.countDocuments(filter),
  ]);
  return { success: true, [key]: rows, page: p.page, page_size: p.page_size, total };
}
module.exports = { listQuery, dates, pageRows };
