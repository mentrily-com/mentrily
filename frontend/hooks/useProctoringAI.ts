import { useEffect, useRef, useState, useCallback } from 'react';
// OPTIMIZATION: Removed static import of @mediapipe/tasks-vision to reduce initial bundle size by ~1-2MB.
// Types are imported effectively, but the values are now loaded dynamically.
import type { ObjectDetector, FaceLandmarker } from '@mediapipe/tasks-vision';
import { useToast } from '@/app/components/Common/Toast';
import proctorWarnings from '@/app/proctor-warnings.json';

export interface ProctoringConfig {
    onViolation: (type: string, message: string, image?: string) => void;
    active: boolean; // Control to turn on/off monitoring
}

const getRandomWarning = (type: 'phone_detected' | 'multiple_faces' | 'no_face' | 'head_turned') => {
    const messages = proctorWarnings[type];
    if (!messages || messages.length === 0) return 'Security Violation Detected.';
    return messages[Math.floor(Math.random() * messages.length)];
};

export function useProctoringAI({ onViolation, active }: ProctoringConfig) {
    const { warning, error: toastError } = useToast();
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Stale closure fix
    const onViolationRef = useRef(onViolation);
    useEffect(() => {
        onViolationRef.current = onViolation;
    }, [onViolation]);

    // MediaPipe Vision Tasks
    const objectDetectorRef = useRef<ObjectDetector | null>(null);
    const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
    const runningMode = 'VIDEO';

    // Timing & State for Staggered Loop
    const lastFaceCheckRef = useRef<number>(0);
    const lastObjectCheckRef = useRef<number>(0);
    const requestRef = useRef<number | null>(null);

    // Violation State Tracking
    const headTurnStartTimeRef = useRef<number | null>(null);
    const isHeadTurnWarnedRef = useRef(false);
    const consecutiveMultiFaceCount = useRef<number>(0);
    const noFaceStartTimeRef = useRef<number | null>(null);
    const lastNoFaceWarningRef = useRef<number>(0);
    const lastPhoneDetectedRef = useRef<number>(0);

    // Initial Model Loading
    useEffect(() => {
        if (!active) return; // Don't load models if not active

        let isMounted = true;

        async function loadModels() {
            // Check global cache first
            if ((window as any).__PROCTOR_MODELS__) {
                const { objectDetector, faceLandmarker } = (window as any).__PROCTOR_MODELS__;
                if (objectDetector && faceLandmarker) {
                    objectDetectorRef.current = objectDetector;
                    faceLandmarkerRef.current = faceLandmarker;
                    setIsModelLoaded(true);
                    console.log('[ProctoringAI] Models Restored from Cache');
                    return;
                }
            }

            try {
                // Dynamic Import
                const { FilesetResolver, ObjectDetector, FaceLandmarker } = await import('@mediapipe/tasks-vision');

                const vision = await FilesetResolver.forVisionTasks(
                    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm',
                );

                if (!isMounted) return;

                // Load Object Detector (EfficientDet-Lite0 is good for mobile/web)
                const objectDetector = await ObjectDetector.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath:
                            'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/float32/1/efficientdet_lite2.tflite', // Upgraded to Lite2 for better accuracy
                        delegate: 'GPU',
                    },
                    scoreThreshold: 0.35, // Lowered significantly for higher sensitivity
                    runningMode: runningMode,
                });

                // Load Face Landmarker
                const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath:
                            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
                        delegate: 'GPU',
                    },
                    runningMode: runningMode,
                    numFaces: 5,
                    minFaceDetectionConfidence: 0.5,
                    minFacePresenceConfidence: 0.5,
                });

                if (isMounted) {
                    objectDetectorRef.current = objectDetector;
                    faceLandmarkerRef.current = faceLandmarker;

                    // Simple global cache
                    (window as any).__PROCTOR_MODELS__ = { objectDetector, faceLandmarker };

                    setIsModelLoaded(true);
                    console.log('[ProctoringAI] Models Loaded Successfully');
                }
            } catch (err) {
                console.error('[ProctoringAI] Failed to load models', err);
                toastError('Failed to initialize AI Proctoring component. Please refresh.');
            }
        }

        loadModels();

        return () => {
            isMounted = false;
            setIsModelLoaded(false);
            // Cleanup logic if needed (MediaPipe classes might have close methods)
            objectDetectorRef.current?.close();
            faceLandmarkerRef.current?.close();
        };
    }, [active]);

    // Camera Setup
    useEffect(() => {
        if (!active || !isModelLoaded || !videoRef.current) return;

        let stream: MediaStream | null = null;

        async function enableCam() {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: 640,
                        height: 480,
                        frameRate: 15, // Lower framerate for performance
                    },
                    audio: false,
                });

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.addEventListener('loadeddata', predictWebcam);
                }
            } catch (err) {
                console.error('Webcam Error', err);
                toastError('Camera access required for proctoring.');
            }
        }

        enableCam();

        return () => {
            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
            }
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
        };
    }, [active, isModelLoaded]);

    // Snapshot Helper
    const captureSnapshot = useCallback(() => {
        if (!videoRef.current) return undefined;
        const canvas = document.createElement('canvas'); // Create ephemeral canvas
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return undefined;
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/webp', 0.3); // WebP 30% quality (smaller payload)
    }, []);

    // The Main Loop
    const predictWebcam = async () => {
        if (!videoRef.current || !active) return;

        const now = performance.now();
        const video = videoRef.current; // Stable ref capture

        // Ensure video is playing and has size
        if (video.videoWidth > 0 && video.videoHeight > 0) {
            // --- 1. Face Landmarker (Every 500ms - Reduced from 200ms) ---
            if (now - lastFaceCheckRef.current >= 500) {
                lastFaceCheckRef.current = now;

                if (faceLandmarkerRef.current) {
                    const faceResult = faceLandmarkerRef.current.detectForVideo(video, now);

                    // Rule B: People Count
                    const faces = faceResult.faceLandmarks.length;

                    if (faces === 0) {
                        if (!noFaceStartTimeRef.current) {
                            noFaceStartTimeRef.current = now;
                        } else if (now - noFaceStartTimeRef.current > 5000) {
                            // 5s Persistence check

                            // Throttled Warning: Only notify every 10 seconds
                            if (now - lastNoFaceWarningRef.current > 10000) {
                                lastNoFaceWarningRef.current = now;

                                const msg = getRandomWarning('no_face');
                                warning(msg);
                                onViolationRef.current('NO_FACE', msg, captureSnapshot());
                            }
                        }
                    } else {
                        noFaceStartTimeRef.current = null;
                        // Optional: Reset throttler if face comes back?
                        // No, let it cool down naturally.
                    }

                    if (faces > 1) {
                        // Require persistence (e.g. 1 second ~ 5 frames at 200ms interval)
                        consecutiveMultiFaceCount.current += 1;

                        if (consecutiveMultiFaceCount.current > 5) {
                            // Reset to avoid spamming every frame after trigger? Or debounce?
                            // Let's debounce the TOAST/ACTION, but keep counting?
                            // Simple debounce:
                            const cooldown = 5000;
                            // We don't have a "lastMultiFace" ref, reusing throttle logic
                            if (now - (lastPhoneDetectedRef.current || 0) > cooldown) {
                                // Reusing a general violation timestamp or create new?
                                // Let's simplify and just use the callback's side-effect management
                                const msg = getRandomWarning('multiple_faces');
                                warning(msg);
                                onViolationRef.current('MULTIPLE_FACES', 'Multiple people detected', captureSnapshot());
                                consecutiveMultiFaceCount.current = 0; // Reset after trigger to allow re-trigger later
                            }
                        }
                    } else {
                        // Reset if 1 or 0 faces
                        consecutiveMultiFaceCount.current = 0;
                    }

                    // Rule C: Head Pose
                    if (faces === 1) {
                        // Calculate Yaw
                        // Landmarks: 1 (Nose Tip), 263 (Right Eye/Ear area), 33 (Left Eye/Ear area) - Approximation
                        // Better approximation for Yaw:
                        // Nose Tip (1) relative to mid-point of Ear/Cheek landmarks.
                        // Simple logic: Compare nose x to center of eyes.
                        // Or use specific landmarks:
                        // Nose: 4, Left Ear Tralion: 234, Right Ear Tralion: 454

                        const landmarks = faceResult.faceLandmarks[0];
                        const nose = landmarks[4];
                        const leftEar = landmarks[234];
                        const rightEar = landmarks[454];

                        // Simple Yaw Calculation based on nose position relative to ears
                        // If nose is too close to one ear
                        const distToLeft = Math.abs(nose.x - leftEar.x);
                        const distToRight = Math.abs(nose.x - rightEar.x);
                        const ratio = distToLeft / (distToLeft + distToRight);

                        // Ratio ~0.5 is center. < 0.2 or > 0.8 is sideways.
                        // 45 degrees fits roughly 0.2/0.8 logic or even stricter.

                        let isTurned = false;
                        if (ratio < 0.25 || ratio > 0.75) {
                            isTurned = true;
                        }

                        if (isTurned) {
                            if (!headTurnStartTimeRef.current) {
                                headTurnStartTimeRef.current = now;
                            } else {
                                const duration = now - headTurnStartTimeRef.current;
                                if (duration > 20000 && !isHeadTurnWarnedRef.current) {
                                    // > 20 seconds
                                    const msg = getRandomWarning('head_turned');
                                    warning(msg);
                                    isHeadTurnWarnedRef.current = true; // One warning per incident
                                    // Provide Yellow warning to system? User said "Only trigger YELLOW WARNING".
                                    onViolationRef.current('HEAD_TURN', msg);
                                }
                            }
                        } else {
                            // Reset
                            headTurnStartTimeRef.current = null;
                            isHeadTurnWarnedRef.current = false;
                        }
                    }
                }
            }

            // --- 2. Object Detector (Every 1000ms - Reduced from 500ms) ---
            if (now - lastObjectCheckRef.current >= 1000) {
                lastObjectCheckRef.current = now;

                if (objectDetectorRef.current) {
                    const detections = objectDetectorRef.current.detectForVideo(video, now);

                    // Debug Log - What does it see?
                    if (detections.detections.length > 0) {
                        // console.log("Objects:", detections.detections.map(d => d.categories[0].categoryName + " " + d.categories[0].score));
                    }

                    // Rule A: Phone Detection
                    const phone = detections.detections.find((d) =>
                        d.categories.find(
                            (c) =>
                                (c.categoryName === 'cell phone' || c.categoryName === 'mobile phone') &&
                                c.score > 0.35,
                        ),
                    );

                    if (phone) {
                        // Check global cool down of 2s to avoid finding same phone in subsequent frames immediately
                        if (now - lastPhoneDetectedRef.current > 5000) {
                            // Wait 2 seconds before creating the toast, to simulate "typing" / processing delay
                            lastPhoneDetectedRef.current = now; // Mark detected immediately to debounce

                            setTimeout(() => {
                                const msg = getRandomWarning('phone_detected');
                                warning(msg);
                                const snapshot = captureSnapshot();
                                onViolationRef.current('PHONE_DETECTED', 'Cell phone detected', snapshot);
                            }, 2000); // 2s Artificial Delay
                        }
                    }
                }
            }
        }

        // Loop
        requestRef.current = requestAnimationFrame(predictWebcam);
    };

    return {
        videoRef,
        canvasRef,
        isModelLoaded,
    };
}
