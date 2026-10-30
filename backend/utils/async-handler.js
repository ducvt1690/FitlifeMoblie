'use strict';
const asyncHandler = handler => (req, res, next) => Promise.resolve().then(() => handler(req, res)).catch(next);
module.exports = { asyncHandler };
