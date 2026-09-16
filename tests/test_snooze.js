const assert = require("assert")
const { load, deepEqual } = require("./load")

const snooze = load("message/Snooze.js")

// A Wednesday morning, mid-month, so "next week", "friday" and "oct 3" all
// mean something different from each other.
const now = new Date(2026, 8, 16, 10, 30, 0, 0)

function at(y, m, d, h, min) {
  return new Date(y, m - 1, d, h === undefined ? 8 : h, min || 0, 0, 0).getTime()
}

function when(text) {
  const result = snooze.parseWhen(text, now)
  return result ? result.getTime() : null
}

// ------------------------------------------------------------- day words

assert.strictEqual(when("tomorrow"), at(2026, 9, 17), "tomorrow wakes at eight")
assert.strictEqual(when("Tomorrow"), at(2026, 9, 17), "case does not matter")
assert.strictEqual(when("tomorrow 2pm"), at(2026, 9, 17, 14), "a time on the day is honoured")
assert.strictEqual(when("tomorrow at 14:30"), at(2026, 9, 17, 14, 30))
assert.strictEqual(when("tomorrow morning"), at(2026, 9, 17, 8))
assert.strictEqual(when("tomorrow evening"), at(2026, 9, 17, 18))
assert.strictEqual(when("next week"), at(2026, 9, 21), "next week is Monday morning")
assert.strictEqual(when("next month"), at(2026, 10, 16), "next month is the same day a month on")
assert.strictEqual(when("tonight"), at(2026, 9, 16, 20))
assert.strictEqual(when("today 5pm"), at(2026, 9, 16, 17))
assert.strictEqual(when("today"), null, "today at eight has already gone")
assert.strictEqual(when("3pm"), at(2026, 9, 16, 15), "a bare time still ahead is today")
assert.strictEqual(when("9am"), at(2026, 9, 17, 9), "a bare time already gone is tomorrow")
assert.strictEqual(when("noon"), at(2026, 9, 16, 12))

// -------------------------------------------------------------- weekdays

assert.strictEqual(when("friday"), at(2026, 9, 18), "the coming Friday")
assert.strictEqual(when("fri"), at(2026, 9, 18))
assert.strictEqual(when("on friday"), at(2026, 9, 18))
assert.strictEqual(when("next friday"), at(2026, 9, 18))
assert.strictEqual(when("wednesday"), at(2026, 9, 23), "today's own name means next week")
assert.strictEqual(when("monday"), at(2026, 9, 21))
assert.strictEqual(when("sat 10am"), at(2026, 9, 19, 10))
assert.strictEqual(when("weekend"), at(2026, 9, 19), "the weekend starts Saturday")

// -------------------------------------------------------------- relative

assert.strictEqual(when("in 2 hours"), now.getTime() + 2 * 3600 * 1000, "hours are exact")
assert.strictEqual(when("2 hours"), now.getTime() + 2 * 3600 * 1000)
assert.strictEqual(when("in 30 minutes"), now.getTime() + 30 * 60 * 1000)
assert.strictEqual(when("an hour"), now.getTime() + 3600 * 1000)
assert.strictEqual(when("two weeks"), at(2026, 9, 30), "days and up wake at eight")
assert.strictEqual(when("in two weeks"), at(2026, 9, 30))
assert.strictEqual(when("2 weeks"), at(2026, 9, 30))
assert.strictEqual(when("3 days"), at(2026, 9, 19))
assert.strictEqual(when("a day"), at(2026, 9, 17))
assert.strictEqual(when("in 3 days 2pm"), at(2026, 9, 19, 14))
assert.strictEqual(when("1 month"), at(2026, 10, 16))
assert.strictEqual(when("0 days"), null, "nothing from now is not a reminder")

// The 31st a month on from a short month lands on that month's last day.
const endOfMonth = new Date(2026, 0, 31, 9, 0, 0, 0)
assert.strictEqual(snooze.parseWhen("1 month", endOfMonth).getTime(),
  new Date(2026, 1, 28, 8, 0, 0, 0).getTime())

// ----------------------------------------------------------------- dates

assert.strictEqual(when("oct 3"), at(2026, 10, 3))
assert.strictEqual(when("3 oct"), at(2026, 10, 3))
assert.strictEqual(when("October 3rd"), at(2026, 10, 3))
assert.strictEqual(when("3rd october 2pm"), at(2026, 10, 3, 14))
assert.strictEqual(when("oct 3, 2027"), at(2027, 10, 3))
assert.strictEqual(when("2026-10-03"), at(2026, 10, 3))
assert.strictEqual(when("2026-10-03 14:00"), at(2026, 10, 3, 14))
assert.strictEqual(when("sep 1"), at(2027, 9, 1), "a date already gone this year is next year's")
assert.strictEqual(when("feb 30"), null, "a date that does not exist is not a reminder")
assert.strictEqual(when("2025-01-01"), null, "a moment in the past is refused")

