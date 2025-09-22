/* utils/helpers.js
   Common helpers for conversation keys, auth checks, pagination, and express async error handling
*/

const express = require('express');

function convKey(a, b) {
  return [a, b].sort().join('_');
}

function isAdmin(decoded) {
  return decoded && (decoded.role === 'admin' || decoded.admin === true);
}

function isEventHost(decoded) {
  return isAdmin(decoded) || (decoded && (decoded.role === 'event-host' || decoded.eventHost === true));
}

function isQuizHost(decoded) {
  return isAdmin(decoded) || (decoded && (decoded.role === 'quiz-host' || decoded.quizHost === true));
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function makeRouter() {
  const router = express.Router();
  router.use(express.json());
  return router;
}

module.exports = { convKey, isAdmin, isEventHost, isQuizHost, asyncHandler, chunk, makeRouter };
