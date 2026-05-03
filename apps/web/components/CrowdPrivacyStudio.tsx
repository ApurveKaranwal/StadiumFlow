"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

type PrivacyBox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  source: "auto" | "manual";
};

type FaceDetectorLike = {
  detect: (input: CanvasImageSource) => Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
};

type OpenCvLike = {
  Mat?: new () => {
    roi: (rect: { x: number; y: number; width: number; height: number }) => unknown;
    delete: () => void;
  };
  RectVector?: new () => {
    size: () => number;
    get: (index: number) => { x: number; y: number; width: number; height: number };
    delete: () => void;
  };
  CascadeClassifier?: new () => {
    load: (path: string) => boolean;
    detectMultiScale: (
      image: unknown,
      objects: unknown,
      scaleFactor?: number,
      minNeighbors?: number,
      flags?: number,
      minSize?: { width: number; height: number },
      maxSize?: { width: number; height: number }
    ) => void;
    delete: () => void;
  };
  Rect?: new (x: number, y: number, width: number, height: number) => { x: number; y: number; width: number; height: number };
  Size?: new (width: number, height: number) => { width: number; height: number };
  imread?: (element: HTMLCanvasElement) => { roi: (rect: unknown) => { delete: () => void }; delete: () => void };
  cvtColor?: (src: unknown, dst: unknown, code: number, dstCn?: number) => void;
  imshow?: (element: HTMLCanvasElement, mat: unknown) => void;
  GaussianBlur?: (
    src: unknown,
    dst: unknown,
    ksize: { width: number; height: number },
    sigmaX: number,
    sigmaY: number,
    borderType?: number
  ) => void;
  BORDER_DEFAULT?: number;
  COLOR_RGBA2GRAY?: number;
  FS_createDataFile?: (
    parent: string,
    name: string,
    data: Uint8Array,
    canRead: boolean,
    canWrite: boolean,
    canOwn?: boolean
  ) => void;
  onRuntimeInitialized?: () => void;
};

declare global {
  interface Window {
    cv?: OpenCvLike;
    FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => FaceDetectorLike;
  }
}

const OPENCV_SCRIPT_ID = "opencv-runtime-script";
const OPENCV_CASCADE_PATH = "/haarcascade_frontalface_default.xml";
const OPENCV_CASCADE_URL = "https://raw.githubusercontent.com/opencv/opencv/4.x/data/haarcascades/haarcascade_frontalface_default.xml";

function boxId() {
  return `privacy-${Math.random().toString(36).slice(2, 10)}`;
}

function clampBox(box: PrivacyBox, width: number, height: number): PrivacyBox {
  const x = Math.max(0, Math.min(box.x, width));
  const y = Math.max(0, Math.min(box.y, height));
  const boundedWidth = Math.max(12, Math.min(box.width, width - x));
  const boundedHeight = Math.max(12, Math.min(box.height, height - y));

  return {
    ...box,
    x,
    y,
    width: boundedWidth,
    height: boundedHeight
  };
}

function getOpenCvContainer() {
  if (!window.cv) {
    window.cv = {};
  }
  return window.cv;
}

async function detectFaces(image: HTMLImageElement | HTMLVideoElement): Promise<PrivacyBox[]> {
  if (!window.FaceDetector) {
    return [];
  }

  const detector = new window.FaceDetector({
    fastMode: true,
    maxDetectedFaces: 24
  });

  const faces = await detector.detect(image);
  return faces.map((face) => ({
    id: boxId(),
    x: face.boundingBox.x,
    y: face.boundingBox.y,
    width: face.boundingBox.width,
    height: face.boundingBox.height,
    source: "auto"
  }));
}

