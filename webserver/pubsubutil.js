

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

const getId = (tenant) => {
    return tenant.consumerKey;
};

const addKeyword = (tenant, userId, keyword) => {
    const tenantId = getId(tenant);
    let t = tenants.find(t => getId(t) === tenantId);
    if (!t) {
        t = tenant;
        t.users = [];
        tenants.push(t);
    }
    let u = t.users.find(u => u.id === userId);
    if (!u) {
        u = {id: userId};
        u.keywords = new Set();
        t.users.push(u);
    }
    u.keywords.add(keyword);
};

const getKeywordsByUser = (tenant, userId) => {
    const tenantId = getId(tenant);
    const t = tenants.find(t => getId(t) === tenantId);
    if (t && t.users) {
        const u = t.users.find(u => u.id === userId);
        if (u && u.keywords) {
            return u.keywords;
        }
    }
    return new Set();
}

const getKeywordsByTenant = (tenant) => {
    const tenantId = getId(tenant);
    const t = tenants.find(t => getId(t) === tenantId);
    const keywords = new Set();
    if (t && t.users) {
        t.users.map(u => u.keywords).forEach(keywordSet => {
            keywordSet.forEach(keyword => keywords.add(keyword));
        });        
    }
    return keywords;
}

const removeKeyword = (tenant, userId, keyword) => {
    const tenantId = getId(tenant);
    const t = tenants.find(t => getId(t) === tenantId);
    if (t && t.users) {
        const u = t.users.find(u => u.id === userId);
        if (u && u.keywords) {
            u.keywords.delete(keyword);            
        }
    }    
};

const removeUser = (tenant, userId) => {
    const tenantId = getId(tenant);
    const t = tenants.find(t => getId(t) === tenantId);
    if (t && t.users) {
        const u = t.users.find(u => u.id === userId);
        if (u) {
            const index = t.users.indexOf(u);
            t.users.splice(index, 1);
        }
    }
};

const hasUsers = (tenant) => {
    const tenantId = getId(tenant);
    const t = tenants.find(t => getId(t) === tenantId);
    if (t && t.users) {
        return t.users.length > 0;
    }
    return false;
}

const removeTenant = (tenant) => {
    const tenantId = getId(tenant);
    const t = tenants.find(t => getId(t) === tenantId);
    if (t) {
        const index = tenants.indexOf(t);
        tenants.splice(index, 1);
    }
};

const getTenantIds = () => {
    return tenants.map(t => getId(t));
};

const getUserIds = (tenantId) => {
    const t = tenants.find(t => getId(t) === tenantId);
    if (t && t.users) {
        return t.users.map(u => u.id);
    }
    return [];
};


const pubsubutil = {
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
    getUserIds
};

module.exports = pubsubutil;