// -------------------------------------------------------------------------------------------------------
// Distributed processing module in JavaScript v1.1.0
// Author: aimingoo@wandoujia.com
// Copyright (c) 2015.09
//
// The distributed processing module from NGX_4C architecture
// 	1) N4C is programming framework.
// 	2) N4C = a Controllable & Computable Communication Cluster architectur.
//
// Usage:
//	 - the 'n4c' is global variant
//	Redpoll = require('./Distributed.js')
//	pedt = new Redpoll(opt)
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
	":::"	: Promise.reject("argument distributionScope/resourceId invalid"),  // another tokens
	[def.LOGGER]: Promise.resolve(false)
}

var invalid_task_center = {
	download_task: function(taskId) { return Promise.reject('current node is not unlimited executer') },
	register_task: function(taskDef) { return Promise.reject('current node is not publisher') }
}

var invalid_resource_center = {
	require: function(resId) { return Promise.reject('current node is not dispatcher') }
}

var invalid_promised_request = function(arrResult) {
	return Promise.reject('promised request is unsupported at current node');
}

// check string is task id
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
 * standard logger and rejected inject
 *
**********************************************************/
var ignore_rejected = Promise.resolve.bind(Promise);

// internal logger for default rejected only
//		- <this> is prebind array of [worker, message]
function internal_logger(task) { return task && this[0].run(task, this[1]) }

// return resolved promise, and mute rejected message always
//	- standard implementations only 2 lines:
function internal_default_rejected(message) {
	var newWorker = Object.create(this, {'default_rejected': {value: ignore_rejected}});
	return this.require(this.LOGGER).then(internal_logger.bind([newWorker, message]));
}

// standard local logger, expand by Redpoll only
reserved_tokens[def.LOGGER] = function(message) {
	var now = new Date, msg = message ? Object(message) : { action: 'unknow' }, e = msg.reason;
	var e_stack = msg && msg.reason;
	var header = now.toLocaleDateString() + ' ' + now.toLocaleTimeString() + ' [error] '
		+ (! msg.action ? '' : msg.action)
		+ (! msg.to     ? '' : ' the ' + msg.to)
		+ (! msg.scope  ? '' : ' in ' + msg.scope)
		+ (! msg.task   ? '' : ' at ' + msg.task);
	console.log(header + ', ' + (e && e.stack || e || 'no reason.'))
}

// enter a sub-processes with privated rejected method
function enter(f, rejected) {
	return function() {
		try {
			return Promise.resolve(f.apply(this, arguments)).catch(rejected)
		}
		catch(e) { return rejected(e) }
	}
}

// return rejected message as error reason
function reject_me() {
	return Promise.reject(this.toString())
}

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

function promise_arguments(t) { return t.arguments }
function promise_distributed_task(worker, task) {
	var args = isDistributedTask(task.arguments) ? worker.run(task.arguments).then(promise_arguments) : task.arguments;
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

function pickTaskResult(taskOrder) {
	if (! taskOrder.promised) return taskOrder;
	try { // process by taskDef.promised
		taskResult = taskOrder.promised.call(this, taskOrder);
		return (taskResult === undefined) ? taskOrder : taskResult;
	}
	catch (e) {
		var reason = {reason: e, action: 'taskDef:promised'}, task = taskOrder.taskId || "local task";
		if (taskOrder.taskId) reason.task = taskOrder.taskId;
		return this.default_rejected(reason)
			.then(reject_me.bind("taskDef promised exception '" + e.message + "' at " + task));
	}
}

function kickTaskOrder(reason) {
	var worker = this[0], taskOrder = this[1]
	if (! taskOrder.rejected) return Promise.reject(reason);

	try { // mute by taskDef.rejected
		return taskOrder.rejected.call(worker, reason)
	}
	catch (e) {
		var reason = {reason: reason, action: 'taskDef'};
		var reason2 = {reason: e, action: 'taskDef:rejected'}, task = taskOrder.taskId || "local task";
		if (taskOrder.taskId) reason.task = reason2.task = taskOrder.taskId;
		return Promise.all([this.default_rejected(reason), this.default_rejected(reason2)]
			.then(reject_me.bind("taskDef rejected exception '" + e.message + "' at " + task)));
	}
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
		return Promise.all(promises).then(promise_member_rewrite).then(pickTaskResult.bind(worker));
	}
	else if (order.promised) {
		return Promise.resolve(order).then(pickTaskResult.bind(worker));
	}
}

