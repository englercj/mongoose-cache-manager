/**
 * This is the redis store that is used with cache-manager for storing in redis.
 */

var redis = require('redis'),
    fs = require('fs'),
    path = require('path'),
    readScript = fs.readFileSync(path.join(__dirname, 'redis/read.lua')).toString('utf8'),
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

RedisStore.prototype.get = function get(collectionKey, queryKey, cb) {
    cb = cb || noop;

    /*this.client.eval(readScript, 2, queryKey, collectionKey, function (err, results) {
        if (err) return cb(err);

        if (results) {
            cb(null, results[0] && JSON.parse(results[0]), results[1] && JSON.parse(results[1]));
        }
        else {
            cb();
        }
    });*/
    this.client.multi().get(collectionKey).get(queryKey).exec(function (err, results) {
        if (err) return cb(err);

        var collectionData = results[0] && JSON.parse(results[0]),
            queryData = results[1] && JSON.parse(results[1]);

        // special cache miss where it is out of date
        if (queryData && collectionData && collectionData.lastWrite > queryData.metadata.lastWrite) {
            queryData = null;
        }

        cb(null, collectionData, queryData);
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
