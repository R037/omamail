const assert = require("assert")
const { load, deepEqual } = require("./load")

const cache = load("cache/RenderCache.js")

// ---------------------------------------------------------------- the key
//
// The question a render answers is "this markup, read this way" — nothing
// about remote images belongs in it, because a render with them allowed never
// goes through this cache at all.

assert.strictEqual(cache.key("<p>a</p>", false), cache.key("<p>a</p>", false))
assert.notStrictEqual(cache.key("<p>a</p>", false), cache.key("<p>a</p>", true),
  "withPlainText changes what Html.sanitize computes, so it is part of the question")
assert.notStrictEqual(cache.key("<p>a</p>", false), cache.key("<p>b</p>", false))
assert.notStrictEqual(cache.key("<p>a</p>", false, false), cache.key("<p>a</p>", false, true),
  "the blocked render and the one holding boxes for pictures are two answers")
assert.strictEqual(cache.key("<p>a</p>", false), cache.key("<p>a</p>", false, false),
  "and not saying is blocked")

// --------------------------------------------------------------- hit / miss

{
  var store = cache.empty()
  assert.strictEqual(cache.get(store, cache.key("x", false)), undefined,
    "nothing answers before anything was put")

  store = cache.put(store, "a", { html: "A" }, 3)
  deepEqual(cache.get(store, "a"), { html: "A" })
  assert.strictEqual(cache.get(store, "missing"), undefined)
}

// ------------------------------------------------------------- immutability
//
// Every call hands back a new store rather than changing the one it was
// given, on the same grounds every other cache in this codebase does.

{
  var before = cache.put(cache.empty(), "a", { html: "A" }, 3)
  var after = cache.put(before, "b", { html: "B" }, 3)
  assert.strictEqual(cache.get(before, "b"), undefined,
    "the store put() was called on does not gain the new entry")
  deepEqual(cache.get(after, "a"), { html: "A" }, "and keeps the old one")
  deepEqual(cache.get(after, "b"), { html: "B" })
}

// -------------------------------------------------------------- eviction
//
// Past the limit, the entry nobody has asked for in longest is the one that
// goes — not necessarily the one written first, because a hit is a use.

{
  var store = cache.empty()
  store = cache.put(store, "a", 1, 3)
  store = cache.put(store, "b", 2, 3)
  store = cache.put(store, "c", 3, 3)
  // "a" is now the oldest. Asking for it moves it to the front, so the next
  // eviction has to take "b" instead.
  assert.strictEqual(cache.get(store, "a"), 1)
  store = cache.touch(store, "a")
  store = cache.put(store, "d", 4, 3)
  assert.strictEqual(cache.get(store, "b"), undefined, "the entry nobody touched is evicted")
  assert.strictEqual(cache.get(store, "a"), 1, "the one just asked for survives")
  assert.strictEqual(cache.get(store, "c"), 3)
  assert.strictEqual(cache.get(store, "d"), 4)
}

// Writing the same key again is an update, not a second entry crowding out a
// third — the limit counts distinct messages, not writes.
{
  var store = cache.empty()
  store = cache.put(store, "a", 1, 2)
  store = cache.put(store, "b", 2, 2)
  store = cache.put(store, "a", 10, 2)
  assert.strictEqual(cache.get(store, "a"), 10, "the newer value for the same key wins")
  assert.strictEqual(cache.get(store, "b"), 2, "and the other entry was never at risk")
}

// touch() on a key that was never put, or on an empty store, changes nothing —
// the cache-miss path in MailAccount.qml only ever put()s, but a store that
// tolerated this quietly is safer than one that has to be asked not to.
{
  var store = cache.empty()
  assert.strictEqual(cache.touch(store, "nothing"), store)
  store = cache.put(store, "a", 1, 2)
  var touched = cache.touch(store, "nothing")
  deepEqual(touched, store)
}

// A negative limit is nonsense a caller could still pass — this keeps exactly
// one entry rather than caching nothing or throwing. Zero falls back to the
// default instead of disabling the cache, the same `n || DEFAULT` reading
// `cache/Cache.js`'s own `queryKey` already gives a caller-supplied count.
{
  var store = cache.empty()
  store = cache.put(store, "a", 1, -1)
  store = cache.put(store, "b", 2, -1)
  assert.strictEqual(cache.get(store, "a"), undefined)
  assert.strictEqual(cache.get(store, "b"), 2)

  store = cache.put(cache.empty(), "a", 1, 0)
  assert.strictEqual(cache.get(store, "a"), 1, "0 is falsy, so it defers to DEFAULT_MAX_ENTRIES")
}

console.log("test_render_cache.js ok")