// executor for Promise() constructor
//		- <this> is prebind array of [worker, taskOrder]
function promise_executor(resolve, reject) {
	var worker = this[0], order = this[1]
	Promise.resolve(promise_static_member(worker, order) || order)
		.catch(kickTaskOrder.bind(this)) // yes, the <this> is prebind array
		.then(resolve, reject)
}

/*********************************************************
 *
 * Interface of distributed tasks
 *
**********************************************************/
var GLOBAL_CACHED_TASKS = {}
GLOBAL_CACHED_TASKS[def.TASK_BLANK] = {};
GLOBAL_CACHED_TASKS[def.TASK_SELF] = {
	promised: function() { return Promise.reject('dont direct execute def.TASK_SELF') }
};
GLOBAL_CACHED_TASKS[def.TASK_RESOURCE] = {
	promised: function(resId) { return this.require(resId) }
};

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

// taskDef is string from http response body
// 		- <this> is prebind array of [worker, taskId]
function distributed_task(taskDef) {
	var worker = this[0], taskId = this[1], taskDef2;

	function replace_task_self(obj) {
		if (typeof(obj) == 'object') {
			for (var key in obj) {
				var value = obj[key];
				if (isDistributedTask(value) && (value.map === worker.TASK_SELF)) {
					value.map = taskId
				}
				else if (value instanceof Array) {
					value.forEach(replace_task_self)
				}
				else replace_task_self(value)
			}
		}
	}

	try {
		taskDef2 = def.decode(taskDef)
	}
	catch (e) {
		return worker.default_rejected({action: 'taskDef:decode', reason: e, task: taskId})
			.then(reject_me.bind("decode exception '" + e.message + "'for downloaded " + taskId));
	}

	// define taskDef.taskId
	Object.defineProperty(taskDef2, "taskId",
		{ "value": taskId, "enumerable": false, "writable": false, "configurable": false });

	// replace TASK_SELF in task.map only, with task.run.arguments.map
	replace_task_self(taskDef2);

	// call taskDef.distributed
	if ('distributed' in taskDef2) {
		try {
			taskDef2.distributed.call(worker, taskDef2)
		}
		catch (e) {
			return worker.default_rejected({action: 'taskDef:distributed', reason: e, task: taskId})
				.then(reject_me.bind("distributed method exception '" + e.message + "'in " + taskId));
		}
	}

	return taskDef2
}

// call task_register_center.download_task(), and cache + preprocess
function internal_download_task(center, taskId) {
	// taskDef is obj, decoded and distributed
	function cached_as_promise(taskDef) {
		return GLOBAL_CACHED_TASKS[this] = Promise.resolve(taskDef);
	}
	return GLOBAL_CACHED_TASKS[taskId] || Promise.resolve(center.download_task(taskId))
		.then(distributed_task.bind([this, taskId]))
		.then(cached_as_promise.bind(taskId));
}

// internal distribution scope praser
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
		: Promise.reject("dynamic scopePart is not support for '"+distributionScope+"'");
}

