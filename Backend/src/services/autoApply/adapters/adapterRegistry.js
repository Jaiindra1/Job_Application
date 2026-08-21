const { detectApplicationPlatform } = require('../platformDetector');
const adapters = [require('./greenhouseAdapter'), require('./leverAdapter'), require('./workdayAdapter'), require('./smartRecruitersAdapter'), require('./ashbyAdapter'), require('./icimsAdapter'), require('./darwinboxAdapter'), require('./successFactorsAdapter'), require('./adpAdapter')];

function getAdapter(value) {
  const platform = typeof value === 'string' ? detectApplicationPlatform(value) : value?.applicationPlatform || detectApplicationPlatform(value?.originalUrl);
  return adapters.find(adapter => adapter.platform === platform) || null;
}

module.exports = { getAdapter, adapters };
