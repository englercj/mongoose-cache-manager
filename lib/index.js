var async = require('async'),
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
        port: 6379,
        password: ''
    },
    isMongoosePatched = false,
    cache;


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

    // if (defaultOptions.store === 'redis') {
    //     defaultOptions.store = redisStore;
    // }

    // export some values for testing
    mongooseCache._defaultOptions = defaultOptions;

    cache = redisStore.create(defaultOptions);

    // don't patch it again, just let the options/cache get updated
    if (isMongoosePatched) {
        return mongoose;
    }

    var proto = mongoose.Query.prototype,
        prefix = defaultOptions.prefix ? defaultOptions.prefix + ':' : '',
        emptyObj = {};

    /**
     * Patch the mongoose exec method
     */
    proto._exec = proto.exec;
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

        // if this is a exec'd write query pass it along and update the timestamp
        if (op === 'update' || op === 'remove') {
            this._touchCollection(this.model.collection.name);
            return proto._exec.apply(this, arguments);
        }

        // if we are not caching this query
        if (!cached) {
            return proto._exec.apply(this, arguments);
        }

        // generate the hash that will be used as the key
        var hash = crypto.createHash('md5')
                            .update(JSON.stringify(this._conditions || emptyObj))
                            .update(JSON.stringify(this._optionsForExec(this.model) || emptyObj))
                            .update(JSON.stringify(this._fields || emptyObj))
                            .update(JSON.stringify(populate))
                            .digest('hex'),

            // create the string keys for the cache
            collectionKey = prefix + this.model.collection.name,
            queryKey  = collectionKey + ':' + hash;

        cache.get(collectionKey, queryKey, function (err, collectionData, queryData) {
            //TODO: Should we treat a cache error as just a cache miss??
            if (err) return callback(err);

            // CACHE HIT CASE
            // if the key was found in cache, and the date check was also good
            // then just return this cache key directly to the user.
            if (queryData) {
                callback(null, queryData.docs);
            }
            // CACHE MISS CASE
            // if the query is not found in cache, or if the last write time that
            // the cached query results represent is before a more recent write, then
            // run the original Mongoose exec() function and cache the results.
            else {
                for (var k in populate) {
                    var path = populate[k];
                    path.options = path.options || {};
                    path.options.cache = path.options.cache || false;
                }

                // run the regular mongoose exec()
                proto._exec.call(self, function (err, docs) {
                    if (err) return callback(err);

                    // store the docs in the cache to get a hit next time
                    cache.setex(
                        queryKey,
                        ttl,
                        self._createQueryCacheData(docs, collectionData && collectionData.lastWrite)
                    );

                    // return the value to the user
                    callback(null, docs);
                });
            }
        });

        return this;
    };

    ['remove', 'save', 'update'].forEach(function (op) {
        proto['_' + op] = proto[op];
        proto[op] = function () {
            this._touchCollectionCheck.apply(this, arguments);

            return proto['_' + op].apply(this, arguments);
        };
    });

    /**
     * Set the cache/ttl settings for this query
     *
     * @method cache
     * @param ttl {Boolean|Number} The time to live for this query, `false` means do not cache
     * @return {Query} returns the query object
     */
    proto.cache = function (ttl) {
        this.options.cache = (ttl !== false);
        this.options.ttl = ttl;

        return this;
    };

    /**
     * Creates the cache data object that will be stored for a query
     *
     * @method _createQueryCacheData
     * @private
     * @param docs {Mixed} The mongoose document data to store
     * @param lastWrite {Number} The lastWrite value that was read from the collection cache
     * @return {String} The cache data to write to the store
     */
    proto._createQueryCacheData = function (docs, lastWrite) {
        return {
            metadata: {
                lastWrite: lastWrite || 0
            },
            docs: docs
        };
    };

    proto._touchCollection = function (name) {
        cache.set(prefix + name, {
            lastWrite: Date.now()
        });
    };

    proto._touchCollectionCheck = function () {
        var callback = arguments.length ? arguments[arguments.length - 1] : false;

        // mquery doesn't run the write unless there is a callback so unless
        // there is one here, we do not want to touch the collection data.
        if (callback) {
            this._touchCollection(this.model.collection.name);
        }
    };

    Object.defineProperty(proto, 'ttl', {
        get: function () {
            // we always check the most specific (query options) first and get
            // more and more general until we default to the global option.
            return this.options.ttl ||
                    this.model && this.model.schema.options.ttl ||
                    (this._mongooseOptions && this._mongooseOptions.ttl) ||
                    defaultOptions.ttl;
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
            }
            else if (this.model && this.model.schema.options.cache != null) {
                return this.model.schema.options.cache;
            }
            else if (this._mongooseOptions && this._mongooseOptions.cache != null) {
                return this._mongooseOptions.cache;
            }
            else {
                return defaultOptions.cache;
            }
        }
    });
    /* jshint ignore:end */

    isMongoosePatched = true;

    return mongoose;
};
