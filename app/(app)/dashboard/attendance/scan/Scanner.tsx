'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { recordScanAction, type ScanResult } from '@/app/actions/attendance';

// Chromium ships BarcodeDetector natively; Safari/Firefox don't, so those
// fall back to jsQR (dynamically imported — it never loads where the native
// detector exists). Minimal type surface since TS lib.dom has no definitions.
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats: string[] }) => BarcodeDetectorLike;
  }
}

type CameraState = 'starting' | 'active' | 'denied' | 'unavailable';

interface CheckedInEntry {
  name: string;
  headshot: string | null;
  at: string;
}

// How long the result banner for a scan stays up, and how long the same
// decoded token is ignored so one badge held under the camera doesn't fire
// the action every frame.
const RESULT_MS = 3000;
const SAME_TOKEN_COOLDOWN_MS = 8000;

export function Scanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busyRef = useRef(false);
  const lastTokenRef = useRef<{ value: string; at: number } | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [camera, setCamera] = useState<CameraState>('starting');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [checkedIn, setCheckedIn] = useState<CheckedInEntry[]>([]);

  const handleDecoded = useCallback(async (token: string) => {
    const now = Date.now();
    const last = lastTokenRef.current;
    if (busyRef.current) return;
    if (last && last.value === token && now - last.at < SAME_TOKEN_COOLDOWN_MS) {
      return;
    }

    busyRef.current = true;
    lastTokenRef.current = { value: token, at: now };
    try {
      const res = await recordScanAction(token);
      setResult(res);
      if (res.success && !res.alreadyCheckedIn && res.memberName) {
        setCheckedIn((prev) => [
          {
            name: res.memberName!,
            headshot: res.headshot ?? null,
            at: new Date().toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            }),
          },
          ...prev,
        ]);
      }
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
      resultTimerRef.current = setTimeout(() => setResult(null), RESULT_MS);
    } finally {
      busyRef.current = false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let detector: BarcodeDetectorLike | null = null;
    let jsqr: typeof import('jsqr').default | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamera('unavailable');
        return;
      }

      try {
        // Rear camera on phones; whatever exists on laptops.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setCamera('active');
      } catch {
        setCamera('denied');
        return;
      }

      if (window.BarcodeDetector) {
        try {
          detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        } catch {
          detector = null;
        }
      }
      if (!detector) {
        jsqr = (await import('jsqr')).default;
      }

      // ~5 fps is plenty for a code held up to the camera and keeps the
      // main thread cool on older phones.
      interval = setInterval(async () => {
        const video = videoRef.current;
        if (!video || video.readyState < video.HAVE_ENOUGH_DATA) return;

        try {
          if (detector) {
            const codes = await detector.detect(video);
            const raw = codes[0]?.rawValue;
            if (raw) void handleDecoded(raw);
            return;
          }

          if (!jsqr) return;
          if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
          const canvas = canvasRef.current;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx || !canvas.width || !canvas.height) return;
          ctx.drawImage(video, 0, 0);
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsqr(image.data, image.width, image.height, {
            inversionAttempts: 'dontInvert',
          });
          if (code?.data) void handleDecoded(code.data);
        } catch {
          // A single bad frame (e.g. camera mid-rotation) is not worth
          // surfacing; the next tick just tries again.
        }
      }, 200);
    }

    void start();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [handleDecoded]);

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl border border-gray-100 bg-black shadow-card">
        {/* The camera preview. Mirrored is wrong for rear cameras, so no flip. */}
        <video
          ref={videoRef}
          playsInline
          muted
          className="aspect-[3/4] w-full object-cover sm:aspect-video"
        />

        {camera !== 'active' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 text-center text-white">
            <Camera className="h-8 w-8 opacity-80" />
            {camera === 'starting' && <p className="text-sm">Starting camera…</p>}
            {camera === 'denied' && (
              <p className="text-sm">
                Camera access was blocked. Allow camera access for this site in
                your browser settings, then reload this page.
              </p>
            )}
            {camera === 'unavailable' && (
              <p className="text-sm">
                This device doesn&apos;t have a usable camera. Use the manual
                checklist on the attendance page instead.
              </p>
            )}
          </div>
        )}

        {result && (
          <div
            role="status"
            className={`absolute inset-x-0 bottom-0 flex items-center gap-3 p-4 text-white ${
              result.success && !result.alreadyCheckedIn
                ? 'bg-green-600/95'
                : result.success
                  ? 'bg-amber-500/95'
                  : 'bg-red-600/95'
            }`}
          >
            {result.headshot ? (
              <img
                src={result.headshot}
                alt=""
                className="h-12 w-12 flex-shrink-0 rounded-full border-2 border-white object-cover"
              />
            ) : result.success && !result.alreadyCheckedIn ? (
              <CheckCircle2 className="h-8 w-8 flex-shrink-0" />
            ) : result.success ? (
              <AlertTriangle className="h-8 w-8 flex-shrink-0" />
            ) : (
              <XCircle className="h-8 w-8 flex-shrink-0" />
            )}
            <div className="min-w-0">
              {result.success ? (
                <>
                  <p className="truncate text-lg font-bold">{result.memberName}</p>
                  <p className="text-sm opacity-90">
                    {result.alreadyCheckedIn
                      ? 'Already checked in this week'
                      : 'Checked in'}
                  </p>
                </>
              ) : (
                <p className="text-sm font-medium">{result.message}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {checkedIn.length > 0 && (
        <div className="mt-6 rounded-xl border border-gray-100 bg-card p-5 shadow-card">
          <h2 className="text-sm font-semibold text-card-foreground">
            Checked in this session · {checkedIn.length}
          </h2>
          <ul className="mt-3 divide-y divide-gray-100">
            {checkedIn.map((entry, i) => (
              <li key={`${entry.name}-${i}`} className="flex items-center gap-3 py-2">
                {entry.headshot ? (
                  <img
                    src={entry.headshot}
                    alt=""
                    className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" />
                )}
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {entry.name}
                </span>
                <span className="text-xs text-muted-foreground">{entry.at}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
