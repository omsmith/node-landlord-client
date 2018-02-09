'use strict';

var http = require('http'),
	https = require('https'),
	url = require('url');

var parseCacheControl = require('parse-cache-control'),
	request = require('superagent');

var AbstractLandlordCache = require('./abstract-cache'),
	errors = require('./errors'),
	LRULandlordCache = require('./lru-cache');

var DEFAULT_LANDLORD_URI = 'https://landlord.brightspace.com';
var USER_AGENT = 'node-landlord-client/' + require('../package.json').version;

function LandlordClient(opts) {
	if (!(this instanceof LandlordClient)) {
		return new LandlordClient(opts);
	}

	opts = opts || {};

	this._cache = opts.cache || new LRULandlordCache();
	if (!(this._cache instanceof AbstractLandlordCache)) {
		throw new Error('"opts.cache" must be an instance of AbstractLandlordCache if provided');
	}

	if (opts.name) {
		if (typeof opts.name !== 'string') {
			throw new TypeError('"opts.name" must be a String if provided');
		}

		this._userAgent = opts.name + ' (' + USER_AGENT + ')';
	} else {
		this._userAgent = USER_AGENT;
	}

	this._landlord = opts.endpoint || DEFAULT_LANDLORD_URI;

	this._agent = url.parse(this._landlord).protocol === 'https:'
		? new https.Agent({ keepAlive: true })
		: new http.Agent({ keepAlive: true });

	this._inflightSearches = new Map();
	this._inflightFetches = new Map();
}

LandlordClient.prototype.lookupTenantId = /* @this */ function lookupTenantId(host) {
	var self = this;

	if ('string' !== typeof host || 0 === host.length) {
		return Promise.reject(new Error('host must be a valid string'));
	}

	if (this._inflightSearches.has(host)) {
		return this._inflightSearches.get(host);
	}

	var search = self
		._cache
		.getTenantIdLookup(host)
		.catch(function() {
			return new Promise(function(resolve, reject) {
				request
					.get(self._landlord + '/v1/tenants')
					.agent(self._agent)
					.set('User-Agent', self._userAgent)
					.query({
						domain: host
					})
					.end(function(err, res) {
						if (err) {
							reject(new errors.TenantLookupFailed(err));
							return;
						}

						var tenants = res.body;

						if (!Array.isArray(tenants)) {
							reject(new errors.TenantLookupFailed());
							return;
						}

						if (0 === tenants.length) {
							reject(new errors.TenantNotFound(host));
							return;
						}

						var tenantInfo = tenants[0];

						if ('object' !== typeof tenantInfo || !tenantInfo.hasOwnProperty('tenantId')) {
							reject(new errors.TenantLookupFailed());
							return;
						}

						var tenantId = tenantInfo.tenantId;

						var result = self
							._cache
							.cacheTenantIdLookup(host, tenantId)
							.catch(function() {})
							.then(function() { return tenantId; });

						resolve(result);
					});
			});
		});

	this._inflightSearches.set(host, search);
	function clearInflight() {
		self._inflightSearches.delete(host);
	}
	search.then(clearInflight, clearInflight);

	return search;
};

LandlordClient.prototype._lookupTenantInfo = function lookupTenantInfo(tenantId) {
	var self = this;

	if (this._inflightFetches.has(tenantId)) {
		return this._inflightFetches.get(tenantId);
	}

	var fetch = new Promise(function(resolve, reject) {
		if ('string' !== typeof tenantId) {
			reject(new Error('tenantId must be a valid string'));
		}

		request
			.get(self._landlord + '/v1/tenants/' + tenantId)
			.agent(self._agent)
			.set('User-Agent', self._userAgent)
			.end(function(err, res) {
				if (err) {
					if (res && res.status === 404) {
						reject(new errors.TenantIdNotFound(tenantId));
					} else {
						reject(new errors.TenantLookupFailed(err, tenantId));
					}

					return;
				}

				var tenantInfo = res.body;

				if ('object' !== typeof tenantInfo || !tenantInfo.hasOwnProperty('domain') || !tenantInfo.hasOwnProperty('isHttpSite')) {
					reject(new errors.TenantLookupFailed({}, tenantId));
					return;
				}

				tenantInfo.domain = tenantInfo.domain.replace(/\/+$/g, '');

				var cacheControl = parseCacheControl(res.headers['cache-control']);
				tenantInfo._maxAge = null !== cacheControl
					? cacheControl['max-age']
					: null;

				resolve(tenantInfo);
			});
	});

	this._inflightFetches.set(tenantId, fetch);
	function clearInflight() {
		self._inflightFetches.delete(tenantId);
	}
	fetch.then(clearInflight, clearInflight);

	return fetch;
};

LandlordClient.prototype.lookupTenantUrl = function lookupTenantUri(tenantId) {
	var self = this;

	function doAndCacheLookup() {
		return self
			._lookupTenantInfo(tenantId)
			.then(function(tenantInfo) {
				var protocol = tenantInfo.isHttpSite ? 'http' : 'https';
				var url = protocol + '://' + tenantInfo.domain + '/';

				if (null !== tenantInfo._maxAge) {
					return self
						._cache
						.cacheTenantUrlLookup(tenantId, url, self._clock() + tenantInfo._maxAge)
						.catch(function() {})
						.then(function() { return url; });
				}

				return url;
			});
	}

	return self
		._cache
		.getTenantUrlLookup(tenantId)
		.then(function(value) {
			var url = value.url;

			if (value.expiry <= self._clock()) {
				return doAndCacheLookup()
					.catch(function() {
						return url;
					});
			}

			return url;
		}, doAndCacheLookup);
};

LandlordClient.prototype.validateConfiguration = function validateConfiguration() {
	var self = this;
	return new Promise(function(resolve, reject) {
		request
			.get(self._landlord + '/ping')
			.agent(self._agent)
			.end(function(err/*, res*/) {
				if (err) {
					reject(new errors.LandlordNotAvailable(self._landlord, err));
					return;
				}
				resolve('OK');
			});

	});
};

LandlordClient.prototype._clock = function clock() {
	return Math.round(Date.now() / 1000);
};

module.exports = LandlordClient;
module.exports.AbstractLandlordCache = AbstractLandlordCache;
module.exports.errors = errors;
module.exports.LRULandlordCache = LRULandlordCache;
