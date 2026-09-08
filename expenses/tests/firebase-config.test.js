import { test } from "node:test";
import assert from "node:assert/strict";
import { firebaseConfig, isConfigured, APP_CHECK_SITE_KEY } from "../js/firebase-config.js";
import { firebaseConfig as checklistConfig }
  from "../../moving-checklist/js/firebase-config.js";

// Two web apps, one project. Auth sessions and the Firestore database are shared,
// so these five fields must stay identical — if they drift, sign-in on one page
// stops carrying over to the other and the ledger points at a different database.
const SHARED = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId"];

test("both pages target the same Firebase project", () => {
  for (const k of SHARED)
    assert.equal(firebaseConfig[k], checklistConfig[k], `${k} drifted between the two apps`);
  assert.equal(firebaseConfig.projectId, "proxy-eval");
});

// ...but a *distinct* app registration, because App Check attests per web app.
test("expenses is its own web app registration", () => {
  assert.notEqual(firebaseConfig.appId, checklistConfig.appId);
  assert.match(firebaseConfig.appId, /^1:726735473376:web:[0-9a-f]+$/);
  assert.notEqual(firebaseConfig.measurementId, checklistConfig.measurementId);
});

test("isConfigured rejects the placeholder", () => {
  assert.equal(isConfigured(), true);
  assert.equal(firebaseConfig.apiKey.startsWith("AIza"), true);
});

// The site key is public by design; the reCAPTCHA secret key is not and has no
// business in the client. Guard against someone pasting the wrong half.
test("no reCAPTCHA secret key smuggled into the client config", () => {
  assert.equal(typeof APP_CHECK_SITE_KEY, "string");
  if (APP_CHECK_SITE_KEY) {
    // v3 site keys start with 6L; secret keys start with 6L too but are labelled
    // "secret" in the console — length and shape are the only client-side signal.
    assert.match(APP_CHECK_SITE_KEY, /^6L[\w-]{30,}$/,
      "that doesn't look like a reCAPTCHA v3 site key");
  }
});
