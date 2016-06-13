'use strict';

var uuid = require("node-uuid");
var Promise = require('bluebird');
var join = Promise.join;
var redis = require('redis');
var client;

Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);

var client = redis.createClient();

client.on('connect', function() {
    console.log('redis connected');
});


function deserialize(todo){
  return JSON.parse(todo);
}

function serialize(todo){
  return JSON.stringify(todo);
}

function dbKey(id){
  return 'todo:' + id;
}

var create = function(todo, url) {
    var id = uuid.v4();

    todo.completed = false;
    todo.id = id;
    todo.url = url + id;

    return client.setAsync(dbKey(id), serialize(todo))
        .then(function () {
            return todo;
        });
};

var find = function (id) {
    return client.getAsync(dbKey(id))
            .then(function (todo) {
                return deserialize(todo);
            });
};

var all = function () {
    return client.keysAsync(dbKey("*"))
        .map(function (key) {
            return join(client.getAsync(key), function(todo) {
                return deserialize(todo);
            });
        });
};

var update = function(id, params) {
    return find(id)
        .then(function (todo) {
            for (var key in params) {
                todo[key] = params[key];
            }
            return client.setAsync(dbKey(id), serialize(todo))
                .then(function() {
                    return todo;
                });
        });
};

var del = function (id) {
    return client.delAsync(id);
};

var delAll = function () {
    return client.keysAsync(dbKey("*"))
        .map(function (key) {
            return join(del(key));
        });
};

module.exports.create = create;
module.exports.all = all;
module.exports.find = find;
module.exports.update = update;
module.exports.del = del;
module.exports.delAll = delAll;

