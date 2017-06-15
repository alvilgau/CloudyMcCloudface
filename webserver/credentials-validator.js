const ts = require('./stream/tweetstream');
const rc = require('./redis/redis-commands');
const _ = require('lodash');

const areCredentialsValid = (tenant) => new Promise((resolve) => {
  const id = rc.getId(tenant);
  rc.getTenant(id)
    .then(redisTenant => {
      if (_.isEqual(redisTenant, tenant)) {
        // tenant is already in redis -> credentials must be valid
        resolve(true);
      } else {
        // tenant id is in redis but tenants are not equal -> create a stream and check twitter response
        ts.checkTenantCredentials(tenant).then(resolve);
      }
    })
    .catch(err => {
      // tenant is not in redis -> create a stream and check twitter response
      ts.checkTenantCredentials(tenant).then(resolve);
    });
});

module.exports = {
  areCredentialsValid
};