function detectFacesWithOpenCv(
  cv: OpenCvLike,
  classifier: NonNullable<OpenCvLike["CascadeClassifier"]> extends new () => infer T ? T : never,
  source: HTMLImageElement | HTMLVideoElement
): PrivacyBox[] {
  if (!cv.imread || !cv.Mat || !cv.RectVector || !cv.Size || !cv.cvtColor || typeof cv.COLOR_RGBA2GRAY !== "number") {
    return [];
  }

  const width = "videoWidth" in source ? source.videoWidth : source.naturalWidth;
  const height = "videoHeight" in source ? source.videoHeight : source.naturalHeight;
  if (!width || !height) {
    return [];
  }

  const detectionCanvas = document.createElement("canvas");
  detectionCanvas.width = width;
  detectionCanvas.height = height;
  const detectionContext = detectionCanvas.getContext("2d");
  if (!detectionContext) {
    return [];
  }

  detectionContext.drawImage(source, 0, 0, width, height);

  const src = cv.imread(detectionCanvas);
  const gray = new cv.Mat();
  const faces = new cv.RectVector();

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
    classifier.detectMultiScale(gray, faces, 1.12, 4, 0, new cv.Size(28, 28));

    const boxes: PrivacyBox[] = [];
    for (let index = 0; index < faces.size(); index += 1) {
      const face = faces.get(index);
      boxes.push({
        id: boxId(),
        x: face.x,
        y: face.y,
        width: face.width,
        height: face.height,
        source: "auto"
      });
    }
    return boxes;
  } finally {
    faces.delete();
    gray.delete();
    src.delete();
  }
}

function applyCanvasBlur(canvas: HTMLCanvasElement, source: CanvasImageSource, boxes: PrivacyBox[], blurStrength: number) {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);

  boxes.forEach((box) => {
    const padding = 22;
    const sx = Math.max(0, Math.floor(box.x - padding));
    const sy = Math.max(0, Math.floor(box.y - padding));
    const sw = Math.min(canvas.width - sx, Math.floor(box.width + padding * 2));
    const sh = Math.min(canvas.height - sy, Math.floor(box.height + padding * 2));
    if (sw <= 0 || sh <= 0) {
      return;
    }

    const offscreen = document.createElement("canvas");
    offscreen.width = sw;
    offscreen.height = sh;
    const offscreenContext = offscreen.getContext("2d");
    if (!offscreenContext) {
      return;
    }

    offscreenContext.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);

    const sampleWidth = Math.max(8, Math.round(sw / Math.max(6, blurStrength / 2)));
    const sampleHeight = Math.max(8, Math.round(sh / Math.max(6, blurStrength / 2)));
    const mosaic = document.createElement("canvas");
    mosaic.width = sampleWidth;
    mosaic.height = sampleHeight;
    const mosaicContext = mosaic.getContext("2d");
    if (!mosaicContext) {
      return;
    }

    mosaicContext.imageSmoothingEnabled = true;
    mosaicContext.drawImage(offscreen, 0, 0, sampleWidth, sampleHeight);

    context.save();
    context.imageSmoothingEnabled = false;
    context.filter = `blur(${Math.max(4, Math.round(blurStrength / 4))}px)`;
    context.drawImage(mosaic, 0, 0, sampleWidth, sampleHeight, sx, sy, sw, sh);
    context.restore();
  });
}

function applyOpenCvBlur(canvas: HTMLCanvasElement, boxes: PrivacyBox[], blurStrength: number) {
  const cv = window.cv;
  if (!cv?.imread || !cv.Rect || !cv.Size || !cv.GaussianBlur || typeof cv.BORDER_DEFAULT !== "number" || !cv.imshow) {
    return false;
  }

  const CvRect = cv.Rect;
  const CvSize = cv.Size;
  const gaussianBlur = cv.GaussianBlur;
  const src = cv.imread(canvas);
  const kernelBase = Math.max(9, Math.round(blurStrength));
  const kernel = kernelBase % 2 === 0 ? kernelBase + 1 : kernelBase;

  try {
    boxes.forEach((box) => {
      const rect = new CvRect(box.x, box.y, box.width, box.height);
      const region = (src as { roi: (rect: unknown) => { delete: () => void } }).roi(rect);
      gaussianBlur(region, region, new CvSize(kernel, kernel), 0, 0, cv.BORDER_DEFAULT);
      region.delete();
    });
    cv.imshow(canvas, src);
    return true;
  } finally {
    (src as { delete: () => void }).delete();
  }
}

