import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, Copy, Download, FileUp, QrCode, RefreshCw, ScanLine, Send, Share2, ShieldCheck, Smartphone, Users, X } from "lucide-react";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { auth, storage } from "../lib/firebase";
import { signInAnonymously } from "firebase/auth";
import {
  acceptUniqueShareSession,
  connectUniqueShareSession,
  createUniqueShareSession,
  getUniqueShareSession,
  listUniqueShareFiles,
  prepareUniqueShareFile,
  revokeUniqueShareSession,
  type UniqueShareFile,
  type UniqueShareSession,
  completeUniqueShareFile,
} from "../lib/uniqueShare";

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => {
      detect(source: CanvasImageSource | ImageBitmap | Blob): Promise<Array<{ rawValue?: string; format?: string }>>;
    };
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MB";
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + " GB";
}

function splitConnectionToken(token: string) {
  const parts = token.split(".");
  return parts.length === 3 ? { sessionId: parts[1], token } : null;
}

export default function UniqueSharePage() {
  const [mode, setMode] = useState<"home" | "send" | "receive">("home");
  const [session, setSession] = useState<UniqueShareSession | null>(null);
  const [connectionToken, setConnectionToken] = useState("");
  const [inputToken, setInputToken] = useState("");
  const [files, setFiles] = useState<UniqueShareFile[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [localPeers, setLocalPeers] = useState<Array<{ endpointId: string; name: string }>>([]);
  const [localConnected, setLocalConnected] = useState<string[]>([]);
  const [localRequest, setLocalRequest] = useState<{ endpointId: string; name: string; authenticationDigits: string } | null>(null);
  const [localMedia, setLocalMedia] = useState<Array<{ id: string; name: string; mime: string; size: number }>>([]);
  const [localSelected, setLocalSelected] = useState<string[]>([]);
  const [localCategory, setLocalCategory] = useState<"all" | "video" | "audio" | "image" | "pdf">("all");
  const [localMessage, setLocalMessage] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanStreamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);

  const stopScanner = () => {
    if (scanTimerRef.current) window.clearInterval(scanTimerRef.current);
    scanTimerRef.current = null;
    scanStreamRef.current?.getTracks().forEach(track => track.stop());
    scanStreamRef.current = null;
  };

  useEffect(() => () => stopScanner(), []);

  useEffect(() => {
    const onEvent = (name: string, handler: (detail: any) => void) => {
      const listener = (event: Event) => handler((event as CustomEvent).detail || {});
      window.addEventListener(name, listener);
      return () => window.removeEventListener(name, listener);
    };
    const cleanups = [
      onEvent("localSharePeerFound", detail => setLocalPeers(current => current.some(peer => peer.endpointId === detail.endpointId) ? current : [...current, detail])),
      onEvent("localSharePeerLost", detail => setLocalPeers(current => current.filter(peer => peer.endpointId !== detail.endpointId))),
      onEvent("localShareConnected", detail => { sessionStorage.setItem("uniqueShareLocalConnected", JSON.stringify({ endpointId: detail.endpointId, name: detail.name || detail.endpointName || "Nearby device" })); setLocalConnected(current => current.includes(detail.endpointId) ? current : [...current, detail.endpointId]); setLocalMessage("Nearby UniqueShare connection established."); }),
      onEvent("localShareDisconnected", detail => { sessionStorage.removeItem("uniqueShareLocalConnected"); setLocalConnected(current => current.filter(id => id !== detail.endpointId)); }),
      onEvent("localShareConnectionRequest", detail => setLocalRequest(detail)),
      onEvent("localShareFileReceived", detail => {
        setLocalMessage("Received " + (detail.name || "a file") + " directly from the nearby device. It is now available in UniqueMedia.");
        try {
          const record = { id: detail.id || crypto.randomUUID(), name: detail.name || "Received file", mime: detail.mime || detail.contentType || "application/octet-stream", size: Number(detail.size || 0) };
          setLocalMedia(current => current.some(item => item.id === record.id) ? current : [record, ...current]);
        } catch {}
      }),
      onEvent("localShareProgress", detail => {
        if (detail.totalBytes > 0) setLocalMessage("Local transfer " + Math.round(detail.bytesTransferred / detail.totalBytes * 100) + "%");
      }),
      onEvent("localShareError", detail => setLocalMessage(detail.message || "Nearby sharing encountered an error."))
    ];
    return () => cleanups.forEach(cleanup => cleanup());
  }, []);

  const native = () => (window as any).UniqueNativeStorage || null;
  const startNearby = async () => {
    const bridge = native();
    if (!bridge) { setLocalMessage("Native nearby sharing is available in the Android app build."); return; }
    if (!bridge.hasLocalShareAccess?.()) {
      bridge.requestLocalShareAccess?.();
      setLocalMessage("Allow Nearby Devices access, then start nearby sharing again.");
      return;
    }
    try {
      bridge.startLocalShareAdvertising?.();
      bridge.startLocalShareDiscovery?.();
      const records = JSON.parse(bridge.listMediaPage?.(0, 50) || "[]");
      setLocalMedia(records);
      setLocalMessage("Nearby discovery and advertising started. Keep both phones close and visible.");
    } catch (error) {
      setLocalMessage(error instanceof Error ? error.message : "Could not start nearby sharing.");
    }
  };

  const connectNearby = (endpointId: string) => {
    try { native()?.connectLocalSharePeer?.(endpointId); setLocalMessage("Connection request sent."); }
    catch (error) { setLocalMessage(error instanceof Error ? error.message : "Could not connect."); }
  };

  const sendNearby = () => {
    try {
      if (!localSelected.length) { setLocalMessage("Select media first."); return; }
      native()?.sendLocalShareMedia?.(JSON.stringify(localSelected));
      setLocalMessage(localSelected.length + " media item" + (localSelected.length === 1 ? "" : "s") + " sent. Receiving devices get them automatically in UniqueMedia.");
    } catch (error) { setLocalMessage(error instanceof Error ? error.message : "Could not start local transfer."); }
  };

  const localKind = (item: { mime: string; name: string }) => {
    const mime = (item.mime || "").toLowerCase();
    const name = item.name.toLowerCase();
    if (mime.startsWith("video/")) return "video" as const;
    if (mime.startsWith("audio/")) return "audio" as const;
    if (mime.startsWith("image/")) return "image" as const;
    if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf" as const;
    return "other" as const;
  };

  const localVisibleMedia = localMedia.filter(item => localCategory === "all" || localKind(item) === localCategory);
  const localCategories = [
    ["all", "All media"],
    ["video", "Videos"],
    ["audio", "Audio"],
    ["image", "Images"],
    ["pdf", "PDF Reader"],
  ] as const;

  useEffect(() => {
    if (!session?.sessionId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const next = await getUniqueShareSession(session.sessionId);
        if (!cancelled) setSession(current => current ? { ...current, ...next } : next);
        const listed = await listUniqueShareFiles(session.sessionId);
        if (!cancelled) setFiles(listed.files);
      } catch {}
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [session?.sessionId]);

  const startSend = async () => {
    try {
      setBusy(true);
      setMessage("");
      const created = await createUniqueShareSession();
      setSession(created);
      setConnectionToken(created.connectionToken || "");
      setMode("send");
      setMessage("Show the secure connection token to the receiver. It expires in 5 minutes.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start UniqueShare.");
    } finally {
      setBusy(false);
    }
  };

  const connectReceive = async () => {
    try {
      setBusy(true);
      const parsed = splitConnectionToken(inputToken.trim());
      if (!parsed) throw new Error("Enter a valid UniqueShare connection token.");
      const connected = await connectUniqueShareSession(parsed.sessionId, parsed.token);
      setSession(connected);
      setMode("receive");
      setMessage("Connection verified. Review the sender and explicitly accept before files can be transferred.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not connect.");
    } finally {
      setBusy(false);
    }
  };

  const acceptReceive = async () => {
    if (!session) return;
    try {
      setBusy(true);
      const accepted = await acceptUniqueShareSession(session.sessionId);
      setSession(current => current ? { ...current, ...accepted } : accepted);
      setMessage("Connection accepted. The sender can now securely upload files into your UniqueShare storage.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not accept the connection.");
    } finally {
      setBusy(false);
    }
  };

  const startScanner = async () => {
    if (!window.BarcodeDetector) {
      setMessage("QR scanning is not available in this browser. Use the secure token field instead.");
      return;
    }
    try {
      stopScanner();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      scanStreamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      setScanning(true);
    scanTimerRef.current = window.setInterval(async () => {
        if (!videoRef.current) return;
        try {
          const results = await detector.detect(videoRef.current);
          const value = results.find(result => result.format === "qr_code" && result.rawValue)?.rawValue;
          if (value) {
            setInputToken(value);
            stopScanner();
            setMessage("Secure QR detected. Tap Connect to verify the connection.");
          }
        } catch {}
      }, 350);
    } catch {
      setMessage("Camera access was not granted. You can still enter the secure UniqueShare token manually.");
    }
  };

  const uploadSelected = async () => {
    if (!session || session.status !== "accepted" || !selectedFiles.length) return;
    try {
      setBusy(true);
      for (const file of selectedFiles) {
        if (file.size > 2 * 1024 * 1024 * 1024) {
          setMessage(file.name + " is larger than the 2 GB web transfer limit.");
          continue;
        }
        const prepared = await prepareUniqueShareFile(session.sessionId, file);
        await new Promise<void>((resolve, reject) => {
          const task = uploadBytesResumable(ref(storage, prepared.storagePath), file, {
            contentType: file.type || "application/octet-stream",
            customMetadata: {
              source: "UniqueShare",
              originalName: file.name,
              senderUid: auth.currentUser?.uid || "",
              sessionId: session.sessionId,
            },
          });
          task.on("state_changed",
            snapshot => setUploadProgress(current => ({ ...current, [file.name]: Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100) })),
            reject,
            resolve,
          );
        });
        await completeUniqueShareFile(session.sessionId, prepared.fileId);
      }
      setSelectedFiles([]);
      setMessage("Transfer complete. Files are now stored under the receiver's authenticated UniqueShare storage.");
      const listed = await listUniqueShareFiles(session.sessionId);
      setFiles(listed.files);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "A file transfer could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  const downloadFile = async (file: UniqueShareFile) => {
    try {
      const url = await getDownloadURL(ref(storage, file.storagePath));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.name;
      anchor.rel = "noopener";
      anchor.click();
    } catch {
      setMessage("The file could not be opened from your UniqueShare storage.");
    }
  };

  const copyToken = async () => {
    await navigator.clipboard?.writeText(connectionToken);
    setMessage("UniqueShare connection token copied.");
  };

  const shareConnection = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "UniqueShare", text: "Connect to my UniqueShare session.", url: connectionToken });
        setMessage("UniqueShare connection shared.");
      } else {
        await copyToken();
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("Use Copy connection to share the secure code.");
    }
  };

  const reset = async () => {
    stopScanner();
    if (session) {
      try { await revokeUniqueShareSession(session.sessionId); } catch {}
    }
    setSession(null);
    setConnectionToken("");
    setInputToken("");
    setFiles([]);
    setSelectedFiles([]);
    setUploadProgress({});
    setMode("home");
    setMessage("");
  };

  const [guestReady, setGuestReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const ensureGuestAccess = async () => {
      if (auth.currentUser) { if (!cancelled) setGuestReady(true); return; }
      try {
        await signInAnonymously(auth);
        if (!cancelled) setGuestReady(true);
      } catch {
        if (!cancelled) setGuestReady(false);
      }
    };
    void ensureGuestAccess();
    return () => { cancelled = true; };
  }, []);

  const guestAccessReady = Boolean(auth.currentUser) || guestReady;

  const requestedMode = new URLSearchParams(window.location.search).get("mode");
  const launchIntentHandled = useRef(false);
  useEffect(() => {
    if (!guestAccessReady || launchIntentHandled.current) return;
    if (requestedMode !== "send" && requestedMode !== "receive") return;
    launchIntentHandled.current = true;
    if (requestedMode === "send") {
      void startSend();
    } else {
      setMode("receive");
      setMessage("Scan the sender's secure QR or enter the connection token.");
    }
  }, [guestAccessReady, requestedMode]);

  return (
    <main className="min-h-full overflow-y-auto bg-slate-950 pb-24 text-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="relative rounded-[2rem] border border-emerald-400/20 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/60 p-5 shadow-2xl sm:p-7">
          <div className="relative flex items-center justify-center">
            <div className="inline-flex items-center gap-3 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-5 py-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg ring-4 ring-emerald-500/10"><Share2 className="h-5 w-5" /></span>
              <div className="text-left"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Smart Share</p><h1 className="text-xl font-black tracking-tight text-white">UniqueShare</h1></div>
            </div>
          </div>
          <p className="relative mt-3 text-center text-xs text-slate-400">Guest sharing · no login or registration · connect → choose files → send or receive.</p>
        </header>

        {!guestAccessReady ? (
          <section className="mt-5 rounded-3xl border border-amber-400/20 bg-amber-950/30 p-6 text-sm text-amber-100">Guest sharing is available. No registration or login is required.</section>
        ) : mode === "home" ? (
          <section className="mt-5">
            <div className="relative overflow-hidden rounded-[2rem] border border-emerald-400/20 bg-gradient-to-br from-white via-emerald-50 to-white p-5 text-slate-950 shadow-xl sm:p-7">
              <div className="relative">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Smart transfer</p><h2 className="mt-1 text-2xl font-black tracking-tight">Share anything, receive safely.</h2><p className="mt-1 text-xs leading-5 text-slate-500">Choose a side. UniqueShare creates the connection automatically, then moves to the next transfer step.</p></div>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg ring-4 ring-emerald-100"><Share2 className="h-5 w-5" /></div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button type="button" disabled={busy} onClick={() => void startSend()} className="group rounded-3xl border border-emerald-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-400 disabled:opacity-50">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white"><Send className="h-5 w-5" /></span><h3 className="mt-4 font-black">Send</h3><p className="mt-1 text-xs leading-5 text-slate-500">Choose files and create a secure connection</p>
                  </button>
                  <button type="button" onClick={() => { setMode("receive"); setMessage("Scan the sender's secure QR or enter the connection token."); }} className="group rounded-3xl border border-slate-800 bg-slate-950 p-5 text-left text-white shadow-sm transition hover:-translate-y-0.5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white"><ScanLine className="h-5 w-5" /></span><h3 className="mt-4 font-black">Receive</h3><p className="mt-1 text-xs leading-5 text-slate-400">Connect to a sender</p>
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px] font-bold text-slate-500">
                  <div className="rounded-2xl bg-white/80 px-2 py-3"><span className="block text-emerald-700">01</span>Connect</div>
                  <div className="rounded-2xl bg-white/80 px-2 py-3"><span className="block text-emerald-700">02</span>Choose</div>
                  <div className="rounded-2xl bg-white/80 px-2 py-3"><span className="block text-emerald-700">03</span>Receive</div>
                </div>
              </div>
            </div>
          </section>
        ) : mode === "send" ? (
          <section className="mt-5 space-y-4">
            <div className="rounded-3xl border border-emerald-400/20 bg-slate-900 p-6">
              <div className="flex items-center gap-3"><QrCode className="h-6 w-6 text-emerald-300" /><div><h2 className="font-black">Secure connection</h2><p className="text-xs text-slate-400">One-time session · expires in 5 minutes</p></div></div>
              <div className="mt-5 break-all rounded-2xl border border-emerald-400/20 bg-black/30 p-5 text-center font-mono text-sm text-emerald-200">{connectionToken}</div>
              <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => void shareConnection()} className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black"><Share2 className="mr-2 inline h-4 w-4" />Share</button><button type="button" onClick={() => void copyToken()} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black"><Copy className="mr-2 inline h-4 w-4" />Copy</button></div><button type="button" onClick={() => void reset()} className="mt-2 w-full rounded-2xl border border-white/10 px-4 py-2 text-xs font-bold text-slate-400">Cancel connection</button>
              <p className="mt-3 text-xs text-slate-400">QR scanning is available on supported browsers. The camera preview is shown while scanning, and the secure token remains the pairing credential.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-900 p-6"><div className="flex items-center gap-3"><CheckCircle2 className={session?.status === "accepted" ? "h-6 w-6 text-emerald-300" : "h-6 w-6 text-slate-500"} /><p className="font-bold">{session?.status === "accepted" ? "Receiver accepted — ready to send." : "Waiting for receiver to connect and accept…"}</p></div></div>
            {session?.status === "accepted" && <CyclePanel files={files} selectedFiles={selectedFiles} setSelectedFiles={setSelectedFiles} uploadProgress={uploadProgress} busy={busy} onUpload={() => void uploadSelected()} onDownload={downloadFile} />}
          </section>
        ) : (
          <section className="mt-5 space-y-4">
            {!session ? (
              <div className="rounded-3xl border border-emerald-400/20 bg-slate-900 p-6">
                <div className="flex items-center gap-3"><ScanLine className="h-6 w-6 text-emerald-300" /><h2 className="font-black">Connect securely</h2></div>
                <button type="button" onClick={() => void startScanner()} className="mt-5 w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black disabled:opacity-40" disabled={scanning}><ScanLine className="mr-2 inline h-4 w-4" />{scanning ? "Scanning secure QR…" : "Scan secure QR"}</button>
                <video ref={videoRef} muted playsInline className="mt-4 aspect-video w-full rounded-2xl bg-black object-cover" aria-label="UniqueShare QR scanner camera" />
                <div className="my-4 text-center text-xs font-bold text-slate-500">OR ENTER CONNECTION TOKEN</div>
                <input value={inputToken} onChange={e => setInputToken(e.target.value)} placeholder="U1SHARE1.…" className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-xs text-white outline-none focus:border-emerald-400" />
                <div className="mt-3 flex gap-2"><button type="button" disabled={busy || !inputToken.trim()} onClick={() => void connectReceive()} className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black disabled:opacity-40">Connect</button><button type="button" onClick={() => void reset()} className="rounded-2xl border border-white/10 px-4 py-3"><X className="h-4 w-4" /></button></div>
              </div>
            ) : (
              <div className="rounded-3xl border border-emerald-400/20 bg-slate-900 p-6">
                <div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-emerald-300" /><div><h2 className="font-black">Secure connection</h2><p className="text-xs text-slate-400">Connected to sender</p></div></div>
                {session.status === "connected" && <button type="button" disabled={busy} onClick={() => void acceptReceive()} className="mt-5 w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black disabled:opacity-40"><CheckCircle2 className="mr-2 inline h-4 w-4" />Accept and receive</button>}
                {session.status === "accepted" && <CyclePanel files={files} selectedFiles={selectedFiles} setSelectedFiles={setSelectedFiles} uploadProgress={uploadProgress} busy={busy} onUpload={() => void uploadSelected()} onDownload={downloadFile} />}
              </div>
            )}
          </section>
        )}

        <section className="mt-5 rounded-3xl border border-emerald-400/20 bg-slate-900 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><div className="flex items-center gap-2"><Smartphone className="h-5 w-5 text-emerald-300" /><h2 className="font-black">Nearby A ↔ B transfer</h2></div><p className="mt-1 text-xs leading-5 text-slate-400">Native Android transport for nearby peer-to-peer sharing. Cloud UniqueShare remains the fallback.</p></div>
            <button type="button" onClick={() => void startNearby()} className="rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black">Start nearby</button>
          </div>
          {localPeers.length > 0 && <div className="mt-4 space-y-2">{localPeers.map(peer => <div key={peer.endpointId} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3"><div className="min-w-0 flex-1"><p className="font-bold">{peer.name || "UniquePlatform device"}</p><p className="text-[11px] text-slate-500">{peer.endpointId}</p></div><button type="button" onClick={() => connectNearby(peer.endpointId)} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-950">Connect</button></div>)}</div>}
          {localRequest && <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-950/30 p-4"><p className="text-xs text-slate-300">Nearby device wants to connect. Verify the authentication code on both phones:</p><p className="mt-2 text-center font-mono text-2xl font-black text-emerald-300">{localRequest.authenticationDigits}</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => { native()?.acceptLocalShareConnection?.(localRequest.endpointId); setLocalRequest(null); }} className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black">Accept</button><button type="button" onClick={() => { native()?.rejectLocalShareConnection?.(localRequest.endpointId); setLocalRequest(null); }} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold">Reject</button></div></div>}
          {localConnected.length > 0 && <div className="mt-4 overflow-hidden rounded-3xl border border-emerald-400/20 bg-emerald-950/20">
            <div className="p-4">
              <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black text-emerald-200">Connected nearby</p><p className="mt-1 text-[11px] text-slate-400">{localConnected.length} peer · choose from your media library to send</p></div><span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black text-emerald-300">LIVE</span></div>
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {localCategories.map(([value, label]) => <button key={value} type="button" onClick={() => setLocalCategory(value)} className={"shrink-0 rounded-full px-3 py-2 text-[11px] font-black " + (localCategory === value ? "bg-emerald-500 text-slate-950" : "bg-white/5 text-slate-300")}>{label}</button>)}
              </div>
              {localVisibleMedia.length > 0 ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{localVisibleMedia.map(item => <label key={item.id} className={"flex cursor-pointer items-center gap-3 rounded-2xl border p-3 text-xs " + (localSelected.includes(item.id) ? "border-emerald-400/50 bg-emerald-400/10" : "border-white/10 bg-black/20")}><input type="checkbox" checked={localSelected.includes(item.id)} onChange={() => setLocalSelected(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id])} /><span className="min-w-0 flex-1"><span className="block truncate font-bold text-white">{item.name}</span><span className="text-[10px] text-slate-500">{localKind(item)} · {formatBytes(item.size)}</span></span></label>)}</div> : <div className="mt-3 rounded-2xl border border-dashed border-white/10 p-4 text-center text-xs text-slate-500">No media in this category on the connected phone.</div>}
              <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => { sessionStorage.setItem("uniqueShareLocalMode", "send"); window.location.assign("/media"); }} className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-3 text-xs font-black text-emerald-200">Open Media</button><button type="button" disabled={!localSelected.length} onClick={sendNearby} className="flex-1 rounded-2xl bg-emerald-600 px-3 py-3 text-xs font-black disabled:opacity-40"><Send className="mr-1 inline h-4 w-4" />Send {localSelected.length ? localSelected.length + " selected" : "selected media"}</button><button type="button" onClick={() => { setLocalSelected([]); setLocalCategory("all"); }} className="rounded-2xl border border-white/10 px-3 py-3 text-xs font-bold text-slate-300">Clear</button></div>
              <p className="mt-3 text-[10px] leading-5 text-slate-500">Receive mode is automatic: accepted files are written to the device's UniqueMedia library and appear with a NEW indicator.</p>
            </div>
          </div>}
          {localMessage && <p className="mt-3 text-xs font-semibold text-emerald-300">{localMessage}</p>}
        </section>

        {message && <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-950/40 px-4 py-3 text-xs font-semibold leading-5 text-emerald-100">{message}</div>}
      </div>
    </main>
  );
}

