// ---------------------------------------------------------------------------------------------------------
// -- Distributed request arguments helper
// -- Author: aimingoo@wandoujia.com
// -- Copyright (c) 2015.09
// --
// -- parse request body_data and merge into search arguments object
// ---------------------------------------------------------------------------------------------------------
var url = require("url"),
	querystring = require('querystring');

// null as valueObject
function isValueObject(obj) {
	return (obj instanceof Number) || (obj instanceof String) || (obj instanceof Boolean) || (obj === null);
}
// the mix() for JSON object only
function mix(self, ref) {
	if (ref === undefined) return self;
	if ((typeof(ref) != 'object') || (typeof(self) != 'object') || isValueObject(self)) return ref;
	Object.keys(ref).forEach(function(key) { self[key] = mix(self[key], ref[key]) });
	return self;
}
// decoder will bind <this>
var decoder = {
	"application/json": function(dataString) {
		return mix(this, JSON.parse(dataString));
	},

	"application/x-www-form-urlencoded": function(dataString) {
		dataString.split("&").forEach(function(field) {
			field = field.split("=");
			this[field[0]] = decodeURIComponent(field[1]);
		}, this);
		return this
	}
}
var defaultContentType = "application/x-www-form-urlencoded";
var defaultDecoder = decoder[defaultContentType];

module.exports = {
	parse: function(request) {
		var urlObject = url.parse(request.url);
		var obj = querystring.parse(urlObject.query);
		if (request.method == 'GET') return Promise.resolve(obj);

		var contentType = (request.headers && request.headers['content-type'] || defaultContentType).toLowerCase();
		var promise = new Promise(function(resolve, reject) {
			var postData = "";
			request.on('data', function(data) { postData += data });
			request.on('end', function() { resolve(postData.toString()) });
		})
		return promise.then((decoder[contentType] || defaultDecoder).bind(obj))
	}
}