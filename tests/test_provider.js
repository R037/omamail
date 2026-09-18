const assert = require("assert")
const { load, deepEqual } = require("./load")

const provider = load("providers/Registry.js")

// ------------------------------------------------------------- the registry
//
// Three providers, and the ids are what an accounts.json holds — renaming one
// silently orphans every account already written with the old name.
//
assert.strictEqual(provider.get("gmail").name, "Gmail")

// An id from a newer build, or a hand-edited file, still has to open a window.
assert.strictEqual(provider.get("nonesuch").id, "gmail")
assert.strictEqual(provider.get("").id, "gmail")
assert.strictEqual(provider.get(null).id, "gmail")
assert.strictEqual(provider.get(undefined).id, "gmail")
assert.strictEqual(provider.get("  GMAIL  ").id, "gmail", "ids are trimmed and folded")
assert.strictEqual(provider.exists("nonesuch"), false)

// ------------------------------------------------------------ capabilities
//
// A capability that is missing must read as "cannot". The panel hides buttons
// on these, so a typo that returned undefined would show a button that fails.

assert.strictEqual(provider.can("gmail", "labels"), true)
assert.strictEqual(provider.prefetchDepth("gmail"), 3, "Gmail reads are cheap enough to guess three ahead")
assert.strictEqual(provider.can("gmail", "prefetchDepth"), false, "a number is not a yes")
assert.strictEqual(provider.can("gmail", "label"), true, "a Gmail label can be put on a message")
assert.strictEqual(provider.can("gmail", "spam"), true)
assert.strictEqual(provider.can("gmail", "threads"), true)
assert.strictEqual(provider.can("gmail", "web"), true)

// Opening a message on the web and opening *this mailbox* on the web are two
// questions. HEY gives every thread an address of its own but has none for a
// search or a label, so the second answer is no — an "Open web inbox" there
// could only ever open the Imbox, whatever the user was looking at.
assert.strictEqual(provider.can("gmail", "webBox"), true)

// And the address builders agree with the capabilities, so a caller that asked
// anyway gets nothing rather than somewhere else's mailbox.
assert.strictEqual(provider.webBoxUrl("gmail", "in:inbox"),
  "https://mail.google.com/mail/u/0/#search/in%3Ainbox")
assert.strictEqual(provider.can("gmail", "invented"), false, "an unknown capability is a no")

// The `unavailable` seam is kept for a provider that cannot be connected to.
assert.strictEqual(provider.isConnectable("gmail"), true)

assert.strictEqual(provider.unavailableReason("gmail"), "")

// --------------------------------------------------------------- mailboxes

// The glyphs ActionIcon actually draws. A mailbox naming anything else renders
// as nothing at all.
const DRAWN = ["inbox", "unread", "star", "send", "archive", "trash", "reply", "pin", "label"]

// Every provider's first mailbox is its inbox: `mailboxFor` falls back to it,
// which is what a key belonging to another provider lands on mid-switch.
const ids = provider.ids()
for (const id of ids) {
  const boxes = provider.mailboxes(id)
  assert.ok(boxes.length > 0, id + " has mailboxes")
  assert.ok(boxes[0].key === "inbox" || boxes[0].key === "imbox",
    id + " leads with its inbox")
  for (const box of boxes) {
    // The sidebar is icon-first and collapses to a strip of glyphs, so a
    // mailbox whose icon ActionIcon cannot draw is an invisible row.
    assert.ok(DRAWN.indexOf(box.icon) >= 0,
      id + "/" + box.key + " has no drawable icon: " + box.icon)
    assert.ok(box.label !== "", id + "/" + box.key + " needs a label for its tooltip")
  }
}

// A mutation of the returned list must not reach the provider definition.
const boxes = provider.mailboxes("gmail")
boxes.push({ key: "invented" })
assert.strictEqual(provider.mailboxes("gmail").length, boxes.length - 1,
  "the mailbox list is copied on the way out")

assert.strictEqual(provider.hasMailbox("gmail", "all"), true)
assert.strictEqual(provider.mailboxFor("gmail", "nonesuch").key, "inbox",
  "an unknown mailbox key falls back to the inbox rather than to undefined")

