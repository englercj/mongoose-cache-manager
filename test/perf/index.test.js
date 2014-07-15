/**
 * Test case for Mongoose-Redis Cache
 *
 * Testing methodology:
 *
 * Mock data:
 * We generate a set number of mock data in the DB. Defaults to 30000 items.
 * Each item contains a random person's name, some arbitary number as data, a date, and
 * an array for the person's friend. We index the name field to optimize
 * MongoDB's performance.
 *
 * Execute test rounds:
 * For every round we query the database for all the names (defaults to 20 of them),
 * and tracks the amount of time required to return the data. We run these same queries
 * with and without Redis caching, for 20 rounds. Then we average out the time
 * needed to return the data. All queries are query.lean(), meaning all documents
 * returned are NOT casted as Mongoose models.
 *
 */

var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    async = require('async'),
    mongooseCache = require('../../index');

// counts for items to test
var itemsCount = 30000,
    testRounds = 30,
    cacheTtl = 60,
    timeout = 1000 * 30,

    mongoConnectionString = 'mongodb://pitboss_app:P1t_b0$$_4pP@10.130.59.71:27017/pitboss',
    redisConnectionOptions = {
        engine: 'redis',
        host: '10.130.59.71',
        port: 6379,
        password: ''
    },

    totalTimeWithoutCache = 0,
    totalTimeWithRedis = 0,
    totalTimeWithMemory = 0,

    mockNames = [
        'Jacob',
        'Sophia',
        'Mason',
        'Isabella',
        'William',
        'Emma',
        'Jayden',
        'Olivia',
        'Noah',
        'Ava',
        'Michael',
        'Emily',
        'Ethan',
        'Abigail',
        'Alexander',
        'Madison',
        'Aiden',
        'Mia',
        'Daniel',
        'Chloe'
    ],
    maxQueriesCount = mockNames.length;

/****************************
 * Setup the test.
 ****************************/
mongoose.connect(mongoConnectionString);
//mongoose.connect('mongodb://localhost/mongoose-redis-test')

// create test item schema
var TestItemSchema = new Schema({
    num1: Number,
    num2: Number,
    num3: Number,
    date: { type: Number, default: Date.now() },
    friends: [String],
    name: { type: String, index: true } //index the name field
});

// set the schema to include caching
TestItemSchema.set('cache', true);
TestItemSchema.set('ttl', cacheTtl);

var TestItem = mongoose.model('TestItem', TestItemSchema);

// clear the database for clean start next time
function clearDb(cb) {
    TestItem.remove(cb);
}

// generate the mock data to test against
function commitMocksBatch(amount, cb) {
    var items = [];

    while (items.length < amount) {
        items.push({
            name: mockNames[Math.floor(Math.random() * mockNames.length)],
            num1: Math.random() * 10000,
            num2: Math.random() * 10000,
            num3: Math.random() * 10000,
            friends: mockNames.slice(0, Math.floor(Math.random() * mockNames.length))
        });
    }

    TestItem.create(items, cb);
}

function generateMocks(amount, cb) {
    var batchSize = 1000,
        fns = [];

    for(var i = 0; i < amount; i += batchSize) {
        var size = (amount - i) < batchSize ? (amount - i) : batchSize;

        fns.push(commitMocksBatch.bind(null, size));
    }

    async.parallel(fns, cb);
}

// For each round, run a query for every mock name defined.
// It should return all results that matches the name.
// Track the time required to execute each command, then average it out
function runTestRound(cb) {
    var currQueryCount = 0,
        timeSpentArr = [];

    async.whilst(
        //condition
        function () {
            return currQueryCount < maxQueriesCount;
        },
        //iterator
        function (_cb) {
            var queryStartTime = Date.now(),
                query = TestItem.find({ name: mockNames[currQueryCount] });

            // want to use without this...
            query.lean();

            query.exec(function (err) {
                if (err) throw err;

                var queryEndTime = Date.now();

                timeSpentArr.push(queryEndTime - queryStartTime);
                currQueryCount++;
                _cb();
            });
        },
        //complete
        function () {
            var totalTime = timeSpentArr.reduce(function (p, c) { return p + c; }, 0),
                averageTime = totalTime / maxQueriesCount;

            // To see each individual query's execution time, uncomment these two lines
            // console.log('Query -- time spent total -- ', totalTime + 'ms');
            // console.log('Query -- time spent average per query -- ', averageTime.toFixed(3) + 'ms');

            //return the total time and average time to track results for each round
            cb(null, {
                total: totalTime,
                avg: averageTime
            });
        }
    );
}

function runTest(name, cb) {
    before(function () {
        console.log('\n--------------------------------\nTest ' + name + '\n--------------------------------\n');
    });

    var totalTime = 0,
        itRun = function (done) {
            this.timeout(timeout);

            runTestRound(function (err, result) {
                totalTime += result.total;
                done();
            });
        };

    for (var i = 1; i <= testRounds; ++i) {
        it('Run ' + i, itRun);
    }

    after(function () {
        console.log('\n\nTotal time for ' + testRounds + ' test rounds:', totalTime + 'ms');
        console.log('Average time for each round:', (totalTime / testRounds).toFixed(2) + 'ms');

        cb(totalTime);
    });
}

/****************************
 * Run the test.
 ****************************/
// clear the database before starting, then generate mock data
before(function (done) {
    console.log(
        '\n=========================\n' +
        'mongoose-cacheman Cache Test\n' +
        '=========================\n' +
        'Total items in DB: ' + itemsCount + '\n' +
        'Total number of queries per round: ' + maxQueriesCount + '\n' +
        'Total number of rounds: ' + testRounds + '\n'
    );

    this.timeout(60000);

    clearDb(function () {
        console.log('Generating ' + itemsCount + ' mocks...');
        generateMocks(itemsCount, function (err) {
            if (err) throw err;

            //ensure the indexes are created
            TestItem.ensureIndexes(done);
        });
    });
});

describe('Mongoose queries without caching', function () {
    runTest('query without any caching', function (totalTime) {
        totalTimeWithoutCache = totalTime;
    });
});

describe('Mongoose queries with redis caching', function () {
    before(function () {
        mongooseCache(mongoose, redisConnectionOptions);
    });

    runTest('query with Redis caching', function (totalTime) {
        totalTimeWithRedis = totalTime;
    });
});

describe('Mongoose queries with memory caching', function () {
    before(function () {
        mongooseCache(mongoose, {
            engine: 'memory'
        });
    });

    runTest('query with memory caching', function (totalTime) {
        totalTimeWithMemory = totalTime;
    });
});

after(function (done) {
    console.log(
        '\n\n------------\n' +
        'CONCLUSION\n' +
        '------------\n' +
        'Without Caching: ' + totalTimeWithoutCache + 'ms\n' +
        'With Redis Caching: ' + totalTimeWithRedis + 'ms (' +
            (totalTimeWithoutCache / totalTimeWithRedis * 100).toFixed(2) + '% faster)\n' +
        'With Memory Caching: ' + totalTimeWithMemory + 'ms(' +
            (totalTimeWithoutCache / totalTimeWithMemory * 100).toFixed(2) + '% faster)\n'
    );

    console.log('\n\nEnd tests. \nWiping DB and exiting');
    clearDb(done);
});
