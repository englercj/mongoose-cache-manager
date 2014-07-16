var cacheManager = require('cache-manager'),
    redisStore = require('./store/redisStore'),
    crypto   = require('crypto');

// This make regexp serialize properly in queries with regular expressions
RegExp.prototype.toJSON = RegExp.prototype.toJSON || function () {
    var obj = {
            $regexp: this.source
        },
        str = this.toString(),
        opts = str.substring(str.lastIndexOf('/') + 1);

    if (opts.length) {
        obj.$options = opts;
    }

    return obj;
};

var defaultOptions = {
        cache: true,
        ttl: 60,
        store: 'memory',
        prefix: 'cache',

        //redis settings
        host: '127.0.0.1',
        port: 11406,
        password: ''
    },
    isMongoosePatched = false;


module.exports = function mongooseCache(mongoose, options, cb) {
    // 'options' is an optional param
    if (typeof options === 'function') {
        cb = options;
        options = null;
    }

    // setup the default options
    options = options || {};
    for (var k in defaultOptions) {
        defaultOptions[k] = options[k] !== undefined ? options[k] : defaultOptions[k];
    }

    if (defaultOptions.store === 'redis') {
        defaultOptions.store = redisStore;
    }

    // don't patch it again, just let the options get updated
    if (isMongoosePatched) {
        return mongoose;
    }

    var cache = cacheManager.caching(options),
        proto = mongoose.Query.prototype,
        prefix = defaultOptions.prefix ? defaultOptions.prefix + ':' : '',
        emptyObj = {};

    /**
     * Patch the mongoose exec method
     */
    proto._exec = mongoose.Query.prototype.exec;
    proto.exec = function (op, callback) {
        if (typeof op === 'function') {
            callback = op;
            op = null;
        }

        var self = this,
            populate = this.options.populate || emptyObj,
            cached = this.cached,
            ttl = this.ttl;

        // remove our temp options
        delete this._mongooseOptions.cache;
        delete this._mongooseOptions.ttl;

        if (!cached) {
            return proto.apply(self, arguments);
        }

        // generate the hash that will be used as the key
        var hash = crypto.createHash('md5')
                            .update(JSON.stringify(this._conditions || emptyObj))
                            .update(JSON.stringify(this._optionsForExec(this.model) || emptyObj))
                            .update(JSON.stringify(this._fields || emptyObj))
                            .update(JSON.stringify(populate))
                            .digest('hex'),

            // create the string key for the cache
            key  = prefix + this.model.collection.name + ':' + hash;

        // Try to get the key from the cache
        cache.get(key, function (err, result) {
            if (err) return callback(err);

            // if the key is not found in cache, run the original Mongoose
            // exec() function and cache the results.
            if (!result) {
                for (var k in populate) {
                    var path = populate[k];
                    path.options = path.options || {};
                    path.options.cache = path.options.cache || false;
                }

                // run the regular mongoose exec()
                proto._exec.call(self, function (err, docs) {
                    if (err) return callback(err);

                    // store the key in the cache
                    cache.set(key, ttl, JSON.stringify(docs));

                    callback(null, docs);
                });
            }
            //if the key was found in cache, return it to the user
            else {
                callback(null, JSON.parse(result));
            }
        });

        return this;
    };

    /**
     * Set the cache/ttl settings for this query
     *
     * @param {Boolean} cached
     * @param {Number} ttl
     * @return {Query} this
     * @api public
     */
    proto.cache = function (ttl) {
        this.options.cache = (ttl !== false);
        this.options.ttl = ttl;

        return this;
    };

    Object.defineProperty(proto, 'ttl', {
        get: function () {
            // we always check the most specific (query options) first and get
            // more and more general until we default to the global option.
            return this.options.ttl || this.model.schema.options.ttl || this._mongooseOptions.ttl || defaultOptions.ttl;
        }
    });

    /* jshint ignore:start */
    Object.defineProperty(proto, 'cached', {
        get: function () {
            // if a value is null || undefined skip it and check the next.
            // we always check the most specific (query options) first and get
            // more and more general until we default to the global option.
            if (this.options.cache != null) {
                return this.options.cache;
            } else if (this.model.schema.options.cache != null) {
                return this.model.schema.options.cache;
            } else if (this._mongooseOptions.cache != null) {
                return this._mongooseOptions.cache;
            } else {
                return defaultOptions.cache;
            }
        }
    });
    /* jshint ignore:end */

    isMongoosePatched = true;

    return mongoose;
};