// ----------------------------------------------------------------- queries

// Gmail's queries are its own search operators, unchanged from what shipped.
assert.strictEqual(provider.query("gmail", "inbox", "", ""), "in:inbox")
assert.strictEqual(provider.query("gmail", "starred", "", ""), "is:starred")
assert.strictEqual(provider.query("gmail", "trash", "", ""), "in:trash")

// IMAP's are the folder DSL.

// A typed search wins over everything, and is shaped by the provider.
assert.strictEqual(provider.query("gmail", "trash", "from:jane", ""), "from:jane",
  "Gmail takes the user's search operators verbatim")

// The configured default is described as a default *search*, so it applies to
// the inbox and to nothing else — filtering Trash is not what it promised.
assert.strictEqual(provider.query("gmail", "inbox", "", "in:inbox -category:promotions"),
  "in:inbox -category:promotions")
assert.strictEqual(provider.query("gmail", "trash", "", "in:inbox -category:promotions"),
  "in:trash", "the default query does not leak into other mailboxes")
assert.strictEqual(provider.query("gmail", "inbox", "urgent", "in:inbox -category:promotions"),
  "urgent", "a typed search beats the default")
assert.strictEqual(provider.query("gmail", "inbox", "   ", ""), "in:inbox",
  "whitespace is not a search")
// The plugin-wide default is Gmail syntax. It must not become an IMAP SEARCH
// command after a password-provider account signs in, or the first list
// request is rejected and the mailbox stays empty.

// HEY's own queries, which the client reads back as commands.

// The badge counts what the Unread mailbox holds, by lookup rather than by a
// second definition that could drift from the first.
assert.strictEqual(provider.unreadQuery("gmail"),
  "in:inbox is:unread -category:promotions -category:social -category:forums")

// Named by exclusion on purpose, and the reason is which way it fails. Asking
// for `category:primary` was a positive scope, and a positive scope that stops
// matching — the label is CATEGORY_PERSONAL, the API has never documented
// `category:` at all, and Smart features being off stops the labels being
// applied — leaves the mailbox and the badge empty while unread mail piles up
// behind them. The negation degrades the other way, to every unread message in
// the inbox, which is noisier and nothing worse.
assert.ok(provider.unreadQuery("gmail").indexOf("category:primary") === -1,
  "the Unread scope is not a positive category filter; it fails closed")
assert.ok(provider.unreadQuery("gmail").indexOf("-category:updates") === -1,
  "Updates carries receipts, deliveries and GitHub's notifications; it stays in")

// Selecting a label in the sidebar is a different act from typing in the search
// box, even though both end in a query. Routing it through `query` would wrap an
// IMAP folder in a TEXT search — which looks for the folder's own name inside
// the inbox rather than opening it.
assert.strictEqual(provider.labelQuery("gmail", "Receipts"), "label:Receipts")
// ------------------------------------------------------------- the web home

// A third web question, and the reason it is its own: HEY has a front door even
// though it has no address for an arbitrary mailbox, so the settings row can
// link out where the "Open web inbox" row cannot.
assert.strictEqual(provider.webHomeUrl("gmail"), "https://mail.google.com/mail/u/0/")

// ------------------------------------------------------------------ logos

// A file in `assets/`, so the setup page says which mailbox it is about before
// any of its words do. IMAP has none on purpose: it is a protocol rather than a
// brand, and no mark would be honest about the server being connected to.
// The square icon a list row wants, and the lockup a page about the service
// opens with. HEY's differ — its wordmark is more than twice as wide as it is
// tall — and a provider with only one file uses it for both.
assert.strictEqual(provider.mark("gmail"), "gmail.png")
assert.strictEqual(provider.logo("gmail"), "gmail.png", "one square mark serves both")

// ------------------------------------------------------------------- auth

assert.strictEqual(provider.authKind("gmail"), "oauth")
assert.strictEqual(provider.usesCli("gmail"), false)
assert.strictEqual(provider.usesOAuth("gmail"), true)
assert.strictEqual(provider.usesPassword("gmail"), false)

assert.strictEqual(provider.DEFAULT_ID, "gmail",
  "an account written before providers existed is a Gmail account")

console.log("Provider.js ok")
