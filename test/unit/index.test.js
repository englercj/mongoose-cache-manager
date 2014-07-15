var expect = require('chai').expect,
    mongooseCache = require('../../lib/index.js');

describe('MongooseCache', function () {
    it('should export a function', function () {
        expect(mongooseCache).to.be.a('function');
    });
});
