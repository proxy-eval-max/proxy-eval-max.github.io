import { test } from "node:test";
import assert from "node:assert/strict";
import { dataPath, getFile, putFile, deleteFile } from "../js/github.js";

function fakeFetch(routes) {
  return async (url, opts = {}) => {
    const key = `${opts.method || "GET"} ${url}`;
    const r = routes[key];
    if (!r) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: r.status < 400, status: r.status, json: async () => r.body };
  };
}

test("dataPath builds the per-user path", () => {
  assert.equal(dataPath("anirudh"), "moving-checklist/data/anirudh.enc.json");
});

test("getFile decodes base64 content and returns sha", async () => {
  const path = dataPath("anirudh");
  const content = Buffer.from(JSON.stringify({ hi: 1 })).toString("base64");
  const url = `https://api.github.com/repos/proxy-eval-max/proxy-eval-max.github.io/contents/${path}`;
  const f = fakeFetch({ [`GET ${url}`]: { status: 200, body: { content, sha: "abc" } } });
  const res = await getFile(path, null, f);
  assert.equal(res.sha, "abc");
  assert.equal(JSON.parse(res.text).hi, 1);
});

test("getFile returns null on 404", async () => {
  const res = await getFile(dataPath("nobody"), null, fakeFetch({}));
  assert.equal(res, null);
});

test("putFile without token throws no-token", async () => {
  await assert.rejects(() => putFile(dataPath("x"), "{}", "msg", null, null, fakeFetch({})), /no-token/);
});

test("putFile with token returns new sha", async () => {
  const path = dataPath("anirudh");
  const url = `https://api.github.com/repos/proxy-eval-max/proxy-eval-max.github.io/contents/${path}`;
  const f = fakeFetch({ [`PUT ${url}`]: { status: 200, body: { content: { sha: "new" } } } });
  const res = await putFile(path, "{}", "msg", "old", "tok", f);
  assert.equal(res.sha, "new");
});

test("putFile surfaces 409 as conflict", async () => {
  const path = dataPath("anirudh");
  const url = `https://api.github.com/repos/proxy-eval-max/proxy-eval-max.github.io/contents/${path}`;
  const f = fakeFetch({ [`PUT ${url}`]: { status: 409, body: {} } });
  await assert.rejects(() => putFile(path, "{}", "msg", "old", "tok", f), /conflict/);
});
