# This checkout is a pinned fork of Omamail

Branch `roel-main` (remote `fork` = github.com/R037/omamail). It sits on upstream
commit `e2cd92f` (2026-08-26, "Edit and delete calendar events (#41)") and adds
the features below inside the original QML + JS layout.

Upstream (`origin` = github.com/huacnlee/omamail) rewrote the client on
2026-09-12 (#174): a Rust backend and CLI under `src/`, the interface under
`ui/`, a different body-fetch and cache pipeline. None of the files this branch
changes exist in that shape any more, so this is not a branch waiting to be
rebased — it is its own thing until porting is worth it. Nothing here is
broken by that: the Gmail API and the Omarchy shell are the only moving parts,
and both have been cheap to follow (see "Keeping up").

## What differs from upstream

| Feature | Key | Where it lives |
|---|---|---|
| Reader follows the cursor (preview, debounced 70 ms) | `j`/`k`, and after `e`/`d`/`h` | `App.qml` `previewTimer`, `onCursorIdChanged` |
| Archive/trash/remind moves the cursor to the row below (the one that slides into its place, matching working down a list) rather than the top of the inbox; a background poll/wake no longer discards pages loaded past page 1 | — | `Model.cursorAfterRemoval`, `MailAccount` pollTimer/refreshCounts/wake guards |
| List loads the next page on scrolling near the end, not only on clicking "Load more" | — | `Model.nearListEnd`, `App.qml` `listFlick.nearEnd` |
| Shown for 1 s = read; `u` marks unread and holds it while highlighted | `u` | `App.qml` `readTimer`, `heldUnreadId` |
| Remind me later: snooze to a preset or a typed phrase, wake sorted into the inbox at its wake moment with "Reminder: " (falls below newer mail as it arrives), Snoozed mailbox | `h` | `message/Snooze.js`, `components/SnoozePicker.qml`, `MailAccount` snooze/wake, `Service` scheduler, `~/.config/omamail/snoozes.json` |
| Label picker: filter, toggle, create | `l` | `components/LabelPicker.qml`, `Model.labelChoices`, `GmailApiClient.createLabel` |
| Read the cursor's neighbours ahead (2 below, 1 above), pre-parsed | — | `MailAccount` `prefetchAround`/`applyLivePayload`/`warmRender`, `Model.prefetchNeighbours` |
| Select text in the reader → clipboard | — | `MessageReader.qml` `copySelectionTimer` |
| Bare email addresses in bodies become mailto links | — | `Html.js` `linkifyEmails` (in `serializeInto`) |
| Hover fill only for a pointer that moved (no trailing highlight) | — | `MessageRow.qml` `pointerHere`, `MessageList.qml` `pointerAt` |
| Space-bar paging in the reader, browser-style | `Space` / `Shift+Space` | `keys/Keymap.js`, `MessageReader.qml` `pageBody` |
| Perf: native base64 decode, one MIME walk, sanitize LRU, cache-hit skips | — | `Message.js`, `cache/RenderCache.js`, `MailAccount.select` |
| Raised heaviness ceiling: 1MB/20k elements/400 tables, up from upstream's 120KB/2.5k/60 | — | `message/Html.js` `MAX_RICH_TEXT`/`MAX_ELEMENTS`/`MAX_TABLES` |
| Helper scripts found from `Service.qml`'s own path (Omarchy hides `__sourceDir`) | — | `Service.qml` `pluginDir` — upstream has the same fix (#162) |

Everything is covered by `make test` (JS, shell canaries, QML) and `docs/KEYS.md`
lists every binding; `tests/test_keymap.js` fails if the two drift.

## Keeping up

```
git fetch origin
git log --oneline HEAD..origin/main | head          # what they did
git grep -n <thing> origin/main -- ui src            # how they did it
```

The two things worth watching for are Gmail API changes and Omarchy shell
changes (plugin manifest, Quickshell). Both show up as failures in
`journalctl --user -f | grep -i omamail`; the fix is usually local and small.

## When to port

Port when you want something upstream has that this does not — their Microsoft
/ Outlook accounts are the likely one. Until then there is nothing to gain.

Porting is days, not a rewrite. In rough order of effort:

1. **Moves as-is (pure JS, unit-tested):** `message/Snooze.js` + `tests/test_snooze.js`;
   `Model.js` helpers `surfaceReminders`, `displaySubject`, `labelChoices`,
   `labelNameOf`, `prefetchNeighbours`, `prefetchedSummary`, `withSnoozedMailbox`,
   and the `snooze`/`unsnooze`/`wake`/`addLabel`/`removeLabel` actions; the
   `linkifyEmails` change to `Html.js`'s serializer (find their equivalent of
   `serializeInto` and its `escapeMarkup` canary).
