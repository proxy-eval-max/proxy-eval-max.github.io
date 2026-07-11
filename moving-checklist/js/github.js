export const OWNER = "proxy-eval-max";
export const REPO = "proxy-eval-max.github.io";
const API = "https://api.github.com";

export function dataPath(username) { return `moving-checklist/data/${username}.enc.json`; }
function url(path) { return `${API}/repos/${OWNER}/${REPO}/contents/${path}`; }
function b64encode(text) {
  // UTF-8 safe base64 encode, works in browser and Node.
  const bytes = new TextEncoder().encode(text);
  let bin = ""; for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function b64decode(b64) {
  const clean = (b64 || "").replace(/\n/g, "");
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
function headers(token) {
  const h = { "Accept": "application/vnd.github+json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

export async function getFile(path, token, fetchImpl = fetch) {
  const res = await fetchImpl(url(path), { headers: headers(token) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? "auth" : "read-failed");
  const body = await res.json();
  return { text: b64decode(body.content), sha: body.sha };
}

export async function putFile(path, text, message, sha, token, fetchImpl = fetch) {
  if (!token) throw new Error("no-token");
  const payload = { message, content: b64encode(text) };
  if (sha) payload.sha = sha;
  const res = await fetchImpl(url(path), {
    method: "PUT", headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.status === 409) throw new Error("conflict");
  if (res.status === 401 || res.status === 403) throw new Error("auth");
  if (!res.ok) throw new Error("write-failed");
  const body = await res.json();
  return { sha: body.content.sha };
}

export async function deleteFile(path, message, sha, token, fetchImpl = fetch) {
  if (!token) throw new Error("no-token");
  const res = await fetchImpl(url(path), {
    method: "DELETE", headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({ message, sha }),
  });
  if (res.status === 401 || res.status === 403) throw new Error("auth");
  if (!res.ok) throw new Error("delete-failed");
  return true;
}
