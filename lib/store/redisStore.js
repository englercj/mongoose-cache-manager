/**
 * This is the redis store that is used with cache-manager for storing in redis.
 */

var redis = require('redis'),
    noop = function () {};

function RedisStore(args) {
    args = args || {};

    // name of this store
    this.name = 'redis';

    // the instance of the redis client to use
    this.client = args.client || redis.createClient(args.port, args.host, args);

    // make sure to auth if we need to
    if (args.password) {
        this.client.auth(args.password, function authCb(err) {
            if (err) throw err;
        });
    }
}

RedisStore.prototype.get = function get(key, cb) {
    cb = cb || noop;

    this.client.get(key, function getCallback(err, result) {
        if (err) return cb(err);
        cb(null, JSON.parse(result));
    });
};

RedisStore.prototype.set = function set(key, value, cb) {
    this.client.set(key, JSON.stringify(value), cb);
};

RedisStore.prototype.del = function del(key, cb) {
    this.client.del(key, cb);
};

RedisStore.prototype.setex = function setex(key, ttl, value, cb) {
    this.client.setex(key, ttl, JSON.stringify(value), cb);
};

// RedisStore.prototype.reset = function reset(key, cb) {
// };

RedisStore.prototype.keys = function keys(pattern, cb) {
    if (typeof pattern === 'function') {
        cb = pattern;
        pattern = '*';
    }

    this.client.keys(pattern, cb);
};

module.exports = {
    create: function (args) {
        return new RedisStore(args);
    }
};
