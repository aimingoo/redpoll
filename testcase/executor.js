// -------------------------------------------------------------------------------------------------------
// local taskObject - upgrade to executor node
// -------------------------------------------------------------------------------------------------------
var request_parse = require('../infra/requestdata.js').parse;
var events = require('events');
var conf = {
	nodeAddr: '127.0.0.1:8032',
	executePath: '/redpoll/execute_',
	actions: new events.EventEmitter()
}

var emitter = function(args) { this.emit.apply(this, args) }
var err = function(e) { console.log(e.stack||e) };

// success and response of execute_task
var success = function(taskResult) {
	this.setHeader("Content-Type", 'application/json');
	this.write(JSON.stringify(taskResult));
	this.end();
};

// fail of execute_task
//	> # show error stack at bash
//	> curl -s '.../execute_task:c2eb2597e461aa3aa0e472f52e92fe0b' | jq '.reason' | xargs echo -e
var ERR_HTTP_HEADER = {"Content-Type": 'application/json'}
var error = function(reason) {
	var reason = reason || {}
	this.writeHead(500, ERR_HTTP_HEADER);
	this.write(JSON.stringify({error: 500, reason: reason.stack || reason.message || JSON.stringify(reason)}));
	this.end()
};

var rx_execute_task = new RegExp('^'+conf.executePath), rx_len = conf.executePath.length;
var taskObject = {
	unlimited: { run: function() {
		// httpd
		var url = require("url"), actions = conf.actions;
		var port = parseInt(conf.nodeAddr.split(':')[1] || '8032');
		require("http").createServer(function(request, response) {
			var urlObject = url.parse(request.url);
			if (! urlObject.pathname.match(rx_execute_task)) return actions.emit('error', 404);
			// path routes
			var taskId = urlObject.pathname.substr(rx_len),
				params = request_parse(request);
			Promise.all(["execute_task", request, response, taskId, params])
				.then(emitter.bind(actions)).catch(err);
		}).listen(port);

		// handles
		actions.on("error", err);
		actions.on("execute_task", function(_, response, taskId, args) {
			n4c.execute_task(taskId, args)
				.then(success.bind(response))
				.catch(error.bind(response));
		});

		// value of taskObject.unlimited
		return true
	}}
}

module.exports = taskObject;