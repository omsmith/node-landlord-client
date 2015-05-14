'use strict';

var inherits = require('util').inherits,
	LRU = require('lru-cache');

var AbstractLandlordCache = require('./abstract-cache');

function LRULandlordCache () {
	if (!(this instanceof LRULandlordCache)) {
		return new LRULandlordCache();
	}

	AbstractLandlordCache.call(this);

	this._lru = new LRU({
		max: 7500,
		length: function (n) {
			return n.length;
		}
	});
}
inherits(LRULandlordCache, AbstractLandlordCache);

LRULandlordCache.prototype._get = function get (key) {
	return this._lru.get(key);
};

LRULandlordCache.prototype._set = function set (key, value, maxAge) {
	return this._lru.set(key, value, maxAge * 1000);
};

module.exports = LRULandlordCache;
