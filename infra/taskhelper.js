// ---------------------------------------------------------------------------------------------------------
// -- Distributed task helper
// -- Author: aimingoo@wandoujia.com
// -- Copyright (c) 2015.09
// --
// -- Note:
// --	*) a interfaces of task define helper.
// --	*) encode/decode fields for local supported object, from/to JSON compatible field types.
// ---------------------------------------------------------------------------------------------------------
var base64_decode = function(enc) { return new Buffer(enc, 'base64').toString('utf8') }
var base64_encode = function(str) { return new Buffer(str).toString('base64') }

var encode_task_fields = function(obj) {
	var taskDef = {}, jsonValues = {'string': true, 'boolean': true, 'number': true}

	function isValueObject(obj) { return (obj instanceof Number) || (obj instanceof String) || (obj instanceof Boolean) || (obj === null) }
	function isFunction(name) {return typeof(this[name]) == 'function'}
	function isObject(name) {return (typeof(this[name]) == 'object') && !isValueObject(this[name])}
	function isValue(name) {return (typeof(this[name]) in jsonValues) || isValueObject(this[name])}

	var pickResult = new Function('name', 'return this[name]').bind(obj);
	var prefix = 'script:javascript:base64:';
	var clone_value = function(name) { this[name] = (pickResult(name) !== null) ? pickResult(name).valueOf() : null }
	var clone_object = function(name) { this[name] = encode_task_fields(pickResult(name)) }
	var encode_func = function(name) { this[name] = prefix + base64_encode(pickResult(name).toString()) }
	var keys = Object.keys(obj);
	keys.filter(isObject, obj).forEach(clone_object, taskDef);
	keys.filter(isValue, obj).forEach(clone_value, taskDef);
	keys.filter(isFunction, obj).forEach(encode_func, taskDef);
	return taskDef
}

function decode_task_fields(taskDef) {
	function isObject(name) {return typeof(this[name]) == 'object'}
	function isString(name) {return typeof(this[name]) == 'string'}

	var pickResult = new Function('name', 'return this[name]').bind(taskDef);
	function rewrite_string(name) {
		var value = pickResult(name), m = value.match(/^((?:[^:]+:){2})([^:]+:){0,1}/);
		if (m) switch (m[1].toLowerCase()) {
			case 'script:javascript:':
				var script = value.substr(m[0].length);
				if (m[2] == 'base64:') {
					script = base64_decode(script)
				}
				else if (m[2] != '') {
					throw new Error('script resolved but encode type unknow.')
				}
				try {
					// "require" is faked global variant!!!
					//	- the require() basePath at directory of taskhelper.js
					this[name] = (new Function('require', 'return ' + script))(require)
				}
				catch(e) {
					throw new Error('script load error, ' + e.message)
				}
				break;

			case 'data:base64:':
				var str = value.substr(m[0].length);
				this[name] = base64_decode(str)
				break;

			default:
				throw new Error('unknow string prefix: ' + m[0])
				break;
		}
	}

	var keys = Object.keys(taskDef);
	keys.filter(isObject, taskDef).map(pickResult).forEach(decode_task_fields);
	keys.filter(isString, taskDef).forEach(rewrite_string, taskDef);
	return taskDef
}


module.exports = {
	version: '1.1',

	encode: function(task) {
		return JSON.stringify(encode_task_fields(task))
	},

	decode: function(taskDef) {
		return decode_task_fields(JSON.parse(taskDef))
	},

	run: function(task, args) {
		return { run: task, arguments: args }
	},

	map: function(distributionScope, task, args) {
		return { map: task, scope: distributionScope, arguments: args}
	},

	reduce: function(distributionScope, task, args, reduce) {
		return !reduce ? this.run(args, this.map(distributionScope, task)) // args as reduce
			: this.run(reduce, this.map(distributionScope, task, args))
	},

	daemon: function(distributionScope, task, daemon, deamonArgs) {
		return this.map(distributionScope, task, this.run(daemon, deamonArgs))
	}
}