export function CrowdPrivacyStudio() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const manualStartRef = useRef<{ x: number; y: number } | null>(null);
  const detectionFrameRef = useRef(0);
  const cascadeClassifierRef = useRef<{
    load: (path: string) => boolean;
    detectMultiScale: (
      image: unknown,
      objects: unknown,
      scaleFactor?: number,
      minNeighbors?: number,
      flags?: number,
      minSize?: { width: number; height: number },
      maxSize?: { width: number; height: number }
    ) => void;
    delete: () => void;
  } | null>(null);
  const cascadeLoadingRef = useRef<Promise<void> | null>(null);

  const [imageUrl, setImageUrl] = useState("");
  const [privacyBoxes, setPrivacyBoxes] = useState<PrivacyBox[]>([]);
  const [blurStrength, setBlurStrength] = useState(28);
  const [opencvReady, setOpencvReady] = useState(false);
  const [cameraMode, setCameraMode] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Load a crowd photo or open the live camera feed.");
  const [frameSize, setFrameSize] = useState({ width: 1280, height: 720 });
  const [cascadeReady, setCascadeReady] = useState(false);
  const privacyBoxesRef = useRef<PrivacyBox[]>([]);

  const detectorSupported = typeof window !== "undefined" && Boolean(window.FaceDetector);

  useEffect(() => {
    privacyBoxesRef.current = privacyBoxes;
  }, [privacyBoxes]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.cv?.Mat) {
      setOpencvReady(true);
      return;
    }

    const existingScript = document.getElementById(OPENCV_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      const markReady = () => setOpencvReady(Boolean(window.cv?.Mat));
      getOpenCvContainer().onRuntimeInitialized = markReady;
      return;
    }

    const script = document.createElement("script");
    script.id = OPENCV_SCRIPT_ID;
    script.async = true;
    script.src = "https://docs.opencv.org/4.x/opencv.js";
    script.onload = () => {
      if (window.cv?.Mat) {
        setOpencvReady(true);
        return;
      }
      getOpenCvContainer().onRuntimeInitialized = () => setOpencvReady(true);
    };
    script.onerror = () => setStatus("OpenCV.js failed to load. Manual privacy masking is still available.");
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      cascadeClassifierRef.current?.delete();
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  useEffect(() => {
    if (!opencvReady || cascadeClassifierRef.current || cascadeLoadingRef.current || typeof window === "undefined") {
      return;
    }

    const cv = window.cv;
    if (!cv?.CascadeClassifier || !cv.FS_createDataFile) {
      return;
    }

    const createDataFile = cv.FS_createDataFile;
    const CascadeClassifier = cv.CascadeClassifier;

    cascadeLoadingRef.current = (async () => {
      try {
        const response = await fetch(OPENCV_CASCADE_URL);
        if (!response.ok) {
          throw new Error("Cascade download failed.");
        }

        const bytes = new Uint8Array(await response.arrayBuffer());
        try {
          createDataFile("/", OPENCV_CASCADE_PATH.slice(1), bytes, true, false, false);
        } catch {
          // The cascade file may already exist in the virtual FS after a hot reload.
        }

        const classifier = new CascadeClassifier();
        const loaded = classifier.load(OPENCV_CASCADE_PATH);
        if (!loaded) {
          classifier.delete();
          throw new Error("Cascade classifier load failed.");
        }

        cascadeClassifierRef.current = classifier;
        setCascadeReady(true);
      } catch {
        setStatus("OpenCV loaded, but face cascade failed. Use manual masking if live auto-detection misses faces.");
      } finally {
        cascadeLoadingRef.current = null;
      }
    })();
  }, [opencvReady]);

  const detectAutoFaces = async (source: HTMLImageElement | HTMLVideoElement) => {
    const browserDetections = await detectFaces(source).catch(() => []);
    if (browserDetections.length > 0) {
      return browserDetections;
    }

    const cv = window.cv;
    const classifier = cascadeClassifierRef.current;
    if (cv && classifier) {
      return detectFacesWithOpenCv(cv, classifier as never, source);
    }

    return [];
  };

  const renderProtectedFrame = async (source: HTMLImageElement | HTMLVideoElement, nextBoxes?: PrivacyBox[]) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const width = "videoWidth" in source ? source.videoWidth : source.naturalWidth;
    const height = "videoHeight" in source ? source.videoHeight : source.naturalHeight;
    if (!width || !height) {
      return;
    }

    canvas.width = width;
    canvas.height = height;
    setFrameSize({ width, height });

    const regions = (nextBoxes ?? privacyBoxesRef.current).map((box) => clampBox(box, width, height));
    applyCanvasBlur(canvas, source, regions, blurStrength);

    if (regions.length > 0 && opencvReady) {
      applyOpenCvBlur(canvas, regions, blurStrength);
    }
  };

  const runPhotoDetection = async () => {
    const image = imageRef.current;
    if (!image) {
      return;
    }

    setBusy(true);
    try {
      const autoDetections = await detectAutoFaces(image);
      const manualDetections = privacyBoxesRef.current.filter((box) => box.source === "manual");
      const nextBoxes = [...autoDetections, ...manualDetections];
      setPrivacyBoxes(nextBoxes);
      await renderProtectedFrame(image, nextBoxes);
      setStatus(
        autoDetections.length > 0
          ? `${autoDetections.length} faces protected before upload. Add manual boxes for misses.`
          : detectorSupported || cascadeReady
            ? "No faces detected automatically. Switch on manual mode to cover missed regions."
            : "Automatic face detection is not available in this browser. Use manual privacy boxes."
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const activeSource = imageRef.current;
    if (imageUrl && activeSource && privacyBoxesRef.current.length > 0) {
      void renderProtectedFrame(activeSource, privacyBoxesRef.current);
    }
  }, [blurStrength, imageUrl, opencvReady]);

  useEffect(() => {
    if (!cameraMode) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      return;
    }

    let cancelled = false;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment"
          },
          audio: false
        });

        if (cancelled || !videoRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus("Live privacy shield active. Review the blurred frame before sharing.");

        const tick = async () => {
          if (cancelled || !videoRef.current) {
            return;
          }

          const video = videoRef.current;
          detectionFrameRef.current += 1;
          let nextBoxes = privacyBoxesRef.current;

          if (detectionFrameRef.current % 10 === 0) {
            const autoDetections = await detectAutoFaces(video);
            const manualDetections = privacyBoxesRef.current.filter((box) => box.source === "manual");
            nextBoxes = [...autoDetections, ...manualDetections];
            setPrivacyBoxes(nextBoxes);
            if (autoDetections.length > 0) {
              setStatus(`${autoDetections.length} faces masked live. Review before sharing.`);
            } else if (cascadeReady || detectorSupported) {
              setStatus("Live camera active. Add manual masks if any face is missed.");
            }
          }

          await renderProtectedFrame(video, nextBoxes);
          animationRef.current = requestAnimationFrame(() => {
            void tick();
          });
        };

        await tick();
      } catch {
        setCameraMode(false);
        setStatus("Camera access was blocked. Upload a photo instead or allow camera permission.");
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [cameraMode, blurStrength, cascadeReady, detectorSupported, opencvReady]);

  const handleImageSelection = async (file: File | null) => {
    if (!file) {
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    setCameraMode(false);
    setPrivacyBoxes([]);
    setImageUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return nextUrl;
    });
    setStatus("Preparing privacy mask...");
  };

  const pointerPosition = (event: ReactPointerEvent<HTMLDivElement>) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) {
      return null;
    }

    const bounds = wrapper.getBoundingClientRect();
    const scaleX = frameSize.width / bounds.width;
    const scaleY = frameSize.height / bounds.height;

    return {
      x: (event.clientX - bounds.left) * scaleX,
      y: (event.clientY - bounds.top) * scaleY
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!manualMode) {
      return;
    }

    const point = pointerPosition(event);
    if (!point) {
      return;
    }

    manualStartRef.current = point;
  };

  const handlePointerUp = async (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!manualMode || !manualStartRef.current) {
      return;
    }

    const end = pointerPosition(event);
    const start = manualStartRef.current;
    manualStartRef.current = null;

    if (!end) {
      return;
    }

    const nextBox = clampBox(
      {
        id: boxId(),
        x: Math.min(start.x, end.x),
        y: Math.min(start.y, end.y),
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y),
        source: "manual"
      },
      frameSize.width,
      frameSize.height
    );

    if (nextBox.width < 16 || nextBox.height < 16) {
      return;
    }

    const nextBoxes = [...privacyBoxesRef.current, nextBox];
    setPrivacyBoxes(nextBoxes);
    const activeSource = cameraMode ? videoRef.current : imageRef.current;
    if (activeSource) {
      await renderProtectedFrame(activeSource, nextBoxes);
    }
    setStatus("Manual privacy zone added.");
  };

  const clearBoxes = async () => {
    setPrivacyBoxes([]);
    const activeSource = cameraMode ? videoRef.current : imageRef.current;
    if (activeSource) {
      await renderProtectedFrame(activeSource, []);
    }
    setStatus("Privacy zones cleared.");
  };

  const downloadProtectedImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const link = document.createElement("a");
    link.download = `protected-crowd-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <section className="panel privacy-panel">
      <div className="section-head tight">
        <div>
          <p className="eyebrow">Privacy Shield</p>
          <h2 className="section-title">On-device crowd photo filter</h2>
        </div>
        <span className={opencvReady ? "pill" : "pill alert"}>{opencvReady ? "OpenCV ready" : "Loading OpenCV"}</span>
      </div>

      <p className="section-copy">
        Faces are blurred in the browser before export. Auto-detection uses the browser face detector first, then
        falls back to an OpenCV cascade for live camera masking when browser APIs are unavailable.
      </p>

      <div className="privacy-toolbar">
        <label className="button secondary file-button">
          <input
            accept="image/*"
            className="hidden-input"
            onChange={(event) => void handleImageSelection(event.target.files?.[0] ?? null)}
            type="file"
          />
          Upload crowd photo
        </label>
        <button className={cameraMode ? "button" : "button secondary"} onClick={() => setCameraMode((current) => !current)}>
          {cameraMode ? "Stop live camera" : "Open live camera"}
        </button>
        <button className={manualMode ? "button" : "button secondary"} onClick={() => setManualMode((current) => !current)}>
          {manualMode ? "Manual masking on" : "Add manual masks"}
        </button>
        <button className="button secondary" disabled={privacyBoxes.length === 0} onClick={() => void clearBoxes()}>
          Clear masks
        </button>
        <button className="button" disabled={!imageUrl && !cameraMode} onClick={downloadProtectedImage}>
          Export protected image
        </button>
      </div>

      <div className="privacy-stats">
        <div>
          <strong>{privacyBoxes.length}</strong>
          <span>Protected regions</span>
        </div>
        <div>
          <strong>{detectorSupported ? "Auto" : "Manual"}</strong>
          <span>Detection mode</span>
        </div>
        <div>
          <strong>{cameraMode ? "Live" : "Photo"}</strong>
          <span>{cascadeReady || detectorSupported ? "Auto masking ready" : "Manual fallback"}</span>
        </div>
      </div>

      <label className="field-group full">
        <span className="field-label">Blur strength</span>
        <input
          max={51}
          min={11}
          onChange={(event) => setBlurStrength(Number(event.target.value))}
          step={2}
          type="range"
          value={blurStrength}
        />
      </label>

      <div
        className={manualMode ? "privacy-stage drawing" : "privacy-stage"}
        onPointerDown={handlePointerDown}
        onPointerUp={(event) => void handlePointerUp(event)}
        ref={wrapperRef}
      >
        <video className="hidden-media" ref={videoRef} playsInline muted />
        {imageUrl ? <img alt="Crowd frame source" className="hidden-media" onLoad={() => void runPhotoDetection()} ref={imageRef} src={imageUrl} /> : null}
        <canvas className="privacy-canvas" ref={canvasRef} />

        {privacyBoxes.map((box) => (
          <button
            className={box.source === "auto" ? "privacy-box auto" : "privacy-box manual"}
            key={box.id}
            onClick={() => {
              const nextBoxes = privacyBoxes.filter((item) => item.id !== box.id);
              setPrivacyBoxes(nextBoxes);
              const activeSource = cameraMode ? videoRef.current : imageRef.current;
              if (activeSource) {
                void renderProtectedFrame(activeSource, nextBoxes);
              }
            }}
            style={{
              left: `${(box.x / frameSize.width) * 100}%`,
              top: `${(box.y / frameSize.height) * 100}%`,
              width: `${(box.width / frameSize.width) * 100}%`,
              height: `${(box.height / frameSize.height) * 100}%`
            }}
            type="button"
          >
            <span>{box.source === "auto" ? "Face blur" : "Manual blur"}</span>
          </button>
        ))}

        {!imageUrl && !cameraMode ? (
          <div className="privacy-empty">
            <strong>No frame loaded</strong>
            <span>Upload a crowd photo or start the live camera feed.</span>
          </div>
        ) : null}
      </div>

      <p className="status-line compact-status">{busy ? "Processing frame..." : status}</p>
    </section>
  );
}
