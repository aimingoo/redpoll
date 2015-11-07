#redpoll
redpoll is implement of PEDT - Parallel Exchangeable Distribution Task specifications for NodeJS.

PEDT v1.1 specifications supported.

#install
> npm install redpoll

#import and usage
```javascript
var Redpoll = require('redpoll');
var options = {};
var pedt = new Redpoll(options);

pedt.run(...)
	.then(function(result){
		...
	})
```

# options
the full options schema:
```javascript
options = {
	distributed_request: function(arrResult) { ... }, // a http client implement
	system_route: { ... }, // any key/value pairs
	task_register_center: {
		download_task: function(taskId) { ... }, // PEDT interface
		register_task: function(taskDef) { ... }  // PEDT interface
	},
	resource_status_center: {
		require: function(resId) {...}	// PEDT interface
	}
}
```

# interfaces
> for detail, @see ${readpoll}/infra/specifications/*

all interfaces are promise supported except pedt.upgrade() and helpers.

## pedt.run
```javascript
pedt.run = function(task, args)
```
run a task (taskId, function or taskObject) with args.

## pedt.map
```javascript
pedt.map = function(distributionScope, taskId, args)
```
map taskId to distributionScope with args, and get result array.

distributionScope will parse by pedt.require().

## pedt.execute_task
```javascript
pedt.execute_task = function(taskId, args)
```
run a taskId with args. pedt.run(taskId) will call this.

## pedt.register_task
```javascript
pedt.register_task = function(task)
```
run a task and return taskId.

the "task" is a taskDef text or local taskObject.

## pedt.require
```javascript
pedt.require = function(token)
```
require a resource by token. the token is distributionScope or system token, or other.

this is n4c expanded interface, resource query interface emmbedded.

## pedt.upgrade
```javascript
this.upgrade = function(newOptions)
```
upgrade current Redpoll/PEDT instance with newOptions. @see [options](#options)

this is redpoll expanded interface.

## helpers

some tool/helpers include in the package.

### Redpoll.infra.taskhelper
```javascript
var Redpoll = require('redpoll');
var def = Redpoll.infra.taskhelper;
var taskDef = {
	x: def.run(...),
	y: def.map(...),
	...
}
```
a taskDef define helper. @see:
> $(redpoll)/testcase/t_executor.js

### Redpoll.infra.httphelper
```javascript
var Redpoll = require('redpoll');
var options = {
	...,
	distributed_request = Redpoll.infra.httphelper.distributed_request
}
```
a recommented/standard distributed request.

### Redpoll.infra.requestdata
```javascript
var Redpoll = require('redpoll');
var request_parse = Redpoll.infra.requestdata.parse;

...
require("http").createServer(function(request, response) {
	var params = request_parse(request);
	...
}
```
a requestdata parser for http server/daemon, PEDT standard requests supported. @see:
> $(redpoll)/testcase/executor.js

# testcase
try these:
```bash
> git clone 'https://github.com/aimingoo/redpoll'
> cd redpoll
> npm install
> node testcase/t_executor.js

> #(start new shell and continue)
> curl -s 'http://127.0.0.1:8032/redpoll/execute_task:c2eb2597e461aa3aa0e472f52e92fe0b'
```

# history
```text
	2015.11.07	v1.0.0 released.
```