// --------------------------------------------------------------- nonsense

assert.strictEqual(when(""), null)
assert.strictEqual(when("   "), null)
assert.strictEqual(when("whenever"), null)
assert.strictEqual(when("friday 99"), null)
assert.strictEqual(when("25:00"), null)
assert.strictEqual(when(null), null)

// --------------------------------------------------------------- presets

const presets = snooze.presets(now)
assert.strictEqual(presets.length, 3)
assert.strictEqual(presets[0].at.getTime(), at(2026, 9, 17))
assert.strictEqual(presets[1].at.getTime(), at(2026, 9, 21))
assert.strictEqual(presets[2].at, null, "the third asks rather than answers")

// --------------------------------------------------------------- display

assert.strictEqual(snooze.formatWhen(at(2026, 9, 17), now), "Tomorrow 08:00")
assert.strictEqual(snooze.formatWhen(at(2026, 9, 16, 15), now), "Today 15:00")
assert.strictEqual(snooze.formatWhen(at(2026, 10, 3, 14), now), "Sat 3 Oct, 14:00")
assert.strictEqual(snooze.formatWhen(at(2027, 1, 4), now), "Mon 4 Jan 2027, 08:00", "the year only when it differs")
assert.strictEqual(snooze.formatWhen(new Date(at(2026, 9, 17)), now), "Tomorrow 08:00", "a Date is as good as a number")
assert.strictEqual(snooze.formatWhen("nope", now), "")

assert.strictEqual(snooze.prefixSubject("Lunch"), "Reminder: Lunch")
assert.strictEqual(snooze.prefixSubject("Reminder: Lunch"), "Reminder: Lunch", "never twice")
assert.strictEqual(snooze.prefixSubject(""), "Reminder: ")

// --------------------------------------------------------------- records

const a = { account: "me@example.com", id: "m1", at: at(2026, 9, 17), subject: "One", from: "Ann" }
const b = { account: "me@example.com", id: "m2", at: at(2026, 9, 15), subject: "Two", from: "Bob" }
const other = { account: "you@example.com", id: "m1", at: at(2026, 9, 15), subject: "Theirs", from: "Cy" }

let records = snooze.put([], a)
records = snooze.put(records, b)
records = snooze.put(records, other)
assert.strictEqual(records.length, 3)
deepEqual(snooze.find(records, "me@example.com", "m2"),
  { account: "me@example.com", id: "m2", at: at(2026, 9, 15), subject: "Two", from: "Bob", woken: false })
assert.strictEqual(snooze.find(records, "me@example.com", "m9"), null)

records = snooze.put(records, { account: "me@example.com", id: "m1", at: at(2026, 9, 18), subject: "One" })
assert.strictEqual(records.length, 3, "a second reminder on the same message replaces the first")
assert.strictEqual(snooze.find(records, "me@example.com", "m1").at, at(2026, 9, 18))

deepEqual(snooze.due(records, "me@example.com", now.getTime()).map(r => r.id), ["m2"],
  "only what is past and not yet woken, for this account")
deepEqual(snooze.pending(records, "me@example.com").map(r => r.id), ["m2", "m1"], "soonest first")
deepEqual(snooze.woken(records, "me@example.com"), [])

records = snooze.markWoken(records, "me@example.com", "m2")
deepEqual(snooze.due(records, "me@example.com", now.getTime()), [], "woken is no longer due")
deepEqual(snooze.pending(records, "me@example.com").map(r => r.id), ["m1"])
deepEqual(snooze.woken(records, "me@example.com").map(r => r.id), ["m2"])
deepEqual(snooze.woken(records, "you@example.com"), [], "another account's records stay theirs")

records = snooze.remove(records, "me@example.com", "m2")
assert.strictEqual(records.length, 2)
assert.strictEqual(snooze.find(records, "me@example.com", "m2"), null)
assert.strictEqual(snooze.find(records, "you@example.com", "m1").subject, "Theirs")

// A round trip through disk keeps every record and drops what is not one.
const text = snooze.serialize(records)
deepEqual(snooze.load(text), records)
deepEqual(snooze.load(""), [])
deepEqual(snooze.load("not json"), [])
deepEqual(snooze.load("{}"), [])
deepEqual(snooze.load(JSON.stringify([a, { id: "broken" }, null, 4])), [Object.assign({}, a, { woken: false })],
  "a record that lost a field is dropped rather than crashing the list")

console.log("test_snooze.js ok")
