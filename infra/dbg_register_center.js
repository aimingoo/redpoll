// ------------------------------------------------------------------------------------
// -- a register center for debug/demo only
// ------------------------------------------------------------------------------------
var crypto = require('crypto');
var MD5 = function (str) {
	var md5sum = crypto.createHash('md5');
	md5sum.update(str);
	return md5sum.digest('hex');
}

var dbg_storage = {};

var dbg_register_center = {
	download_task: function(taskId) {
		return Promise.resolve(dbg_storage[taskId.replace(/^task:/, "")]
			|| Promise.reject('Cant find ' + taskId));
	},
	register_task: function(taskDef) {
		var id = MD5(taskDef.toString());
		dbg_storage[id] = taskDef;
		return Promise.resolve('task:' + id);
	},

	// statistics only
	report: function(){
		console.log('=============================================')
		console.log('OUTPUT dbg_storage');
		console.log('=============================================')
		Object.keys(dbg_storage).forEach(function(key) {
			console.log('==> '+key)
			console.log(JSON.stringify(JSON.parse(dbg_storage[key]), null, '\t'))
		})
	}
}

module.exports = dbg_register_center;