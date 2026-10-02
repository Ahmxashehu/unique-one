import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, Copy, Download, FileUp, QrCode, RefreshCw, ScanLine, Send, ShieldCheck, Smartphone, Users, X } from "lucide-react";
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

  const authenticated = Boolean(auth.currentUser) || guestReady;

  return (
    <main className="min-h-full overflow-y-auto bg-slate-950 pb-24 text-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="rounded-[2rem] border border-emerald-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/50 p-6 shadow-2xl sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-emerald-300"><ShieldCheck className="h-4 w-4" /> Unique One secure sharing</div>
              <h1 className="mt-2 text-4xl font-black tracking-tight">UniqueShare</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">A secure cycle-share environment: once A ↔ B connect, both users can send and receive at the same time, with separate transfer progress and authenticated storage boundaries.</p>
            </div>
            <Smartphone className="h-9 w-9 text-emerald-300" />
          </div>
        </header>

        {!authenticated ? (
          <section className="mt-5 rounded-3xl border border-amber-400/20 bg-amber-950/30 p-6 text-sm text-amber-100">Sign in to use UniqueShare. Anonymous sharing is intentionally disabled.</section>
        ) : mode === "home" ? (
          <section className="mt-5 grid gap-4 md:grid-cols-2">
            <button type="button" disabled={busy} onClick={() => void startSend()} className="rounded-3xl border border-emerald-400/20 bg-white p-7 text-left text-slate-950 shadow-xl transition hover:-translate-y-0.5 disabled:opacity-50">
              <Send className="h-8 w-8 text-emerald-600" /><h2 className="mt-5 text-xl font-black">Send</h2><p className="mt-2 text-sm leading-6 text-slate-500">Create a one-time authenticated connection and send any file type directly into the receiver's UniqueShare storage.</p>
            </button>
            <button type="button" onClick={() => { setMode("receive"); setMessage("Scan the sender's secure QR or enter the connection token."); }} className="rounded-3xl border border-emerald-400/20 bg-slate-900 p-7 text-left shadow-xl transition hover:-translate-y-0.5">
              <ScanLine className="h-8 w-8 text-emerald-300" /><h2 className="mt-5 text-xl font-black">Receive</h2><p className="mt-2 text-sm leading-6 text-slate-300">Verify another authenticated Unique One user and accept the connection before receiving files.</p>
            </button>
          </section>
        ) : mode === "send" ? (
          <section className="mt-5 space-y-4">
            <div className="rounded-3xl border border-emerald-400/20 bg-slate-900 p-6">
              <div className="flex items-center gap-3"><QrCode className="h-6 w-6 text-emerald-300" /><div><h2 className="font-black">Secure connection</h2><p className="text-xs text-slate-400">One-time session · expires in 5 minutes</p></div></div>
              <div className="mt-5 break-all rounded-2xl border border-emerald-400/20 bg-black/30 p-5 text-center font-mono text-sm text-emerald-200">{connectionToken}</div>
              <div className="mt-3 flex gap-2"><button type="button" onClick={() => void copyToken()} className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black"><Copy className="mr-2 inline h-4 w-4" />Copy connection</button><button type="button" onClick={() => void reset()} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold"><X className="inline h-4 w-4" /></button></div>
              <p className="mt-3 text-xs text-slate-400">QR scanning is available on supported browsers. The camera preview is shown while scanning, and the authenticated token remains the pairing credential.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-900 p-6"><div className="flex items-center gap-3"><CheckCircle2 className={session?.status === "accepted" ? "h-6 w-6 text-emerald-300" : "h-6 w-6 text-slate-500"} /><p className="font-bold">{session?.status === "accepted" ? "Receiver accepted — ready to send." : "Waiting for receiver to connect and accept…"}</p></div></div>
            {session?.status === "accepted" && <TransferPanel files={files} selectedFiles={selectedFiles} setSelectedFiles={setSelectedFiles} uploadProgress={uploadProgress} busy={busy} onUpload={() => void uploadSelected()} />}
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
                <div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-emerald-300" /><div><h2 className="font-black">Authenticated connection</h2><p className="text-xs text-slate-400">Sender: {session.senderUid}</p></div></div>
                {session.status === "connected" && <button type="button" disabled={busy} onClick={() => void acceptReceive()} className="mt-5 w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black disabled:opacity-40"><CheckCircle2 className="mr-2 inline h-4 w-4" />Accept and receive</button>}
                {session.status === "accepted" && <CyclePanel files={files} selectedFiles={selectedFiles} setSelectedFiles={setSelectedFiles} uploadProgress={uploadProgress} busy={busy} onUpload={() => void uploadSelected()} onDownload={downloadFile} />}
              </div>
            )}
          </section>
        )}

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
      <div className="flex items-center gap-3"><FileUp className="h-6 w-6 text-emerald-600" /><div><h2 className="font-black">Send to connected peer</h2><p className="text-xs text-slate-500">The same authenticated connection can send in either direction.</p></div></div>
      <input type="file" multiple onChange={e => setSelectedFiles(Array.from(e.target.files || []))} className="mt-5 block w-full rounded-2xl border border-slate-200 p-3 text-sm" />
      {selectedFiles.map(file => <div key={file.name + file.size} className="mt-2 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs"><span className="truncate">{file.name}</span><span>{formatBytes(file.size)} {uploadProgress[file.name] !== undefined ? "· " + uploadProgress[file.name] + "%" : ""}</span></div>)}
      <button type="button" disabled={busy || !selectedFiles.length} onClick={onUpload} className="mt-4 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-40">Send now</button>
    </div>
    <div className="rounded-3xl border border-emerald-400/20 bg-slate-900 p-6">
      <div className="flex items-center gap-3"><Users className="h-6 w-6 text-emerald-300" /><div><h2 className="font-black">Receive from connected peer</h2><p className="text-xs text-slate-400">Incoming files remain inside your authenticated UniqueShare boundary.</p></div></div>
      {!available.length ? <p className="mt-5 text-sm text-slate-400">Waiting for incoming files…</p> : <div className="mt-4 space-y-2">{available.map(file => <div key={file.fileId} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{file.name}</p><p className="text-xs text-slate-500">{file.contentType} · {formatBytes(file.sizeBytes)}</p></div><button type="button" onClick={() => onDownload(file)} className="rounded-xl bg-emerald-600 p-2" aria-label={"Download " + file.name}><Download className="h-4 w-4" /></button></div>)}</div>}
    </div>
  </div>;
}
