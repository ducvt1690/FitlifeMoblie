'use strict';

async function transaction(db, action) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const session = db.client.startSession();
    try { return await session.withTransaction(() => action(session), { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } }); }
    catch (error) { if (error.code !== 11000 || attempt === 2) throw error; }
    finally { await session.endSession(); }
  }
}

module.exports = { transaction };
