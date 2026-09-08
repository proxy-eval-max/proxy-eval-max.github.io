# Whose Turn

A two-person expense tracker that refuses to tell you the numbers.

You log what each of you spent and what it was for. The page stores all of it —
amount included — and then shows you exactly one thing:

> **Partner two pays next**
> *Partner one is a little ahead. Nothing dramatic, but the next one is Partner two's.*

(with real first names in place of those placeholders once the sealed name file
is in place — see [Names](#names))

No balance, no running total, no "you owe ₹1,240". The full record lives in
Firestore if you ever need it (see [Getting the real numbers](#getting-the-real-numbers)),
but the UI stays deliberately vague so that keeping score stops being a thing you do.

Live at **https://proxy-eval-max.github.io/expenses/**

## How "who pays next" is decided

Whoever has paid less, pays next. The *how much* less is bucketed into four words
before it reaches the screen:

| bucket   | gap as a share of everything spent |
| -------- | ---------------------------------- |
| `even`   | under 8%                           |
| `slight` | 8–25%                              |
| `clear`  | 25–60%                             |
| `wide`   | over 60%                           |

A bucket plus one receipt you happen to remember still doesn't reconstruct the
balance, which is the point. `tests/ledger.test.js` asserts that the verdict object
contains no digits at all.

## Layout

```
index.html            shell
manifest.json         add-to-home-screen metadata
sw.js                 service worker — network-first, shell only
icon.svg, icons/      the mark: the turn plate at 512px
css/styles.css        styles
js/ledger.js          who-pays-next logic — pure, no DOM, no Firebase
js/members.js         the two accounts, as salted hashes and opaque ids
js/names.js           display names: unsealed at sign-in, never in the source
js/secret.js          PBKDF2 + AES-GCM seal/unseal
js/hash.js            salted SHA-256, shared with tools/
js/db.js              Firestore reads/writes + the write throttle
js/auth.js            Google sign-in wrappers
js/firebase.js        SDK wiring, App Check
js/firebase-config.js this app's Firebase web config + App Check site key
js/app.js             views and boot
data/names.enc.json   the two names, sealed (generated; safe to commit)
tools/hash-email.js   generate a digest for members.js / firestore.rules
tools/seal-names.js   (re)generate data/names.enc.json
tests/                node --test, no browser needed
```

`npm test` from this directory. Nothing to build — it's ES modules served as files.

To run it locally: `npm run serve`, then open http://localhost:8080/ . Sign-in needs
`localhost` listed under Firebase console → Authentication → Settings → Authorized
domains.

## On a phone

Add it to your home screen and it opens standalone, without browser chrome.
Firestore keeps a local cache, so it opens and shows the last known verdict with
no signal, and an entry logged offline syncs when you're back.

That cache is the one place the amounts leave the server: they sit in this
browser's IndexedDB. The promise this app makes is that the *interface* won't
show you a number — not that the numbers never touch the device. Signing out
stops the page reading them; it doesn't wipe the cache.

## Security

The client is downloadable and editable by anyone, so none of it is a security
boundary. [`../firestore.rules`](../firestore.rules) is. Deploy it before you trust
any of this:

```sh
firebase deploy --only firestore:rules
```

**Emails are never stored in plaintext.** Not in the repo, not in the served JS, not
in the rules — only salted SHA-256 digests, checked on both sides. That keeps the two
addresses away from repo crawlers and scrapers. Be honest about the limit: the salt
ships with the client, so anyone who already suspects an address can hash it and
confirm a match. It's anti-harvesting, not secrecy.
`tests/members.test.js` fails if a literal address ever creeps back into the source.

## Names

The two people's names are not in this repo either. The code knows them only as
`p1` and `p2` — ids dull enough to sit safely in Firestore documents, CSS
selectors and the DOM. The real names live in `data/names.enc.json` as two
sealed copies of the same `{"p1":"…","p2":"…"}` payload, each encrypted under a
key derived from one partner's email address (PBKDF2-SHA256, 250k iterations,
then AES-256-GCM — the same envelope `moving-checklist/data/*.enc.json` uses).

Sign in and the client tries your address against both records; the one that
authenticates hands back both names for the session. They stay in memory, are
dropped on sign-out, and never reach storage.

Generate or change the file with:

```sh
node tools/seal-names.js
```

It prompts, so the names and addresses never touch your shell history or a diff.
Until the file exists the page renders "Partner one" / "Partner two" and works
normally.

What this does and doesn't buy you: the key is an email address, and no address
appears anywhere in the repo, so a crawler or a casual reader of the source gets
nothing. But an address is guessable in a way a random key is not, and the
salted digests in `members.js` let a determined reader test a guess cheaply. This
is protection against harvesting and idle curiosity — not against someone who
already knows your address.

**Nobody else can read or write.** The rules require a signed-in user with a
*verified* email whose digest is on the two-entry allowlist. A stranger who signs in
gets a "Not your ledger" page from the client and a `permission-denied` from the
database.

**It can't be flooded.** Entries are rate-limited server-side, not in the browser:
each write commits the entry and a `meters/{uid}` document in one batch, the entry
rule requires that meter to land via `getAfter()`, and the meter rule refuses to move
more than once every two seconds. One entry per person per 2s, and only two people
can write at all. The client also disables the submit button mid-write, but that's
just manners — the rules are what hold.

**Documents are validated and immutable.** Exact field set, `cents` a positive
integer, `note` capped at 140 chars, `at` matched against `YYYY-MM-DD`, `by` forced
to the caller's uid, `createdAt` forced to the server clock. No updates — delete and
re-add. Reads are capped at 500 documents per query.

### Locking it down

Two things are worth doing in the Firebase / Google Cloud console before you share
the URL:

1. **App Check.** Firebase console → App Check → register **this** web app
   (`…web:12e055afca414f19585e85` — the project has two, don't register
   moving-checklist's by mistake) with reCAPTCHA v3. Put the *site* key in
   `APP_CHECK_SITE_KEY` in `js/firebase-config.js`; the *secret* key stays in the
   console and never enters this repo. Then turn on *enforcement* for Firestore —
   but only after the App Check dashboard shows your own traffic as verified, or
   you'll lock yourself out. Without App Check, the public API key can be driven by
   a script that never loads this page. The app runs fine without it and says so in
   a footer note, which disappears once the key is set.

   Once enforcement is on, local dev needs an App Check debug token. `js/firebase.js`
   asks for one automatically on `localhost`, and the SDK logs it to the browser
   console on first load. In Safari the console is behind the Develop menu:
   Safari → Settings → Advanced → *Show features for web developers*, then ⌥⌘C.
   Copy the UUID out of the `App Check debug token:` line and add it under App Check
   → your web app → ⋮ → *Manage debug tokens*.

   The token is stored per browser profile, so clearing website data or using a
   private window gets you a new one that isn't on the allowlist yet.

   **Never commit a debug token** — it is a deliberate bypass, and anyone who finds
   it can mint valid tokens from anywhere.
2. **Restrict the API key.** Google Cloud console → APIs & Services → Credentials →
   the browser key → Application restrictions → HTTP referrers →
   `https://proxy-eval-max.github.io/*`.

Also worth a look: Firebase console → Authentication → Settings → Authorized domains
should list only your domains, and the sign-in provider list should be Google only.

Optional, if you want a hard ceiling as well as a rate limit: Identity Platform
blocking functions can reject non-allowlisted emails at `beforeSignIn`, so bots can't
even create auth records in the project. That needs the paid Identity Platform tier,
and the rules already stop them touching data, so it's belt-and-braces.

## Getting the real numbers

When you actually want to settle up, the amounts are all there: Firebase console →
Firestore → `ledgers/shared/entries`. Add up `cents` per `payer`. Then hit
**"We settled up — clear it"** in the app to wipe the slate.

That split is on purpose. Reading the balance should take deliberate effort; the
day-to-day answer is just a name.
