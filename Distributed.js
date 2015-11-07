// -------------------------------------------------------------------------------------------------------
// Distributed processing module in JavaScript v1.0.0
// Author: aimingoo@wandoujia.com
// Copyright (c) 2015.09
//
// The distributed processing module from NGX_4C architecture
// 	1) N4C is programming framework.
// 	2) N4C = a Controllable & Computable Communication Cluster architectur.
//
// Usage:
//	 - the 'n4c' is global variant
//	PEDT = require('./Distributed.js')
//	pedt = new PEDT(opt)
//	n4c = mix(pedt, n4c)
// -------------------------------------------------------------------------------------------------------
var def = require('./infra/taskhelper.js');

/*********************************************************
 *
 * Inferface/specification or simple utilities
 *
**********************************************************/
var reserved_tokens = {
	"?"		: Promise.reject("unhandled placeholder '?'"),
	"::*"	: Promise.reject("unhandled placeholder '::*'"),
	"::?"	: Promise.reject("argument distributionScope scopePart invalid"),
	":::"	: Promise.reject("argument distributionScope invalid")  // another tokens
}

var invalid_task_center = {
	download_task: function(taskId) { return Promise.reject(new Error('current node is not unlimited executer')) },
	register_task: function(taskDef) { return Promise.reject('current node is not publisher') }
}

var invalid_resource_center = {
	require: function(resId) { return Promise.reject('current node is not dispatcher') }
}

var invalid_promised_request = function(arrResult) {
	return Promise.reject('promised request is unsupported at current node');
}

function isTaskId(str) {
	return (str.length == 5+32) && str.match(/^task:/)
}

// package classes of value types
function isValueObject(obj) {
	return (obj instanceof Number) || (obj instanceof String) || (obj instanceof Boolean) || (obj === null);
}

// The mix() is stncard arguments processor of execute/call
//	- if no <expanded>, all functions is skiped in <ref>
function mix(self, ref, expanded) {
	switch (typeof(ref)) {
		case 'undefined': return self;
		case 'function': return expanded ? ref : undefined;
		case 'object':
			if (isValueObject(ref)) return (ref !== null) ? ref.valueOf() : null;
			if (expanded && ((ref instanceof Promise) || (self instanceof Promise))) return ref;
			if (typeof(self) != 'object' || isValueObject(self)) self = {};
			Object.keys(ref).forEach(function(key) {
				self[key] = mix(self[key], ref[key], expanded)
			})
			return self
	}
	return ref;
}

// TODO: howto check pure taskDef
var meta_object = Object.getPrototypeOf({});

/*********************************************************
 *
 * Promise fields and rewrite taskOrder
 *
**********************************************************/
function isDistributedTask(obj) {
	if ((typeof(obj) != 'object') || (obj === null) || (Object.getPrototypeOf(obj) !== meta_object)) return false; 

	return (((typeof(obj.map) == 'string') || (obj.map instanceof String)) && isTaskId(obj.map) && ('scope' in obj))
		|| (((typeof(obj.run) == 'string') || (obj.run instanceof String)) && isTaskId(obj.run))
		|| ((typeof(obj.run) == 'object') && !(obj.run instanceof String))
		|| (typeof(obj.run) == 'function');
}

function promise_distributed_task(worker, task) {
	var faild = function() {
		console.log("TODO: fix bug!")
		return worker.run(task.arguments)
	}
	var args = isDistributedTask(task.arguments) ?  faild(): task.arguments;
	return ('run' in task) ? worker.run(task.run, args)
		: ('map' in task) ? worker.map(task.scope, task.map, args)
		: Promise.reject("none distribution method in taskDef");
}

function promise_distributed_tasks(worker, arr) {
	var tasks;
	arr.forEach(function(t, i) {
		if (isDistributedTask(t)) {
			if (! tasks) tasks = arr.slice(0, i);
			tasks.push(promise_distributed_task(worker, t))
		}
		else tasks && tasks.push(t);
	})
	return tasks
}

