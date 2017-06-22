const ts = require('./stream/tweetstream');
const rc = require('./redis/redis-commands');
const Joi = require('joi');
const _ = require('lodash');



const tenantSchema = Joi.object().keys({
  consumerKey: Joi.string().required(),
  token: Joi.string().required(),
  consumerSecret: Joi.string().required(),
  tokenSecret: Joi.string().required()
});

const isTenantSchemaValid = (tenant) => {
  return !Joi.validate(tenant, tenantSchema).error;
};

const areCredentialsValid = (tenant) => new Promise((resolve) => {
  if (!isTenantSchemaValid(tenant)) {
    resolve(false);
  } else {
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
  }
});

module.exports = {
  areCredentialsValid,
  isTenantSchemaValid,
  tenantSchema
};