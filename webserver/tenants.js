
/*
structure of tenants-array:
[
    { // tenant1

        consumerKey: ...,
        consumerToken: ...,
        ..., // oauth / twitter credentials
        users: [
            {
                id: 0,
                keywords: ['a', 'b', 'c']
            },
            {
                id: 1,
                keywords: ['x', 'y', 'z']
            }
        ]
    },
    { // tenant2
        ...
    }
]
*/

const tenants = [];

const clear = () => {
  tenants.length = 0;
};

const getId = tenant => tenant.consumerKey;

const deepCopy = obj => JSON.parse(JSON.stringify(obj));

const addTenant = (tenant) => {
  const tenantId = getId(tenant);
  let t = getTenant(tenantId);
  if (!t) {
    t = deepCopy(tenant);
    t.users = [];
    tenants.push(t);
  }
  return t;
};

const addUser = (tenantId, userId) => {
  const t = getTenant(tenantId);
  let u = getUser(tenantId, userId);
  if (t && !u) {
    u = { id: userId };
    u.keywords = new Set();
    t.users.push(u);
  }
  return u;
};

const getUser = (tenantId, userId) => {
  const t = getTenant(tenantId);
  if (t) {
    return t.users.find(u => u.id === userId);
  }
  return undefined;
};

const addKeyword = (tenant, userId, keyword) => {
  const tenantId = getId(tenant);
  const t = addTenant(tenant);
  const u = addUser(tenantId, userId);
  u.keywords.add(keyword);
};

const getKeywordsByUser = (tenantId, userId) => {
  const u = getUser(tenantId, userId);
  if (u) {
    return u.keywords;
  }
  return new Set();
};

const getKeywordsByTenant = (tenantId) => {
  const t = getTenant(tenantId);
  const keywords = new Set();
  if (t) {
    t.users.map(u => u.keywords).forEach((keywordSet) => {
      keywordSet.forEach(keyword => keywords.add(keyword));
    });
  }
  return keywords;
};

const removeKeyword = (tenantId, userId, keyword) => {
  const u = getUser(tenantId, userId);
  if (u) {
    u.keywords.delete(keyword);
  }
};

const removeUser = (tenantId, userId) => {
  const t = getTenant(tenantId);
  if (t) {
    const u = t.users.find(u => u.id === userId);
    if (u) {
      const index = t.users.indexOf(u);
      t.users.splice(index, 1);
    }
  }
};

const hasUsers = (tenantId) => {
  const t = getTenant(tenantId);
  if (t) {
    return t.users.length > 0;
  }
  return false;
};

const removeTenant = (tenantId) => {
  const t = getTenant(tenantId);
  if (t) {
    const index = tenants.indexOf(t);
    tenants.splice(index, 1);
  }
};

const getTenantIds = () => tenants.map(t => getId(t));

const getUserIds = (tenantId) => {
  const t = getTenant(tenantId);
  if (t) {
    return t.users.map(u => u.id);
  }
  return [];
};

const getTenant = tenantId => tenants.find(t => getId(t) === tenantId);

module.exports = {
  clear,
  getId,
  addKeyword,
  getKeywordsByUser,
  getKeywordsByTenant,
  removeKeyword,
  removeUser,
  hasUsers,
  removeTenant,
  getTenantIds,
  getUserIds,
  addTenant,
  getTenant,
  addUser,
  getUser,
};
