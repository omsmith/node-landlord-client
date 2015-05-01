'use strict';

var Promise = require('bluebird'),
	request = require('superagent');

var errors = require('./errors');

var DEFAULT_LANDLORD_URI = 'http://landlord-dev.desire2learnvalence.com';

function LandlordClient (opts) {
	if (!(this instanceof LandlordClient)) {
		return new LandlordClient(opts);
	}

	opts = opts || {};

	this._landlord = opts.endpoint || DEFAULT_LANDLORD_URI;
}

LandlordClient.prototype.lookupTenantId = function lookupTenantId (host) {
	var self = this;

	return new Promise(function (resolve, reject) {
		if ('string' !== typeof host || 0 === host.length) {
			reject(new Error('host must be a valid string'));
		}

		request
			.get(self._landlord + '/v1/tenants')
			.query({
				domain: host
			})
			.end(function (err, res) {
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

				resolve(tenantId);
			});
	});
};

LandlordClient.prototype._lookupTenantInfo = function lookupTenantInfo (tenantId) {
	var self = this;

	return new Promise(function (resolve, reject) {
		if ('string' !== typeof tenantId) {
			reject(new Error('tenantId must be a valid string'));
		}

		request
			.get(self._landlord + '/v1/tenants/' + tenantId)
			.set('Authorization', 'REDACTED-landlord-dev-key')
			.end(function (err, res) {
				if (err) {
					if (res && res.status === 404) {
						reject(new errors.TenantIdNotFound(tenantId));
					} else {
						reject(new errors.TenantLookupFailed(err));
					}

					return;
				}

				var tenantInfo = res.body;

				if ('object' !== typeof tenantInfo || !tenantInfo.hasOwnProperty('domain') || !tenantInfo.hasOwnProperty('isHttpSite')) {
					reject(new errors.TenantLookupFailed());
					return;
				}

				resolve(tenantInfo);
			});
	});
};

LandlordClient.prototype.lookupTenantHost = function lookupTenantHost (tenantId) {
	return this._lookupTenantInfo(tenantId)
		.then(function (tenantInfo) {
			return tenantInfo.domain;
		});
};

LandlordClient.prototype.lookupTenantUrl = function lookupTenantUri (tenantId) {
	return this._lookupTenantInfo(tenantId)
		.then(function (tenantInfo) {
			var protocol = tenantInfo.isHttpSite ? 'http' : 'https';
			return protocol + '://' + tenantInfo.domain + '/';
		});
};

module.exports = LandlordClient;
module.exports.errors = errors;
