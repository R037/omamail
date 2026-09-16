.pragma library

// A bounded, recency-ordered cache of what `Html.sanitize` did with a
// message's HTML, kept only in memory. The disk cache remembers a message's
// bytes; it has no opinion on what Qt should draw for them, so revisiting a
// message stepped away from moments ago used to mean asking Html.js the same
// question again — the one cost opening an already-cached message still had
// left once decoding stopped being it. Twelve messages of headroom is a few
// megabytes at the top of what a real inbox sends, against the one tree this
// already keeps regardless: whatever is on screen right now.
//
// Pure and immutable, on the same grounds `cache/Cache.js` already is: the
// caller holds this in a property, and a reassignment is what makes "what is
// cached right now" one inspectable value rather than something mutated out
// from under whoever else is holding it.

var DEFAULT_MAX_ENTRIES = 12

function empty() {
  return { order: [], entries: {} }
}

// The one thing worth getting right: two calls that mean the same question —
// the same markup, asked to be read the same way — have to land on the same
// key, and nothing else may. `withPlainText` changes what `Html.sanitize`
// computes, so it is part of the question; remote images are not, because a
// render with them allowed is never the one this is asked to remember — see
// the caller.
function key(source, withPlainText) {
  return (withPlainText ? "1" : "0") + String(source || "")
}

function get(store, cacheKey) {
  var entries = store && store.entries ? store.entries : {}
  if (!Object.prototype.hasOwnProperty.call(entries, cacheKey)) return undefined
  return entries[cacheKey]
}

// A hit is a use: the entry that answered moves to the front, so the next
// eviction takes whichever entry nobody has asked for in longest rather than
// whichever happened to be written first.
function touch(store, cacheKey) {
  var order = store && store.order ? store.order : []
  var at = order.indexOf(cacheKey)
  if (at < 0) return store
  var reordered = order.slice(0, at).concat(order.slice(at + 1))
  reordered.push(cacheKey)
  return { order: reordered, entries: store.entries }
}

function put(store, cacheKey, value, maxEntries) {
  var limit = Math.max(1, Math.floor(maxEntries || DEFAULT_MAX_ENTRIES))
  var order = (store && store.order ? store.order : []).filter(function(k) { return k !== cacheKey })
  order.push(cacheKey)
  var entries = {}
  var previous = store && store.entries ? store.entries : {}
  for (var k in previous) entries[k] = previous[k]
  entries[cacheKey] = value
  while (order.length > limit) delete entries[order.shift()]
  return { order: order, entries: entries }
}