function CyclePanel({ files, selectedFiles, setSelectedFiles, uploadProgress, busy, onUpload, onDownload }: {
  files: UniqueShareFile[];
  selectedFiles: File[];
  setSelectedFiles: React.Dispatch<React.SetStateAction<File[]>>;
  uploadProgress: Record<string, number>;
  busy: boolean;
  onUpload: () => void;
  onDownload: (file: UniqueShareFile) => void;
}) {
  const available = files.filter(file => file.status === "available");
  return <div className="mt-5 grid gap-4 lg:grid-cols-2">
    <div className="rounded-3xl border border-emerald-400/20 bg-white p-6 text-slate-950">
      <div className="flex items-center gap-3"><FileUp className="h-6 w-6 text-emerald-600" /><div><h2 className="font-black">Send to connected peer</h2><p className="text-xs text-slate-500">The same secure connection can send in either direction.</p></div></div>
      <input type="file" multiple onChange={e => setSelectedFiles(Array.from(e.target.files || []))} className="mt-5 block w-full rounded-2xl border border-slate-200 p-3 text-sm" />
      {selectedFiles.map(file => <div key={file.name + file.size} className="mt-2 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs"><span className="truncate">{file.name}</span><span>{formatBytes(file.size)} {uploadProgress[file.name] !== undefined ? "· " + uploadProgress[file.name] + "%" : ""}</span></div>)}
      <button type="button" disabled={busy || !selectedFiles.length} onClick={onUpload} className="mt-4 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-40">Send now</button>
    </div>
    <div className="rounded-3xl border border-emerald-400/20 bg-slate-900 p-6">
      <div className="flex items-center gap-3"><Users className="h-6 w-6 text-emerald-300" /><div><h2 className="font-black">Receive from connected peer</h2><p className="text-xs text-slate-400">Incoming files remain inside this secure UniqueShare connection.</p></div></div>
      {!available.length ? <p className="mt-5 text-sm text-slate-400">Waiting for incoming files…</p> : <div className="mt-4 space-y-2">{available.map(file => <div key={file.fileId} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{file.name}</p><p className="text-xs text-slate-500">{file.contentType} · {formatBytes(file.sizeBytes)}</p></div><button type="button" onClick={() => onDownload(file)} className="rounded-xl bg-emerald-600 p-2" aria-label={"Download " + file.name}><Download className="h-4 w-4" /></button></div>)}</div>}
    </div>
  </div>;
}