// internal taskDef executor
//		- <this> is prebind array of [worker, arguments]
function internal_execute_task(taskDef) {
	// var worker = this[0], args = this[1];
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
		['distributed_request', 'default_rejected'].forEach(function(key) {
			if (key in newOptions) this[key] = newOptions[key];
		}, this)
	}

	this.require = function(token) {
		return Promise.resolve(system_route(token) ||
			internal_parse_scope.call(this, options.resource_status_center, token))
	}

	this.execute_task = function(taskId, args) {
		var worker = this;
		function rejected_extract(reason) {
			return worker.default_rejected({reason: reason, action: 'execute', task: taskId})
				.then(reject_me.bind("extract task results fail when execute " + taskId));
		}
		return internal_download_task.call(worker, options.task_register_center, taskId.toString())
			.then(internal_execute_task.bind([worker, args]))
			.then(enter(extractTaskResult, rejected_extract))
	}

	this.register_task = function(task) {
		return Promise.resolve(options.task_register_center.register_task(
			((typeof(task) == 'string') || (task instanceof String)) ? task : def.encode(task)))
	}

	this.upgrade(opt);
}

// -------------------------------------------------------------------------------------------------------
// Distributed processing methods
// 	*) return promise object by these methods
// 	*) MUST: catch error by caller for these interfaces
// -------------------------------------------------------------------------------------------------------
D.prototype = mix(Object.create(def), {
	run: function(task, args) {
		var worker = this, t = typeof(task);
	
		function rejected_arguments(reason) {
			var reason2 = {reason: reason, action: 'run:arguments'};
			if ((t == 'string') || (task instanceof String)) reason2.task = task;
			return worker.default_rejected(reason2)
				.then(reject_me.bind("arguments promise rejected"));
		}
		function rejected_extract(reason) {
			return worker.default_rejected({reason: reason, action: 'run'})
				.then(reject_me.bind("extract task results fail when run local taskObject"));
		}
		function rejected_call(reason) {
			var message = "direct call exception '" + (reason && reason.message || JSON.stringify(reason)) + "'";
			return worker.default_rejected({reason: reason, action: 'run:direct'})
				.then(reject_me.bind(message));
		}

		var promised_args = Promise.resolve(args).catch(rejected_arguments)

		// direct call, or call from promise_distributed_task()
		if (task instanceof Function) return promised_args.then(enter(task.bind(worker), rejected_call));

		// check types
		if ((t == 'string') || (task instanceof String)) {
			return promised_args.then(function(args) {
				return worker.execute_task(task, args)
			})
		}
		else if (t == 'object') { // task as taskObject
			return promised_args.then(function(args) {
				var taskOrder = mix(makeTaskOrder(task), args);
				var executor = promise_executor.bind([worker, taskOrder]);
				return new Promise(executor).then(enter(extractTaskResult, rejected_extract));
			})
		}

		return Promise.reject('unknow task type "' + t + '" in Distributed.run()')
	},

	map: function(distributionScope, taskId, args) {
		var worker = this;
		function rejected_responses(reason) {
			return worker.default_rejected({action: 'map:request', reason: reason, scope: distributionScope, to: taskId})
				.then(reject_me.bind("invalid response from distributed requests"));
		}
		function rejected_scope(reason) {
			return worker.default_rejected({reason: reason, action: 'map:scope', scope: distributionScope, to: taskId})
				.then(reject_me.bind("invalid distribution scope '"+distributionScope+"'"));
		}
		function rejected_arguments(reason) {
			return worker.default_rejected({reason: reason, action: 'map:arguments', scope: distributionScope, to: taskId})
				.then(reject_me.bind("arguments promise rejected"));
		}
		function rejected_extract(reason) {
			return worker.default_rejected({reason: reason, action: 'map', scope: distributionScope, to: taskId})
				.then(reject_me.bind("extract maped task results fail"));
		}
		var scope = worker.require(distributionScope).catch(rejected_scope)
		var args2 = Promise.resolve(args).catch(rejected_arguments)
		return Promise.all([scope, taskId, args2])
			.then(enter(worker.distributed_request, rejected_responses))
			.then(enter(extractMapedTaskResult, rejected_extract))
	},

	distributed_request: invalid_promised_request,
	default_rejected: internal_default_rejected
}, true);


D.infra = {
	taskhelper: def,
	httphelper: require('./infra/httphelper.js'),
	requestdata: require('./infra/requestdata.js')
}

module.exports = D;