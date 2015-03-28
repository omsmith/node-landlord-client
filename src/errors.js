'use strict';

var util = require('util');

function TenantNotFoundError (host) {
	this.name = 'TenantNotFoundError';
	this.message = 'Tenant not found for host "' + host + '"';

	Error.captureStackTrace(this, this.constructor);
}
util.inherits(TenantNotFoundError, Error);

function TenantLookupFailedError (inner) {
	this.name = 'TenantLookupFailedError';
	this.message = 'Tenant lookup failed';
	this.inner = inner;

	if (inner && inner.stack) {
		this.stack = inner.stack;
	} else {
		Error.captureStackTrace(this, this.constructor);
	}
}
util.inherits(TenantLookupFailedError, Error);

module.exports = {
	TenantNotFound: TenantNotFoundError,
	TenantLookupFailed: TenantLookupFailedError
};
