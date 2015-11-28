# redpoll

redpoll is implement of PEDT - Parallel Exchangeable Distribution Task specifications for NodeJS.

PEDT v1.1 specifications supported.

### Table of Contents

* [install](#install)
* [import and usage](#import-and-usage)
* [options](#options)
* [interfaces](#interfaces)
  * [pedt.run](#pedtrun)
  * [pedt.map](#pedtmap)
  * [pedt.execute_task](#pedtexecute_task)
  * [pedt.register_task](#pedtregister_task)
  * [pedt.require](#pedtrequire)
  * [pedt.upgrade](#pedtupgrade)
* [helpers](#helpers)
  * [Redpoll.infra.taskhelper](#redpollinfrataskhelper)
  * [Redpoll.infra.httphelper](#redpollinfrahttphelper)
  * [Redpoll.infra.requestdata](#redpollinfrarequestdata)
* [testcase](#testcase)
* [history](#history)

# install

> npm install redpoll

# import and usage

``` javascript
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

``` javascript
options = {
	distributed_request: function(arrResult) { .. }, // a http client implement
    default_rejected: function(message) { .. }, // a default rejected inject
	system_route: { .. }, // any key/value pairs
	task_register_center: {
		download_task: function(taskId) { .. }, // PEDT interface
		register_task: function(taskDef) { .. }  // PEDT interface
	},
	resource_status_center: {
		require: function(resId) {..}	// PEDT interface
	}
}
```

# interfaces

> for detail, @see ${readpoll}/infra/specifications/*

all interfaces are promise supported except pedt.upgrade() and helpers.

## pedt.run

``` javascript
pedt.run = function(task, args)
```

run a task (taskId, function or taskObject) with args.

## pedt.map

``` javascript
pedt.map = function(distributionScope, taskId, args)
```

map taskId to distributionScope with args, and get result array.

distributionScope will parse by pedt.require().

## pedt.execute_task

``` javascript
pedt.execute_task = function(taskId, args)
```

run a taskId with args. pedt.run(taskId) will call this.

## pedt.register_task

``` javascript
pedt.register_task = function(task)
```

run a task and return taskId.

the "task" is a taskDef text or local taskObject.

## pedt.require

``` javascript
pedt.require = function(token)
```

require a resource by token. the token is distributionScope or system token, or other.

this is n4c expanded interface, resource query interface emmbedded.

## pedt.upgrade

``` javascript
this.upgrade = function(newOptions)
```

upgrade current Redpoll/PEDT instance with newOptions. @see [options](#options)

this is redpoll expanded interface.

## pedt.LOGGER

this is expanded reserved tokens. it's constant:

> LOGGER: "!"

so, you can option/reset/upgrade local default logger in your code:

``` javascript
pedt.upgrade({ system_route: {[pedt.LOGGER]: function(message) {
  console.log(message)
}}});
```

or disable it:

``` javascript
pedt.upgrade({ system_route: {[pedt.LOGGER]: Promise.resolve(false)}}),
```

or resend message to remote nodes/scope:

``` javascript
// @see ${redpoll}/testcase/t_executor.js
pedt.register_task(a_task_def).then(set_remote_logger)
```

and, you can call the logger at anywhere:

``` javascript
pedt.require(pedt.LOGGER).then(function(logger) {
  pedt.run(logger, message)
})
```

or public a log_print_task, register and run it:

``` javascript
var log_print_task = {
  message: 'will replaced',
  task: def.require(def.LOGGER),
  promised: function(log) {
    return this.run(log.task, log.message))
  }
}
var taskId = '<get result from pedt.register_task(log_print_task)>'
pedt.run(taskId, {message: 'some notice/error information'})
```

this is redpoll expanded interface.

## pedt.TASK_XXX

some task constants, inherited from def.TASK_XXX in Redpoll.infra.taskhelper. include:

``` javascript
TASK_BLANK
TASK_SELF
TASK_RESOURCE
```

ex:

``` javascript
taskDef = {
  // !! static recursion !!
  x: def.run(def.TASK_SELF, ..), 
  // require local resource
  y: def.require('registed_local_resource_name'),

  promised: function(taskResult) {
    // !! dynamic recursion !!
    this.run(taskResult.taskId, ..);
    // try execute blank task
    this.execute_task(this.TASK_BLANK, {..})
  }
}
```

this is redpoll expanded interface.

## pedt.version

get support version of PEDT specifications, it's string value.

this is redpoll expanded interface.

# helpers

some tool/helpers include in the package.

## Redpoll.infra.taskhelper

``` javascript
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

## Redpoll.infra.httphelper

``` javascript
var Redpoll = require('redpoll');
var options = {
	...,
	distributed_request = Redpoll.infra.httphelper.distributed_request
}
```

a recommented/standard distributed request.

## Redpoll.infra.requestdata

``` javascript
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

``` bash
> git clone 'https://github.com/aimingoo/redpoll'
> cd redpoll
> npm install
> node testcase/t_executor.js

> #(start new shell and continue)
> curl -s 'http://127.0.0.1:8032/redpoll/execute_task:c2eb2597e461aa3aa0e472f52e92fe0b'
```

# history

``` text
2015.11.28	v1.1.0 released.
	- recursion taskDef supported, def.TASK_SELF point to self.
	- def.require() supported, and other def.XXX constants published.
	- standard logger and rejected inject.
	- taskDef.rejected supported.
2015.11.07	v1.0.0 released.
```

