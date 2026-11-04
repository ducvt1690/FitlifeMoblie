'use strict';
class HttpError extends Error {
  constructor(status, message) { super(message); this.name = 'HttpError'; this.httpStatus = status; }
}
module.exports = { HttpError };
