# TodoMVC backend built with Node.js Express and Redis
以經典範例 TodoMVC 示範/練習一組常見的 web service 功能是如何實踐

## Plan
Web service (或者你要說 server 或 back-end) 最常見的功能就是針對某種資料做 CRUD 了，在更較簡易的功能，甚至幾乎是針對某個資料來源 (例如資料庫裡的 table) 做 CRUD。但即使在較複雜的情況，RESTful API 設計也可以將概念簡化成針對某種「資源」做 CRUD。

[TodoMVC](http://todomvc.com/) 之所以經典，就在於它可以涵蓋許多常見功能，做完之後還可以與其他實踐方式比較。而本範例重點不在前端，更重要的是實現其 server，[TODO-Backend](http://www.todobackend.com/)! 將 Todos 儲存在 Redis 資料庫裡。預計範例最後會出現：
 
 *  一組 Todo model，儲存在 Redis
 *  一組 RESTful Todo API

## Design of Todo
我們先來看看一個 Todo list 長怎樣 ：
![screen of todo mvc](https://camo.githubusercontent.com/6b21e79e6813819e6dd04f17e041e88b2e8bc972/68747470733a2f2f646c2e64726f70626f7875736572636f6e74656e742e636f6d2f752f363539393234392f746f646f6d76632e706e67)
看來功能會可以新增 Todo、可以刪除 Todo、可以將 Todo 勾選為 completed 狀態、還可以過濾出狀態為 completed 或 active 的 Todo。

### Design of Todo API
這些的功能相當符合 CRUD，可以拆為：
 
 * **Creat**:  輸入標題來建立 Todo - **POST /todos**
 * **Read**:  顯示清單的資料就從這個 API 取得 - **GET /todos**
 * **Update**: 更新一筆 Todo - **PATCH /todos/:id**
 * **Delete**: 刪除一筆 Todo - **DELETE /todos/:id**


### Design of Todo model

而一個 Todo 有 completed 狀態，還需要一個 title 欄位表示顯示的標題。我可以將 Todo model 的形狀設計為這樣：

```javascript
{
	"title": "TODO 1", 
	"completed": false
}
```
## Implement of Model

### Redis npm
有了 Todo 的形狀，我們可以開始寫 server 上的 model 了，也就是資料庫存取層。我們引入 [redis](https://github.com/NodeRedis/node_redis) npm 作為 redis 的 client library；再加上官方推薦的 [bluebird](http://bluebirdjs.com/docs/getting-started.html) 作為 promise 工具。

>**Async Flow**
>
> JavaScript 的世界到處都是非同步 API，有許多[工具/方法](http://huli.logdown.com/posts/292655-javascript-promise-generator-async-es6)可以讓非同步的程式碼較容易閱讀與維護，最常見的是：[Async](https://github.com/caolan/async), [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) 和 [generator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Iterators_and_Generators)。其中 bluebird 是一個廣為使用的 promise 工具。

設定 Redis API 和連線：

```javascript
var redis = require('redis');
var Promise = require('bluebird');
var client;

Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);

var client = redis.createClient();
```
`redis.createClient` 預設會連向 `127.0.0.1:6379` 的 Redis server。你可以註冊 connect 事件，當連線成功就會收到通知
```javascript
client.on('connect', function() {
    console.log('redis connected');
});
```
### Implement CRUD of Todos

> 除了 Redis client，我們還需要可以產生 uuid 的[工具](https://github.com/broofa/node-uuid)：`var uuid = require("node-uuid");`

#### **Create ** Todo 
用 title 產生新的 Todo: 
```javascript
var create = function(title) {
    var id = uuid.v4();
    var todo = {
        title: title,
        id: id;
    };
    return client.setAsync('todo:' + id, JSON.stringify(todo))
	    .then(function () {
            return todo;
        });
};
```
這實作看起來還算簡短，但接著我們會繼續實作 read, update, delete，有些東西還會再次出現。首先是 Redis 的 key。Redis [SET](http://redis.io/commands/SET) 的第一個參數是字串 `key`，key 的慣例是 **"object-type:id:field"** ，他們採用冒號 : 來做分隔，對 Todo 來說，可以用 `todo:{id}` 代表某個 todo。Key 的串接在接下來會常常出現，所以可以包裝一個函式來產生 key：

```javascript
function dbKey(id){
  return 'todo:' + id;
}

```

還需要序列化/反序列化，因為 Redis 儲存的都是字串，我們必須在字串和物件之間轉換：

```javascript
function deserialize(todo){
  return JSON.parse(todo);
}

function serialize(todo){
  return JSON.stringify(todo);
}
```
抽出一些函式以後，create 可以重構為：

```javascript
var create = function(title) {
    var id = uuid.v4();
    var todo = {
        title: title,
        id: id,
        completed: false
    };
    return client.setAsync(dbKey(id), serialize(todo))
        .then(function () {
            return todo;
        });
};
```

接著就可以開始實作 model 的 RUD
 
 
#### **Read** Todos 
讀取全部的 Todos，讀取出資料之後，用 `deserialize` 轉成物件：
```javascript
var all = function () {
    return client.keysAsync(dbKey("*"))
        .map(function (key) {
            return join(client.getAsync(key), function(todo) {
                return deserialize(todo);
            });
        });
};
```

#### **Update** Todos 

```javascript
var update = function(id, title, completed) {
    var todo = {
        title: title,
        id: id,
        completed: completed
    };
    return client.setAsync(dbKey(id), serialize(todo));
};
```

#### **Delete** Todo
刪除指定 id 的 Todo、還有刪除全部的 Todos：
```javascript
var del = function (id) {
    return client.delAsync(id);
};

var delAll = function () {
    client.keysAsync(dbKey("*"))
        .map(function (key) {
            return join(del(key));
        });
};
```

#### Export as package
最後將 model 的 API 包裝成 node package

```javascript
module.exports.create = create;
module.exports.all = all;
module.exports.update = update;
module.exports.del = del;
module.exports.delAll = delAll;
```
完成。

## Implement of RESTful Todo API

接著要包裝 Todo API，我們剛已經設計好 RESTful 風格的樣式：

 * **Creat**:  POST /todos
 * **Read**:  GET /todos
 * **Update**: PATCH /todos/:id
 * **Delete**: DELETE /todos/:id

然後只要包裝好 http 狀態就可以了。首先引入實作好的 model：
```javascript
var Todo = require('./app/models/todo');

```

#### POST /todos
```javascript
app.post( '/', function (req, res) {
	var todo = req.body;
	return Todo.create(todo, url)
        .then(function (todo) {
	        // 201: created
			res.status(201).end(JSON.stringify(todo));
        });
}; 
```

#### GET /todos
```javascript
app.get(  '/', function (req, res) {
    Todo.all()
        .then(function (todos) {
            res.status(200).end(JSON.stringify(todos));
        });
});

```
#### GET /todos/:id
```javascript
app.get(  '/:id', function (req, res) {
    Todo.find(req.params.id)
        .then(function (todo) {
            // 200: ok
            res.status(200).end(JSON.stringify(todo));
        });
});
```

#### PATCH /todos/:id
更新一個 Todo 
```javascript
app.patch( '/:id', function (req, res) {
    var id = req.params.id;
    var todo = req.body;

    Todo.update(id, todo)
        .then(function (todo) {
            // 200: ok
            res.status(200).end(JSON.stringify(todo));
        });
});
```

#### DELETE /todos/:id
```javascript
app.delete('/', function(req, res) {
    Todo.delAll()
        .then(function () {
            // 200: ok
            res.status(200).end();
        });
});
```

#### DELETE /todos
```javascript
app.delete('/:id', function(req, res) {
    Todo.del(req.params.id)
        .then(function () {
            // 200: ok
            res.status(200).end(JSON.stringify({}));
        });
});
```

#### RESTful v.s. CRUD
在這個範例裡，RESTful 和 CRUD 看起來非常像，幾乎只是 API 的包裝稍有不同而已，那是因為這個範例相對簡單。RESTful 和 CRUD 的不同在於，CRUD 是 data repository 的基本操作，它針對的是資料來源，通常就是指資料表與單筆資料；而 RESTful API 則是包裝後的高階 API，也就是它底下不只是資料層、還有邏輯層。例如，如果我們在範例中加入使用者登入的功能，那麼 `GET /todos` 做的事情就不是直接取得所有的 todos，而是必須取得跟目前使用者有關係的 todos。


## 使用 sample project

### Start
```
git clone https://github.com/MnHung/TodoMvc-backend-express-redis.git
```
切換進資料夾，接著 install
```
cd TodoMvc-backend-express-redis/
sudo npm install
```
Run
```
npm start
```

### Test
Todo backend 有兩個測試工具，一個可以詳細的[測試 spec](http://www.todobackend.com/specs/index.html)，一個則是用 [UI 測試](http://www.todobackend.com/client/index.html)。

UI 測試等於是官方做好的一個 TodoMvc 前端，可以用來測試任何一版本的 backend。假設你已經執行專案了，那你可以開啟 http://www.todobackend.com/client/index.html?http://127.0.0.1:3000  就可以看到 TodoMvc 執行的樣子。

像這樣：
![enter image description here](https://raw.githubusercontent.com/MnHung/TodoMvc-backend-express-redis/master/sample.png)

而 spec 測試也幾乎都通過了，只有少部分還怪怪的，但不影響功能。

你在專案中看到的程式碼將比上面介紹的更為複雜，那是為了要配合 Todo backend 的 spec ，因為 spec 裡面的功能比上面在文中提到的還要多。但為了容易理解，在文中還是使用較簡單的功能來說明。

以上，我們用一個經典範例的 backend，看到一組完整的功能是如何設計、看到 API 包裝的樣子、如何被 frontend 使用。