function promise_member_rewrite(promised) {
	var keys = promised.pop(), taskOrder = promised.pop();
	keys.forEach(function(key, i) {
		taskOrder[key] = promised[i]
	})
	return Promise.resolve(taskOrder)
}

function getTaskResult(taskOrder) {
	return taskOrder.promised && taskOrder.promised.call(this, taskOrder) || taskOrder
}

function extractTaskResult(taskOrder) {
	function isObject(result) {return (typeof(result) == 'object') && !isValueObject(result)}
	function canInherite(name) { return (name != 'promised') && (name != 'distributed') && (typeof(this[name]) != 'function') }
	function uninherited(name) { return !Object.getOwnPropertyDescriptor(this, name) }
	function pickResult(name) { return this[name] }

	if (taskOrder instanceof Array) {
		taskOrder.filter(isObject).forEach(extractTaskResult)
	}
	else {
		var taskDef = isObject(taskOrder) && Object.getPrototypeOf(taskOrder); // @see makeTaskOrder()
		if (taskDef) {
			var copyTo = function(name) { this[name] = taskDef[name] }
			Object.keys(taskOrder).map(pickResult, taskOrder).filter(isObject).forEach(extractTaskResult);
			Object.keys(taskDef).filter(canInherite, taskDef).filter(uninherited, taskOrder).forEach(copyTo, taskOrder)
		}
		return taskOrder
	}
}

function extractMapedTaskResult(results) {
	// the <result> resolved with {body: body, headers: response.headers}
	//	- @see request.get() in distributed_request()
	function pickResult(result, i) {
		try {
			return JSON.parse(result.body)
		}
		catch(e) {
			return Promise.reject({ index: i, reason: e })
		}
	}
	return Promise.all(results.map(pickResult));
}

function makeTaskOrder(taskDef) {
	return Object.create(taskDef)
}

function promise_static_member(worker, order) {
	var keys = [], promises = [], fakeOrder = makeTaskOrder;
	for (var key in order) {
		var value = order[key];
		if ((typeof(value) == 'object') && !isValueObject(value)) {
			if (isDistributedTask(value)) {
				keys.push(key);
				promises.push(promise_distributed_task(worker, value));
			}
			else if (value instanceof Array) {
				keys.push(key);
				promises.push(promise_distributed_tasks(worker, value));
			}
			else {
				var p = promise_static_member(worker, fakeOrder(value));
				if (p) {
					keys.push(key);
					promises.push(p);
				}
			}
		}
	}

	if (keys.length > 0) {
		promises.push(order, keys);
		return Promise.all(promises).then(promise_member_rewrite).then(getTaskResult.bind(worker));
	}
	else if (order.promised) {
		return Promise.resolve(order).then(getTaskResult.bind(worker));
	}
}

function promise_executor(resolve, reject) {
	var worker = this[0], order = this[1]
	Promise.resolve(promise_static_member(worker, order) || order).then(resolve, reject)
}

/*********************************************************
 *
 * Interface of distributed tasks
 *
**********************************************************/
var GLOBAL_CACHED_TASKS = {}

function inject_default_handles(opt) {
	if (! opt.task_register_center) {
		opt.task_register_center = invalid_task_center;
	}
	else {
		var center = opt.task_register_center;
		if (! center.download_task) center.download_task = invalid_task_center.download_task;
		if (! center.register_task) center.register_task = invalid_task_center.register_task;
	}

	if (! opt.resource_status_center) {
		opt.resource_status_center = invalid_resource_center
	}
	else {
		var center = opt.resource_status_center;
		if (! center.require) center.require = invalid_resource_center.require;
	}

	return opt
}

// taskDef is string for http response body
// 		- <this> is instance of Distributed
function distributed_task(taskDef) {
	var taskDef = def.decode(taskDef)
	if ('distributed' in taskDef) {
		taskDef.distributed.call(this, taskDef)
	}
	return taskDef
}

