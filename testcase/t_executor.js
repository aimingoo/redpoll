// -------------------------------------------------------------------------------------------------------
// simple demo as executor node
//
// Usage:
//	> node testcase/t_executor.js
//	> curl -s 'http://127.0.0.1:8032/redpoll/execute_task:c2eb2597e461aa3aa0e472f52e92fe0b'
// -------------------------------------------------------------------------------------------------------
var log = console.log.bind(console);
var err = function(e) { console.log(e.stack||e) };

// pedt with simple register_center
var PEDT = require('../Distributed.js');
var def = PEDT.infra.taskhelper;
var pedt = new PEDT({
 	task_register_center: require('../infra/dbg_register_center.js'),
	distributed_request: require('../infra/httphelper.js').distributed_request
});

// yes, the n4c is upgraded pedt, it's global reference
var localTaskObject = require('./executor.js')
n4c = pedt

// main()
// - register a task at current node
function localTask(args) {
	console.log('[INFO] arguments for loacalTask: ', args)
	return "HELLO"
}
var reged_task = pedt.register_task(def.encode({
	p1: 'default value',
	info: def.run(localTask, {p1: 'new value'})
}))

// - upgrade to unlimited
var init_unlimited = pedt.run(localTaskObject).catch(err)

// - Done
var worker = Promise.all([reged_task, init_unlimited])
worker.then(function(results) {
	console.log('Current node started and unlimited: ', results[1].unlimited)
	console.log(' - ', results[0], 'supported')
	console.log('Done.')
}).catch(err);