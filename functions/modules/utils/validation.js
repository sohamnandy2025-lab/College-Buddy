/* utils/validation.js
   Simple validators and sanitizers to protect endpoints
*/

const { Reactions, Visibility } = require('./constants');

function requireFields(obj, fields) {
  for (const f of fields) {
    if (obj[f] === undefined) throw new Error(`Missing field: ${f}`);
  }
}

function assertReaction(type) {
  if (!Reactions.includes(type)) throw new Error('Invalid reaction type');
}

function assertVisibility(v) {
  if (!Visibility.includes(v)) throw new Error('Invalid visibility');
}

function nonEmptyString(x, fieldName) {
  if (typeof x !== 'string' || !x.trim()) throw new Error(`${fieldName} must be a non-empty string`);
}

function safeArray(a) {
  return Array.isArray(a) ? a : [];
}

module.exports = {
  requireFields,
  assertReaction,
  assertVisibility,
  nonEmptyString,
  safeArray
};