2. **Reusable with a new host:** `SnoozePicker.qml`, `LabelPicker.qml` (popups that
   own their keys; depend only on `service.labels`/`messages`/`snoozeFor`/`canLabel`).
3. **Redo against their pipeline:** the reader-follows-cursor and 1-second-read
   timers (small), the wake scheduler + `snoozes.json` persistence in their
   service, `createLabel` in their Gmail client, and the neighbour prefetch —
   check `ui/tests/qml/tst_prefetched_reader.qml` first; they have their own.
4. **Keybindings:** `h`, `l`, `u` (unread, not back), and the bar hints — their
   keymap table if it survived, else wherever `Shortcut`s live now.

## Direction: Gmail only

Decided 2026-09-18. The IMAP and HEY providers, their setup pages, the
provider picker and the IMAP/SMTP transport script are removed (commit after
`9c2bb03`); `providers/Registry.js` keeps its shape with one entry, so nothing
above it had to learn that there is only one answer. Adding a mailbox goes
straight to the Gmail page. Still present and harmless: the `hey`
calendar source kind in `calendar/Sources.js` and the per-provider wording in
`Model.setupHeadline`/`setupDetail` — dead branches, removable when convenient.

Why not upstream's Rust backend: what it moves off the GUI thread — decoding,
sanitizing, caching — this branch already keeps off the critical path
(native base64, one MIME walk, the render LRU, neighbour prefetch), and most
of its surface is providers this fork does not use. It would matter for their
AI assistant or the standalone app; neither is wanted here.

## Tried and closed: a browser engine for the body

2026-09-18. `qt6-webengine` is installed and the `QtWebEngine` QML module is
present, and this Qt (6.11) tolerates the late `QtWebEngineQuick::initialize()`
that a plugin is stuck with — so it was worth a spike: a throwaway Quickshell
config with one `WebEngineView`, run as a second instance. It never paints:
Chromium aborts the whole process at init with

    FATAL: Argument list is empty, the program name is not passed to
    QCoreApplication. base::CommandLine cannot be properly initialized.

Quickshell builds its `QCoreApplication` with an empty argument list — on
purpose, after parsing its own flags, and with or without its crash handler
(`QS_DISABLE_CRASH_HANDLER=1` makes no difference). Chromium's `CommandLine`
needs `argv[0]`. Nothing on the QML side can change the host's argv, so a
`WebEngineView` inside Omamail would take the desktop shell down the moment
it was created. The repo's own "no browser engine" note (`README.md`,
`docs/SPEC.md`) stands, for a different reason than it gives.

What would reopen it: Quickshell passing a non-empty argv (a one-line change
there — worth an upstream issue), and then the late-init deprecation not
having become a failure. The plan for that day is in
`~/.claude/plans/to-improve-scrolling-performance-wise-lerdorf.md`: a
`renderer: "web"` sanitize option keeping the security rules and dropping
the Qt workarounds, an opt-in fourth body mode, the view loaded only while
in use. The screenshot-plus-link-map route was considered and rejected: no
text selection, a re-render per width change, and the most plumbing.

## Housekeeping

- Old remote branch names `speed-up-opening-a-message` and `remind-me` on `fork`
  are stale copies of history now on `roel-main`; delete them when convenient.
- `AGENTS.md` is upstream's contributor guide and still applies to the code style
  here.
