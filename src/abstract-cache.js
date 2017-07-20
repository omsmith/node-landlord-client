'use strict';

var inherits = require('util').inherits,
	promised = require('promised-method');

function ValueLookupFailed(inner) {
	this.name = 'ValueLookupFailed';
	this.message = 'Value lookup failed';
	this.inner = inner;
}
inherits(ValueLookupFailed, Error);

function noop() {}

function AbstractLandlordCache() {}

AbstractLandlordCache.prototype.getTenantIdLookup = promised(/* @this */ function getTenantIdLookup(host) {
	if ('string' !== typeof host) {
		throw new Error('"host" must be a String');
	}

	if ('function' !== typeof this._get) {
		throw new ValueLookupFailed();
	}

	var key = this._buildTenantIdLookupKey(host);

	return Promise
		.resolve(this._get(key))
		.catch(function(err) {
			err = new ValueLookupFailed(err);
			throw err;
		})
		.then(function(tenantId) {
			if ('string' !== typeof tenantId) {
				throw new ValueLookupFailed();
			}

			return tenantId;
		});
});

AbstractLandlordCache.prototype.cacheTenantIdLookup = promised(/* @this */ function cacheTenantIdLookup(host, tenantId) {
	if ('string' !== typeof host) {
		throw new Error('"host" must be a String');
	}

	if ('string' !== typeof tenantId) {
		throw new Error('"tenantId" must be a UUID');
	}

	if ('function' !== typeof this._set) {
		return;
	}

	var key = this._buildTenantIdLookupKey(host);

	return Promise
		.resolve(this._set(key, tenantId, Infinity))
		.then(noop);
});

AbstractLandlordCache.prototype._buildTenantIdLookupKey = function buildTenantIdLookupKey(host) {
	return 'host-tid|' + host;
};

AbstractLandlordCache.prototype.getTenantUrlLookup = promised(/* @this */ function getTenantUrlLookup(tenantId) {
	if ('string' !== typeof tenantId) {
		throw new Error('"tenantId" must be a UUID');
	}

	if ('function' !== typeof this._get) {
		throw new ValueLookupFailed();
	}

	var key = this._buildTenantUrlLookupKey(tenantId);

	return Promise
		.resolve(this._get(key))
		.catch(function(err) {
			err = new ValueLookupFailed(err);
			throw err;
		})
		.then(function(url) {
			if ('string' !== typeof url) {
				throw new ValueLookupFailed();
			}

			return url;
		});
});

AbstractLandlordCache.prototype.cacheTenantUrlLookup = promised(/* @this */ function cacheTenantUrlLookup(tenantId, url, maxAge) {
	if ('string' !== typeof tenantId) {
		throw new Error('"tenantId" must be a UUID');
	}

	if ('string' !== typeof url) {
		throw new Error('"url" must be a String');
	}

	if ('number' !== typeof maxAge) {
		throw new Error('"maxAge" must be a Number');
	}

	if ('function' !== typeof this._set) {
		return;
	}

	var key = this._buildTenantUrlLookupKey(tenantId);

	return Promise
		.resolve(this._set(key, url, maxAge))
		.then(noop);
});

AbstractLandlordCache.prototype._buildTenantUrlLookupKey = function buildTenantUrlLookupKey(tenantId) {
	return 'tid-url|' + tenantId;
};

module.exports = AbstractLandlordCache;
