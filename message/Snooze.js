.pragma library

// A reminder is a message put out of sight until a moment of the user's
// choosing, and brought back with a note in front of its subject. Everything
// here is the arithmetic of that: reading "two weeks" or "fri 2pm" as a
// moment, and keeping the list of what is waiting. Nothing here talks to a
// provider — the account moves the message; this only says when.
//
// The moment is kept as milliseconds since the epoch, which is the one form
// that survives a JSON round trip, a timezone change and a comparison against
// Date.now() without any of the three needing to agree on a format.

// When a day with no time on it wakes. "Tomorrow" means the start of the next
// working day, not this same minute a day from now: a reminder set at 23:40
// that fired at 23:40 would be missed until the morning anyway.
var WAKE_HOUR = 8
var WAKE_MINUTE = 0

// What goes in front of the subject once the reminder has fired. Display only:
// no provider lets a subject be rewritten, and none should.
var PREFIX = "Reminder: "

var DAY_MS = 24 * 60 * 60 * 1000

var WEEKDAYS = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3, thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5, saturday: 6, sat: 6
}

var MONTHS = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
  may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7,
  september: 8, sep: 8, sept: 8, october: 9, oct: 9, november: 10, nov: 10,
  december: 11, dec: 11
}

var NUMBER_WORDS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, couple: 2, few: 3
}

// --------------------------------------------------------------- parsing

function numberOf(word) {
  var text = String(word || "").toLowerCase()
  if (/^\d+$/.test(text)) return parseInt(text, 10)
  return NUMBER_WORDS[text] === undefined ? NaN : NUMBER_WORDS[text]
}

