local queryData = redis.call('get', KEYS[1])

-- If there is no query data, this is a cache miss
if not queryData then
    return nil;
end

local collectionData = redis.call('get', KEYS[2])

-- If there is query data, but no collection data, this is a hit
if not collectionData then
    return {nil, queryData}
end

-- If we have both, we need to check the lastWrite dates.
-- If the last write for the collection was after the last write the query data
-- actually represents, then we have a cache miss. However we do still send the
-- collectionData back so the next cache entry can have the right lastWrite time.
if cjson.decode(collectionData).lastWrite > cjson.decode(queryData).metadata.lastWrite then
    return {collectionData, nil};
-- Otherwise this is a cache hit
else
    return {collectionData, queryData}
end
