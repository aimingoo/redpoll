// -------------------------------------------------------------------------------------------------------
// simple demo as executor node
//
// Usage:
//	> node testcase/t_executor.js
//	> curl -s 'http://127.0.0.1:8032/redpoll/execute_task:c2eb2597e461aa3aa0e472f52e92fe0b'
// -------------------------------------------------------------------------------------------------------
var log = console.log.bind(console);
var err = function(e) { console.log('=>', e.stack||e) };

// pedt with simple register_center
var PEDT = require('../Distributed.js');
var def = PEDT.infra.taskhelper;
var pedt = new PEDT({
 	task_register_center: require('../infra/dbg_register_center.js'),
	distributed_request: require('../infra/httphelper.js').distributed_request
});

// yes, the n4c is upgraded pedt, it's global reference
var localTaskObject = require('./executor.js');
var conf = {remote_logger_scope: 'n4c:/a/b/c/logger/nodes:*'};
n4c = pedt

// main()
// - register a task at current node
function localTask(args) {
	console.log('[INFO] arguments for loacalTask: ', args)
	return "HELLO"
}
var reged_task = Promise.all([
	pedt.register_task(def.encode({
		p1: 'default value',
		info: def.run(localTask, {p1: 'new value'})
	})),
	pedt.register_task('{}'), // task_blank
	pedt.register_task(def.encode({promised: function(taskResult){return this.run(this.decode(this.encode(taskResult)))}})) // task_runner
]);

// - upgrade and/or reset logger
function set_remote_logger(taskId) {
	pedt.upgrade({ system_route: {
		[pedt.LOGGER]: function(message) {  // a new remote logger
			return this.map(conf.remote_logger_scope, taskId, {message: JSON.stringify(message)});
		}
	}})
	return taskId
}
var pedt_upgrade = Promise.all([
	// pedt.upgrade({ system_route: {[pedt.LOGGER]: Promise.resolve(false)}}),
	// pedt.upgrade({ default_rejected: Promise.reject.bind(Promise) })
	// pedt.register_task(def.encode({promised: function(r){console.log(r.message); return true}})).then(set_remote_logger) // task_logger
]);

// - upgrade to unlimited
var init_unlimited = pedt.run(localTaskObject);

// - Done
var worker = Promise.all([reged_task, pedt_upgrade, init_unlimited])
worker.then(function(results) {
	console.log('Current node started and unlimited: ', results[2].unlimited)
	console.log('supported tasks:')
	console.log(results[0])
	console.log('Done.')

//	require('../infra/dbg_register_center.js').report()
}).catch(err);