// A clock time at the end of the phrase, or nothing. "2pm", "2:30 pm",
// "14:00", "at noon", "in the morning". Returns { hour, minute } and the
// phrase with the time taken off it.
function splitTime(text) {
  var rest = String(text)
  var match = rest.match(/(?:\s+|^)(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*$/i)
  if (match && (match[2] !== undefined || match[3] !== undefined)) {
    var hour = parseInt(match[1], 10)
    var minute = match[2] === undefined ? 0 : parseInt(match[2], 10)
    var meridiem = match[3] ? match[3].toLowerCase() : ""
    if (meridiem === "pm" && hour < 12) hour += 12
    if (meridiem === "am" && hour === 12) hour = 0
    if (hour > 23 || minute > 59) return null
    return { hour: hour, minute: minute, rest: rest.substring(0, match.index) }
  }
  var word = rest.match(/(?:\s+|^)(?:at\s+|in\s+the\s+)?(noon|midday|morning|afternoon|evening|tonight|night)\s*$/i)
  if (word) {
    var named = word[1].toLowerCase()
    var hourFor = { noon: 12, midday: 12, morning: WAKE_HOUR, afternoon: 14,
      evening: 18, tonight: 20, night: 20 }
    return { hour: hourFor[named], minute: 0, rest: rest.substring(0, word.index),
      // "tonight" on its own is a day as well as a time.
      today: named === "tonight" || named === "night" }
  }
  return null
}

function atTime(date, hour, minute) {
  var out = new Date(date.getTime())
  out.setHours(hour, minute, 0, 0)
  return out
}

function startOfDay(date) {
  return atTime(date, 0, 0)
}

function addDays(date, days) {
  var out = new Date(date.getTime())
  out.setDate(out.getDate() + days)
  return out
}

function addMonths(date, months) {
  var out = new Date(date.getTime())
  var day = out.getDate()
  out.setDate(1)
  out.setMonth(out.getMonth() + months)
  // The 31st of a month that has no 31st becomes its last day rather than
  // rolling into the next month, which is what "a month from now" means.
  var last = new Date(out.getFullYear(), out.getMonth() + 1, 0).getDate()
  out.setDate(Math.min(day, last))
  return out
}

// The next occurrence of a weekday strictly after today: "friday" said on a
// Friday means next Friday, not this morning.
function nextWeekday(now, weekday) {
  var ahead = (weekday - now.getDay() + 7) % 7
  if (ahead === 0) ahead = 7
  return addDays(startOfDay(now), ahead)
}

// The phrase as a moment, or null when it says nothing this understands or
// names a moment already gone. `now` is a Date, passed in rather than read so
// the tests and the preview agree on what "tomorrow" is.
//
// A day-sized phrase — tomorrow, friday, two weeks, oct 3 — wakes at
// WAKE_HOUR unless a time is given. An hour-sized one — in 2 hours, 30
// minutes — is exact: somebody who says two hours means two hours.
function parseWhen(text, now) {
  var at = parse(text, now)
  if (!at) return null
  if (at.getTime() <= now.getTime()) return null
  return at
}

function parse(text, now) {
  var phrase = String(text === undefined || text === null ? "" : text)
    .toLowerCase().replace(/[,.]+/g, " ").replace(/\s+/g, " ").trim()
  if (phrase === "") return null

  var time = splitTime(phrase)
  var hour = time ? time.hour : WAKE_HOUR
  var minute = time ? time.minute : WAKE_MINUTE
  var rest = time ? time.rest.trim() : phrase
  rest = rest.replace(/^(in|on|next|this|the|at)\s+/, function(match, word) {
    // "next" carries meaning for a weekday and "next week"; the rest are
    // filler. Keep it in front of what follows and let the rules below read it.
    return word === "next" ? "next " : ""
  }).trim()

  if (rest === "" && time && time.today) return atTime(now, hour, minute)
  if (rest === "" && time) {
    // A bare time: today if it is still ahead, otherwise tomorrow.
    var today = atTime(now, hour, minute)
    return today.getTime() > now.getTime() ? today : addDays(today, 1)
  }
  if (rest === "today") return atTime(now, hour, minute)
  if (rest === "tomorrow" || rest === "tmrw" || rest === "tmr") return atTime(addDays(now, 1), hour, minute)
  if (rest === "next week" || rest === "week") return atTime(nextWeekday(now, 1), hour, minute)
  if (rest === "next month" || rest === "month") return atTime(addMonths(startOfDay(now), 1), hour, minute)
  if (rest === "weekend" || rest === "next weekend") return atTime(nextWeekday(now, 6), hour, minute)

  var weekday = rest.replace(/^next\s+/, "")
  if (WEEKDAYS[weekday] !== undefined) return atTime(nextWeekday(now, WEEKDAYS[weekday]), hour, minute)

  // "2 hours", "two weeks", "a day", "3 months", with or without "in".
  var relative = rest.match(/^(\d+|[a-z]+)\s+(minute|min|hour|hr|day|week|wk|month)s?$/)
  if (relative) {
    var count = numberOf(relative[1])
    if (isNaN(count) || count <= 0) return null
    var unit = relative[2]
    if (unit === "minute" || unit === "min") return new Date(now.getTime() + count * 60 * 1000)
    if (unit === "hour" || unit === "hr") return new Date(now.getTime() + count * 60 * 60 * 1000)
    if (unit === "day") return atTime(addDays(now, count), hour, minute)
    if (unit === "week" || unit === "wk") return atTime(addDays(now, count * 7), hour, minute)
    return atTime(addMonths(startOfDay(now), count), hour, minute)
  }

  // 2026-10-03, with the year first so it cannot be read as an American date.
  var iso = rest.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return dated(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10), hour, minute)

  // "oct 3", "3 oct", "october 3rd", "3 october 2026".
  var monthFirst = rest.match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?$/)
  var dayFirst = rest.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{4}))?$/)
  var monthName = monthFirst ? monthFirst[1] : (dayFirst ? dayFirst[2] : "")
  if (MONTHS[monthName] !== undefined) {
    var day = parseInt(monthFirst ? monthFirst[2] : dayFirst[1], 10)
    var yearText = monthFirst ? monthFirst[3] : dayFirst[3]
    var month = MONTHS[monthName]
    if (yearText) return dated(parseInt(yearText, 10), month, day, hour, minute)
    // No year: this year if the day is still ahead, otherwise next year.
    var candidate = dated(now.getFullYear(), month, day, hour, minute)
    if (candidate && candidate.getTime() > now.getTime()) return candidate
    return dated(now.getFullYear() + 1, month, day, hour, minute)
  }

  return null
}

// A calendar date that exists. February 30th is not a reminder for March 2nd.
function dated(year, month, day, hour, minute) {
  var out = new Date(year, month, day, hour, minute, 0, 0)
  if (out.getFullYear() !== year || out.getMonth() !== month || out.getDate() !== day) return null
  return out
}

// ------------------------------------------------------------- presets

// The three the picker offers by number. "Next week" is Monday morning rather
// than seven days from now: a reminder set on a Wednesday for "next week" is
// for the start of that week, which is how people say it.
function presets(now) {
  return [
    { key: "tomorrow", label: "Tomorrow", at: parseWhen("tomorrow", now) },
    { key: "nextWeek", label: "Next week", at: parseWhen("next week", now) },
    { key: "pick", label: "Pick a date or time", at: null }
  ]
}

