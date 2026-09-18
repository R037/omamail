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
| Shown for 1 s = read; `u` marks unread and holds it while highlighted | `u` | `App.qml` `readTimer`, `heldUnreadId` |
| Remind me later: snooze to a preset or a typed phrase, wake pinned to the inbox top with "Reminder: ", Snoozed mailbox | `h` | `message/Snooze.js`, `components/SnoozePicker.qml`, `MailAccount` snooze/wake, `Service` scheduler, `~/.config/omamail/snoozes.json` |
| Label picker: filter, toggle, create | `l` | `components/LabelPicker.qml`, `Model.labelChoices`, `GmailApiClient.createLabel` |
| Read the cursor's neighbours ahead (2 below, 1 above), pre-parsed | — | `MailAccount` `prefetchAround`/`applyLivePayload`/`warmRender`, `Model.prefetchNeighbours` |
| Select text in the reader → clipboard | — | `MessageReader.qml` `copySelectionTimer` |
| Bare email addresses in bodies become mailto links | — | `Html.js` `linkifyEmails` (in `serializeInto`) |
| Hover fill only for a pointer that moved (no trailing highlight) | — | `MessageRow.qml` `pointerHere`, `MessageList.qml` `pointerAt` |
| Perf: native base64 decode, one MIME walk, sanitize LRU, cache-hit skips | — | `Message.js`, `cache/RenderCache.js`, `MailAccount.select` |
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

## Housekeeping

- Old remote branch names `speed-up-opening-a-message` and `remind-me` on `fork`
  are stale copies of history now on `roel-main`; delete them when convenient.
- `AGENTS.md` is upstream's contributor guide and still applies to the code style
  here.
