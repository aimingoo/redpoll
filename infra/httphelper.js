var request = require('request');
var querystring = require('querystring');

function asQueryString(args) {
	return ((typeof(query.args) == 'string') || (query.args instanceof String)) ? args.toString() 
		: querystring.stringify(args);
}

function asRequest(query) {
	if (! query) return {};

	if (typeof(query) == 'object') {
		if (query instanceof String) return { args: query.toString() };
		if ('args' in query) {
			if ('data' in query) {
				query.args = asQueryString(query.args);
			}
			else {
				var headers = query.headers || {};
				if (!('headers' in query)) query.headers = headers;
				if (!('Content-Type' in headers)) { // reset to default
					headers["Content-Type"] = "application/x-www-form-urlencoded";
				}
				if (headers["Content-Type"].toLowerCase() == "application/json") {
					if ((typeof(query.args) == 'string') ||
						(query.args instanceof String)) {
						query.data = JSON_encode(querystring.parse(query.args));
					}
					else {
						query.data = JSON_encode(query.args);
					}
				}
				else {
					query.data = asQueryString(query.args);
				}
				query.args = undefined;
				query.method = "post"
				return query
			}
		}
		if ('method' in query) {
			query.method = query.method.toString().toLowerCase()
		}
		return query
	}

	return (typeof(query) != 'string') ? query
		: { args: query.toString() };
}

function find_separator(url) {
	return (url.lastIndexOf('?') == -1) ? '?' : '&';
}

// url is request prefix, maped from distributionScope
// 		- <this> is parament array, ex: [taskId, querystring || queryobject]
function promisedRequest(url) {
	var taskId = this[0], req = Object.create(this[1]);
	var method = req.method || 'get';

	if ('args' in req) {
		req.url = url + taskId + find_separator(url) + req.args
	}
	else {
		req.url = url + taskId
	}

	return new Promise(function(resolve, reject) {
		return request[method](req, function(err, response, body) {
			return err ? reject({error: err, headers: response && response.headers})
				: resolve({body: body, headers: response.headers});
		});
	});
}

function asQuery(obj) {
	return (!(obj.method || obj.data) ? querystring.stringify(obj)
		: ((obj.method && (obj.method.toString().toUpperCase() == 'GET')) ? querystring.stringify(obj.vars || {})
		: obj));
}

function distributed_request(arrResult) {
	var URLs = arrResult[0], taskId = arrResult[1], args = arrResult[2];
	var query = args && asQuery(args);
	return Promise.all(URLs.map(promisedRequest.bind([taskId, asRequest(query)])))
}

module.exports = {
	distributed_request: distributed_request
}