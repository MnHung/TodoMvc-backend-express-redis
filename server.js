'use strict';

var express = require('express')
  , bodyParser = require('body-parser')
  , cors = require('cors')
  , app = express();

var Todo = require('./app/models/todo');

app.use(bodyParser.json()); // to support JSON-encoded bodies

// app.use(function(req, res, next) {
//     res.header('Access-Control-Allow-Headers', 'Content-Type');
//     res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE');
//     res.header('Access-Control-Allow-Origin', '*');
//     next();
// });

app.use(cors());

app.get(  '/', function (req, res) {
    console.info("get all");
    Todo.all()
        .then(function (todos) {
            res.status(200).end(JSON.stringify(todos));
        });
});

app.get(  '/:id', function (req, res) {
    console.info("get one");
    Todo.find(req.params.id)
        .then(function (todo) {
            // 200: ok
            res.status(200).end(JSON.stringify(todo));
        });
});

app.post( '/', function (req, res) {
    console.info("post ");
    console.info(req.body);

    var id = req.body.id;
    var todo = req.body;

    if (id) {
        updateTodo(req, res, id, todo);
    } else {
        var url = 'http://' + req.headers.host + '/';
        createTodo(req, res, todo, url);
    }
});

var createTodo = function (req, res, todo, url) {
    return Todo.create(todo, url)
        .then(function (todo) {
            // 201: created
            res.status(201).end(JSON.stringify(todo));
        });
};

var updateTodo = function (req, res, id, todo) {
    return Todo.update(id, todo)
        .then(function (todo) {
            // 200: ok
            res.status(200).end(JSON.stringify(todo));
        });
}

app.patch( '/:id', function (req, res) {
    console.info("# patch");
    console.info(req.body);
    console.info(req.params.id);

    var id = req.params.id;
    var todo = req.body;

    updateTodo(req, res, id, todo);
});

app.delete('/', function(req, res) {
    console.info("delete all");
    Todo.delAll()
        .then(function () {
            // 200: ok
            res.status(200).end();
        });
});

app.delete('/:id', function(req, res) {
    console.info("delete one, id: " + req.params.id);

    Todo.del(req.params.id)
        .then(function () {
            // 200: ok
            res.status(200).end(JSON.stringify({}));
        });
});

app.listen(3000);
