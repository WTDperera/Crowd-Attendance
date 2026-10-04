const { db } = require('../firebaseAdmin');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function moduleId(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 128 || value.includes('/')) {
    throw new HttpError(400, 'A valid moduleId is required.');
  }
  return value.trim().toUpperCase();
}

async function findModule(value) {
  const id = moduleId(value);
  const direct = await db.doc(`modules/${id}`).get();
  if (direct.exists) return direct;
  const aliases = await db.collection('modules').where('module_id', '==', id).limit(2).get();
  if (aliases.size > 1) throw new HttpError(409, 'Module identity is ambiguous.');
  if (aliases.empty) throw new HttpError(404, 'Module not found.');
  return aliases.docs[0];
}

const respondError = (res, error) => res.status(error.status || 500).json({
  message: error.status ? error.message : 'Unable to complete this operation right now.',
});

function requireModuleOwner(select) {
  return async (req, res, next) => {
    try {
      const module = await findModule(select(req));
      if (module.get('lecturer_id') !== req.user.uid) throw new HttpError(403, 'Module owner access required.');
      req.moduleDoc = module;
      next();
    } catch (error) { respondError(res, error); }
  };
}

async function requireSessionOwner(req, res, next) {
  try {
    const session = await db.doc(`active_sessions/${req.params.sessionId}`).get();
    if (!session.exists) throw new HttpError(404, 'Session not found.');
    if (session.get('lecturer_id') !== req.user.uid) throw new HttpError(403, 'Session owner access required.');
    const module = await findModule(session.get('module_id') || session.get('module_code'));
    if (module.get('lecturer_id') !== req.user.uid) throw new HttpError(403, 'Module owner access required.');
    req.moduleDoc = module; req.sessionDoc = session;
    next();
  } catch (error) { respondError(res, error); }
}

module.exports = { HttpError, moduleId, findModule, respondError, requireModuleOwner, requireSessionOwner };
