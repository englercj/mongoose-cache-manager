/**
 * This is the redis store that is used with cache-manager for storing in redis.
 */

var redis = require('redis'),
    noop = function () {};

function RedisStore(args) {
    args = args || {};

    // default ttl to use when one is not passed
    this.ttl = args.ttl;
    this.bucket = args.bucket;
    this.client = args.client || redis.createClient(args.port, args.host, args);

    if (options.password) {
        this.client.auth(options.password, function authCb(err) {
            if (err) throw err;
        });
    }
}

RedisStore.prototype.get = function get(key, cb) {
    cb = cb || noop;

    this.client.get(key, function (err, result) {
        if (err) return cb(err);
        cb(null, JSON.parse(result));
    });
};

RedisStore.prototype.set = function set(key, value, cb) {
    if (this.ttl) {
        this.client.setex(key, this.ttl, JSON.stringify(value), cb);
    } else {
        this.client.set(key, JSON.stringify(value), cb);
    }
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