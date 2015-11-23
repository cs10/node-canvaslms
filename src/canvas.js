/** canvas.js
 *      Desc. TODO
 *
 *  Author: Michael Ball
 */
'use strict';

var url     = require('url');
var format  = require('util').format;

var request = require('request');


function Canvas(host, token, options) {
    options = options || {};

    // Handle Default arguments.
    if (typeof host == 'object') {
        options = host;
        host = options.host;
        token = options.token;
    } else if (typeof token == 'object') {
        options = token;
        token = options.token;
    }

    if (!host) {
        throw new CanvasError('A Canvas instance requires a host',
            `Expected a URL but found ${host}.`);
    }

    if (host.indexOf('https') != 0) {
        throw new CanvasError(`Hosts must use https://, found ${host}`);
    }


    this.name = 'canvas' || options.name;
    this.accessToken = options.token || '';
    this.apiVersion = options.version || 'v1';
    this.host = host;
    this.options = options;
}


Canvas.prototype._buildApiUrl = function (endpoint) {
    if (endpoint.substring[0] != '/') {
        endpoint = '/' + endpoint;
    }
    return url.resolve(this.host,  '/api/' + this.apiVersion + endpoint);
};

Canvas.prototype._http = function (method, args) {
    var options = {
        method: method,
        url: this._buildApiUrl(args.endpoint),
        qs: args.query,
        // Defaults:
        headers: {
            Authorization: 'Bearer ' + this.accessToken
        },
        json: true,
        useQuerystring: true
    }

    //TODO: Can this be null on get requests?
    if (args.form) {
        options.form = args.form;
    }
    return request(options, args.cb);
};


// Primitive HTTP methods.
// These are just wrappers around _http with the proper method applied.
Canvas.prototype.get = function (endpoint, query, cb) {
    return this._http('GET', defaultArguments(endpoint, query, cb));
};

Canvas.prototype.post = function (endpoint, query, form, cb) {
    return this._http('POST', defaultArguments(endpoint, query, form, cb));
};

Canvas.prototype.put = function (endpoint, query, form, cb) {
    return this._http('PUT', defaultArguments(endpoint, query, form, cb));
};

Canvas.prototype.delete = function (endpoint, query, cb) {
    return this._http('DELETE', defaultArguments(endpoint, query, cb));
};

// Canvas LMS Specific Methods
Canvas.prototype.allPages = function (endpoint, query, cb, prevData) {
    // TODO: verify that paginated content will always be arrayed.
    var prevData = prevData || [],
        myself = this;
    this.get(endpoint, query, function(error, resp, body) {
        var query = {}, linkHeaders;
        if (error || body.errors) {
            // TODO: body + prev data?
            cb(error, resp, body);
        }
        linkHeaders = parseLinkHeaders(resp.headers.link);
        if (linkHeaders.next) {
            // Note: this is throwing an error in some cases...
            query = url.parse(linkHeaders.next).query;
            myself.allPages(endpoint, query, cb, body + prevData);
        } else {
            // TODO: verify this concatentation works...
            cb(error, resp, body + prevData);
        }
    });
};

// Error Handling
function CanvasError(args) {
    var msg = format.apply(null, this.arguments);
    msg.name = 'Canvas Error'
    return this.uber(msg);
}

CanvasError.prototype = Object.create(Error.prototype);
CanvasError.uber = Error;

// Utility Functions -- not exported
function defaultArguments(endpoint, query, form, cb) {
    // normalize based on whether form exists.
    // in GET/DELETE "form" will be a callback if query is provided.
    if (arguments.length == 3) {
        cb = form;
        form = null;
    }

    if (typeof query == 'function') {
        cb = query;
        query = {};
    }

    if (cb.length != 3) {
        throw new CanvasError(func.name + ': callback function should have 3' +
                    ' parameters, but had ' + cb.length + '.');
    }

    return {
        endpoint: endpoint,
        query: query,
        form: form,
        cb: cb
    };
}

/** parseLinkHeaders - get an object from a canvas header string
 *  Canvas returns link headers as a fat, annoying string:
 *  <url>; rel="type",<url>; rel="type"...
 *  See: https://bcourses.berkeley.edu/doc/api/file.pagination.html
 *  @param {string} the link field from a request header
 *  @return {object} a mapping of rel-value: url

    // TODO: Use these to build an object
    // could make it easier to check if a paramter exists?
    allowedRel = [
        'current',
        'next',
        'prev',
        'first',
        'last'
    ];
 */
function parseLinkHeaders(linkStr) {
    var formatRE, match, allowedRel, output = {};
    formatRE = /<(.*?)>;\s+rel="(\w+)",?/gi;

    match = formatRE.exec(linkStr);
    while (match != null) {
        if (match.length > 2) {
            output[match[2]] = match[1];
        }
        match = formatRE.exec(linkStr);
    }
    return output;
}

module.exports = Canvas;