// call task_register_center.download_task(), and cache + preprocess
function internal_download_task(center, taskId) {
	// taskDef is obj, decoded and distributed
	function cached_as_promise(taskDef) {
		return GLOBAL_CACHED_TASKS[this] = Promise.resolve(taskDef);
	}
	var taskDef = GLOBAL_CACHED_TASKS[taskId];
	return taskDef ||
		Promise.resolve(center.download_task(taskId)).then(distributed_task.bind(this)).then(cached_as_promise.bind(taskId));
}

function internal_parse_scope(center, distributionScope) {
	// "?" or "*" is filted by this.require()
	if (distributionScope.length < 4) return this.require(":::");

	// systemPart:pathPart:scopePart
	//		- rx_tokens = /^([^:]+):(.*):([^:]+)$/		-> m[0],m[1],m[2]
	var rx_tokens = /^(.*):([^:]+)$/, m = distributionScope.match(rx_tokens);
	if (! m) return this.require(":::");

	// TODO: dynamic scopePart parser, the <parts> is systemPart:pathPart
	// 		- var full = m[0], parts = m[1], scopePart = m[2];
	return (m[2] == '?') ? this.require("::?")
		: (m[2] == '*') ? Promise.resolve(center.require(m[1]))
		: Promise.reject("dynamic scopePart is not support");
}

function internal_execute_task(taskDef) {
	// var n4c = this[0], args = this[1];
	var taskOrder = mix(makeTaskOrder(taskDef), this[1]);
	var executor = promise_executor.bind([this[0], taskOrder]);
	return new Promise(executor)
}

function D(opt) {
	var options = { system_route: Object.create(reserved_tokens) };

	var system_route = function(token) {
		return options.system_route[token]
	}

	this.upgrade = function(newOptions) {
		inject_default_handles(mix(options, newOptions, true));
		if ('distributed_request' in newOptions) {
			this.distributed_request = options.distributed_request
		}
	}

	this.require = function(token) {
		return Promise.resolve(system_route(token) ||
			internal_parse_scope.call(this, options.resource_status_center, token))
	}

	this.execute_task = function(taskId, args) {
		return internal_download_task.call(this, options.task_register_center, taskId.toString())
			.then(internal_execute_task.bind([this, args])).then(extractTaskResult)
	}

	this.register_task = function(task) {
		return Promise.resolve(options.task_register_center.register_task(
			((typeof(task) == 'string') || (task instanceof String)) ? task : def.encode(task)))
	}

	this.distributed_request = invalid_promised_request;
	this.upgrade(opt);
}

// -------------------------------------------------------------------------------------------------------
// Distributed processing methods
// 	*) return promise object by these methods
// 	*) MUST: catch error by caller for these interfaces
// -------------------------------------------------------------------------------------------------------
D.prototype = mix(Object.create(def), {
	run: function(task, args) {
		// direct call, or call from promise_distributed_task()
		if (task instanceof Function) return Promise.resolve(args).then(task.bind(this));

		// check types
		var t = typeof(task), self = this;
		if ((t == 'string') || (task instanceof String)) {
			return Promise.resolve(args).then(function(args) {
				return self.execute_task(task, args)
			})
		}
		else if (t == 'object') { // task as taskObject
			return Promise.resolve(args).then(function(args) {
				var taskOrder = mix(makeTaskOrder(task), args);
				var executor = promise_executor.bind([self, taskOrder]);
				return new Promise(executor).then(extractTaskResult);
			})
		}

		return Promise.reject('unknow task type "' + t + '" in Distributed.run()')
	},

	map: function(distributionScope, taskId, args) {
		return Promise.all([this, this.require(distributionScope), taskId, args])
			.then(this.distributed_request)
			.then(extractMapedTaskResult);
	}
}, true);


D.infra = {
	taskhelper: def,
	httphelper: require('./infra/httphelper.js'),
	requestdata: require('./infra/requestdata.js')
}

module.exports = D;