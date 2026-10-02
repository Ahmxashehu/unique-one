import { auth } from "./firebase";

export type UniqueShareSession = {
  sessionId: string;
  connectionToken?: string;
  status: "waiting" | "connected" | "accepted" | "completed" | "revoked" | "expired";
  senderUid: string;
  receiverUid?: string | null;
  expiresAt: string | null;
};

export type UniqueShareFile = {
  fileId: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  storagePath: string;
  status: "pending" | "available";
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in is required for UniqueShare.");
  const token = await user.getIdToken();
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || "UniqueShare request failed.");
  return payload as T;
}

export async function createUniqueShareSession() {
  return request<UniqueShareSession & { protocol: string }>("/api/unique-share/sessions", { method: "POST", body: "{}" });
}

export async function connectUniqueShareSession(sessionId: string, connectionToken: string) {
  return request<UniqueShareSession>("/api/unique-share/sessions/" + encodeURIComponent(sessionId) + "/connect", {
    method: "POST",
    body: JSON.stringify({ connectionToken }),
  });
}

export async function getUniqueShareSession(sessionId: string) {
  return request<UniqueShareSession>("/api/unique-share/sessions/" + encodeURIComponent(sessionId));
}

export async function acceptUniqueShareSession(sessionId: string) {
  return request<UniqueShareSession>("/api/unique-share/sessions/" + encodeURIComponent(sessionId) + "/accept", {
    method: "POST",
    body: "{}",
  });
}

export async function revokeUniqueShareSession(sessionId: string) {
  return request<UniqueShareSession>("/api/unique-share/sessions/" + encodeURIComponent(sessionId) + "/revoke", {
    method: "POST",
    body: "{}",
  });
}

export async function prepareUniqueShareFile(sessionId: string, file: File) {
  return request<UniqueShareFile>("/api/unique-share/sessions/" + encodeURIComponent(sessionId) + "/files", {
    method: "POST",
    body: JSON.stringify({ name: file.name, contentType: file.type || "application/octet-stream", sizeBytes: file.size }),
  });
}

export async function completeUniqueShareFile(sessionId: string, fileId: string) {
  return request<{ fileId: string; status: "available" }>(
    "/api/unique-share/sessions/" + encodeURIComponent(sessionId) + "/files/" + encodeURIComponent(fileId) + "/complete",
    { method: "POST", body: "{}" },
  );
}

export async function listUniqueShareFiles(sessionId: string) {
  return request<{ files: UniqueShareFile[] }>("/api/unique-share/sessions/" + encodeURIComponent(sessionId) + "/files");
}