// --------------------------------------------------------------- display

function pad(value) {
  return (value < 10 ? "0" : "") + value
}

var DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
var MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

// How the picker and the snoozed list say when. "Tomorrow 08:00", "Fri 3 Oct,
// 14:00", and the year only when it is not this one.
function formatWhen(value, now) {
  var at = value instanceof Date ? value : new Date(Number(value))
  if (isNaN(at.getTime())) return ""
  var clock = pad(at.getHours()) + ":" + pad(at.getMinutes())
  var days = Math.round((startOfDay(at).getTime() - startOfDay(now).getTime()) / DAY_MS)
  if (days === 0) return "Today " + clock
  if (days === 1) return "Tomorrow " + clock
  var day = DAY_NAMES[at.getDay()] + " " + at.getDate() + " " + MONTH_NAMES[at.getMonth()]
  if (at.getFullYear() !== now.getFullYear()) day += " " + at.getFullYear()
  return day + ", " + clock
}

function prefixSubject(subject) {
  var text = String(subject === undefined || subject === null ? "" : subject)
  return text.indexOf(PREFIX) === 0 ? text : PREFIX + text
}

// --------------------------------------------------------------- records
//
// One flat list for every account, kept on disk as it is here. A record is
//
//   { account, id, at, subject, from, woken }
//
// `account` is the address, because that is how the rest of the plugin names
// one; `subject` and `from` are copied so the snoozed list can be drawn from
// the records alone before any message has been fetched back.

function isRecord(value) {
  return !!value && typeof value === "object"
    && typeof value.account === "string" && value.account !== ""
    && typeof value.id === "string" && value.id !== ""
    && typeof value.at === "number" && isFinite(value.at)
}

function load(text) {
  var parsed
  try {
    parsed = JSON.parse(String(text === undefined || text === null ? "" : text))
  } catch (e) {
    return []
  }
  if (!Array.isArray(parsed)) return []
  var out = []
  for (var i = 0; i < parsed.length; i++) {
    if (isRecord(parsed[i])) out.push(normalize(parsed[i]))
  }
  return out
}

function normalize(record) {
  return {
    account: record.account,
    id: record.id,
    at: record.at,
    subject: String(record.subject === undefined || record.subject === null ? "" : record.subject),
    from: String(record.from === undefined || record.from === null ? "" : record.from),
    woken: record.woken === true
  }
}

function serialize(records) {
  return JSON.stringify(records || [])
}

function indexOf(records, account, id) {
  for (var i = 0; i < records.length; i++) {
    if (records[i].account === account && records[i].id === id) return i
  }
  return -1
}

function find(records, account, id) {
  var at = indexOf(records, account, id)
  return at < 0 ? null : records[at]
}

// Setting a reminder on a message that already has one replaces it: two
// reminders for one message is two interruptions for one decision.
function put(records, record) {
  var next = normalize(record)
  var out = []
  for (var i = 0; i < records.length; i++) {
    if (!(records[i].account === next.account && records[i].id === next.id)) out.push(records[i])
  }
  out.push(next)
  return out
}

function remove(records, account, id) {
  var out = []
  for (var i = 0; i < records.length; i++) {
    if (!(records[i].account === account && records[i].id === id)) out.push(records[i])
  }
  return out
}

function markWoken(records, account, id) {
  var out = records.slice()
  var at = indexOf(out, account, id)
  if (at < 0) return out
  var record = normalize(out[at])
  record.woken = true
  out[at] = record
  return out
}

// What is due: set for a moment that has passed and not yet brought back.
function due(records, account, nowMs) {
  var out = []
  for (var i = 0; i < records.length; i++) {
    var record = records[i]
    if (record.account !== account || record.woken || record.at > nowMs) continue
    out.push(record)
  }
  return out
}

// Still waiting, soonest first, for the snoozed list.
function pending(records, account) {
  var out = []
  for (var i = 0; i < records.length; i++) {
    if (records[i].account === account && !records[i].woken) out.push(records[i])
  }
  out.sort(function(a, b) { return a.at - b.at })
  return out
}

// Already brought back and not yet dealt with, for pinning above the inbox.
function woken(records, account) {
  var out = []
  for (var i = 0; i < records.length; i++) {
    if (records[i].account === account && records[i].woken) out.push(records[i])
  }
  out.sort(function(a, b) { return b.at - a.at })
  return out
}
