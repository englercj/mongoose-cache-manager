var expect = require('chai').expect,
    redisStore = require('../../lib/store/redisStore'),
    mongooseCache = require('../../lib/index'),
    mongoose;

describe('MongooseCache', function () {
    before(function () {
        // clear the loaded mongoose files from the require cache
        Object
            .keys(require.cache)
            .filter(function (v) {
                return v.indexOf('mongoose') !== -1;
            })
            .forEach(function (key) {
                delete require.cache[key];
            });

        mongoose = require('mongoose');
    });

    it('should export a function', function () {
        expect(mongooseCache).to.be.a('function');
    });

    it('should add the proper methods to mongoose', function () {
        mongooseCache(mongoose);

        expect(mongoose.Query.prototype.cache).to.be.a('function');
        expect(mongoose.Query.prototype.ttl).to.be.an('number');
        expect(mongoose.Query.prototype.cached).to.be.a('boolean');
    });

    it('should have the default values set for options', function () {
        mongooseCache(mongoose);

        expect(mongooseCache._defaultOptions.cache).to.equal(true);
        expect(mongooseCache._defaultOptions.ttl).to.equal(60);
        expect(mongooseCache._defaultOptions.store).to.equal('memory');
        expect(mongooseCache._defaultOptions.prefix).to.equal('cache');

        expect(mongooseCache._defaultOptions.host).to.equal('127.0.0.1');
        expect(mongooseCache._defaultOptions.port).to.equal(6379);
        expect(mongooseCache._defaultOptions.password).to.equal('');
    });

    it('should properly override default values for options', function () {
        mongooseCache(mongoose, {
            cache: false,
            ttl: 30,
            store: 'redis',
            prefix: 'herp',

            //redis settings
            host: '10.11.12.13',
            port: 11407,
            password: 'something'
        });

        expect(mongooseCache._defaultOptions.cache).to.equal(false);
        expect(mongooseCache._defaultOptions.ttl).to.equal(30);
        expect(mongooseCache._defaultOptions.store).to.equal(redisStore);
        expect(mongooseCache._defaultOptions.prefix).to.equal('herp');

        expect(mongooseCache._defaultOptions.host).to.equal('10.11.12.13');
        expect(mongooseCache._defaultOptions.port).to.equal(11407);
        expect(mongooseCache._defaultOptions.password).to.equal('something');
    });
});
