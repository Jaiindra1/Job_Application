const ApplicationEvent = require('../../models/ApplicationEvent');

async function createAutoApplyEvent(applicationId, type, title, dedupeKey, metadata = {}) {
  try {
    return await ApplicationEvent.create({ applicationId, type, title, source: 'auto_apply', timestamp: new Date(), dedupeKey, metadata });
  } catch (error) {
    if (error.code === 11000) return ApplicationEvent.findOne({ applicationId, dedupeKey });
    throw error;
  }
}
module.exports = { createAutoApplyEvent };
