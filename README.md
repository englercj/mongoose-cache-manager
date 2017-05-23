# Mongoose Cache Manager

This module caches [mongoose][1] queries with [cache-manager][2] using an in-memory or Redis store. The module
was originally based on [mongoose-redis-cache][3], but was change to allow for a generic caching store and to
add timestamp checking to prevent serving of stale data.

Like many ODM cache solutions, the cache can only be kept fresh if this module is used for both reads *and writes*.
When something writes directly to MongoDB without using mongoose, there is no way for this module to know it needs
to reload fresh data into the cache.

In the future I want to try to improve this cache layer by using entity-based caching instead of only query caching.

[1]: http://http://mongoosejs.com/
[2]: https://github.com/BryanDonovan/node-cache-manager
[3]: https://github.com/conancat/mongoose-redis-cache

## Installation

``` bash
$ npm install englercj/mongoose-cache-manager --save
```

## Usage

``` javascript
var mongoose = require('mongoose'),
    mongooseCache = require('mongoose-cache-manager');

// patch mongoose with default options
mongooseCache(mongoose, {
    cache : true,
    ttl   : 60,
    store: 'memory',
    prefix: 'cache'
});

// above is equivalent to:
mongooseCache(mongoose);
```

Then later any `find` query will be cached for 60 seconds.

You can also enable/disable caching programatically by using the `cache` method directly from the query instance:

``` javascript
var User = mongoose.model('User');

User
    .find()
    .cache(false) // do not cache this query
    .exec(function (err, docs) {
        if (err) throw error;

        console.log(docs.ttl); // time left for expiration in ms
        console.log(docs.stored); // timestamp this query was cached
        console.log(docs);
    });
```

See the API section for more details on what the cache method can do.

## API

This plugin will add an extra method to a mongoose query instance: `cache`.

### query.cache([ttl])

The `ttl` parameter is optional, and can be used to specify the cache expiration (time to live).

If you have caching off by default (`mongooseCache(mongoose, { cache: false });`), you can enable caching on
a specific query by calling the `cache` method:

``` javascript
User
    .find()
    .cache() // will enable caching with the default 60 seconds ttl
    .exec(/* ... */);
```

You can also explicitly pass `false` to disable caching for a specific query:

``` javascript
User
    .find()
    .cache(false) // will disable caching on this query
    .exec(/* ... */);
});
```

You can also specify the `ttl` (time to live) value directly, which will enable caching for this query
with a custom ttl:

``` javascript
User
    .find()
    .cache(10) // will enable caching with a 10 second ttl
    .exec(/* ... */);
```

## Redis

By default `mongoose-cache-manager` will use the memory store to cache queries but it can also cache queries using
[Redis][20] by specifying redis store when initializing the plugin:

``` javascript
var mongoose = require('mongoose'),
    mongooseCache = require('mongoose-cache-manager');

// patch mongoose with redis for caching
// this will cache queries in redis with the default TTL of 60 seconds
mongooseCachebox(mongoose, {
    store: 'redis',
    host: '127.0.0.1',
    port: '6379',
    password: 'secret'
});
```

[20]: http://redis.io/

## Run tests

Tests are written in [Mocha][30]'s BDD style, using [Chai][31] for assertions. [Gulp][32] is used for task running.
You can run the tests with:

``` bash
$ npm install
$ npm test
```

or run gulp directly if you have it installed globally:

``` bash
$ gulp test
```

[30]: http://mochajs.org/
[31]: http://chaijs.com/
[32]: http://gulpjs.com/

## Performance Tests

If you want to run the performance tests make sure to change the connection values in the `./test/perf/index.test.js`
file, or they will fail trying to connect to mongo/redis.

After that, you can run the performance tests with `npm run-script perf` which will output something like:

```
=========================
mongoose-cache-manager Cache Test
=========================
Total items in DB: 30000
Total number of queries per round: 20
Total number of rounds: 30

Generating 30000 mocks...

--------------------------------
Test query without any caching
--------------------------------

..............................

Total time for 30 test rounds: 20264ms
Average time for each round: 675.47ms

--------------------------------
Test query with Redis caching
--------------------------------

..............................

Total time for 30 test rounds: 1845ms
Average time for each round: 61.50ms

--------------------------------
Test query with memory caching
--------------------------------

...........................
  ...

Total time for 30 test rounds: 478ms
Average time for each round: 15.93ms


------------
CONCLUSION
------------
Without Caching: 20264ms
With Redis Caching: 1845ms (1098.32% faster)
With Memory Caching: 478ms(4239.33% faster)



End tests.
Wiping DB and exiting
```


## License

(The MIT License)

Copyright (c) 2014 Chad Engler &lt;chad@pantherdev.com&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
