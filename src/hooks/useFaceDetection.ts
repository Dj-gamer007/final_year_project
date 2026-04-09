import { useEffect, useRef, useState, useCallback } from "react";
import * as faceapi from "face-api.js";

export interface EmotionData {
  emotion: string;
  confidence: number;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface AttentionData {
  isLookingAtScreen: boolean;
  attentionScore: number;
  headPose: {
    yaw: number; // left/right rotation
    pitch: number; // up/down rotation
    roll: number; // tilt
  };
  eyeContact: boolean;
}

export interface FaceAnalysisData {
  emotion: EmotionData | null;
  attention: AttentionData | null;
}

interface UseFaceDetectionProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isVideoOn: boolean;
  isEnabled?: boolean;
}

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";

let modelsLoaded = false;
let modelsLoading: Promise<void> | null = null;

const loadModels = async (): Promise<void> => {
  if (modelsLoaded) return;
  if (modelsLoading) return modelsLoading;

  modelsLoading = (async () => {
    try {
      console.log("Loading face-api.js models...");
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      ]);
      modelsLoaded = true;
      console.log("Face-api.js models loaded successfully");
    } catch (error) {
      console.error("Error loading face-api.js models:", error);
      modelsLoading = null;
      throw error;
    }
  })();

  return modelsLoading;
};

// Calculate head pose from facial landmarks
const calculateHeadPose = (landmarks: faceapi.FaceLandmarks68): { yaw: number; pitch: number; roll: number } => {
  const positions = landmarks.positions;
  
  // Get key facial points
  const nose = positions[30]; // Nose tip
  const leftEye = positions[36]; // Left eye outer corner
  const rightEye = positions[45]; // Right eye outer corner
  const leftMouth = positions[48]; // Left mouth corner
  const rightMouth = positions[54]; // Right mouth corner
  const chin = positions[8]; // Chin
  
  // Calculate yaw (left/right head rotation) based on nose position relative to eyes
  const eyeCenter = {
    x: (leftEye.x + rightEye.x) / 2,
    y: (leftEye.y + rightEye.y) / 2,
  };
  const eyeDistance = Math.abs(rightEye.x - leftEye.x);
  const noseOffset = nose.x - eyeCenter.x;
  const yaw = (noseOffset / eyeDistance) * 45; // Scale to degrees
  
  // Calculate pitch (up/down head rotation) based on nose-eye vs nose-chin distances
  const noseToEye = eyeCenter.y - nose.y;
  const noseToChin = chin.y - nose.y;
  const verticalRatio = noseToEye / (noseToChin || 1);
  const pitch = (verticalRatio - 0.5) * 30; // Scale to degrees
  
  // Calculate roll (head tilt) based on eye line angle
  const eyeAngle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
  const roll = eyeAngle * (180 / Math.PI);
  
  return { yaw, pitch, roll };
};

// Calculate eye gaze direction
const calculateEyeContact = (landmarks: faceapi.FaceLandmarks68): boolean => {
  const positions = landmarks.positions;
  
  // Left eye points (36-41)
  const leftEyeOuter = positions[36];
  const leftEyeInner = positions[39];
  const leftEyeTop = positions[37];
  const leftEyeBottom = positions[41];
  
  // Right eye points (42-47)
  const rightEyeOuter = positions[45];
  const rightEyeInner = positions[42];
  const rightEyeTop = positions[43];
  const rightEyeBottom = positions[47];
  
  // Calculate eye aspect ratio (EAR) to detect if eyes are open
  const leftEAR = Math.abs(leftEyeTop.y - leftEyeBottom.y) / Math.abs(leftEyeOuter.x - leftEyeInner.x);
  const rightEAR = Math.abs(rightEyeTop.y - rightEyeBottom.y) / Math.abs(rightEyeOuter.x - rightEyeInner.x);
  
  // Eyes are considered open if EAR > threshold
  const avgEAR = (leftEAR + rightEAR) / 2;
  const eyesOpen = avgEAR > 0.2;
  
  // For simplicity, if eyes are open and face is detected, assume eye contact
  // In a more advanced implementation, you'd track iris position
  return eyesOpen;
};

// Calculate attention score based on head pose and eye contact
const calculateAttentionScore = (headPose: { yaw: number; pitch: number; roll: number }, eyeContact: boolean): number => {
  // Ideal values: yaw=0, pitch=0, roll=0 (looking straight at camera)
  const yawPenalty = Math.min(Math.abs(headPose.yaw) / 30, 1) * 40; // Max 40% penalty
  const pitchPenalty = Math.min(Math.abs(headPose.pitch) / 25, 1) * 30; // Max 30% penalty
  const rollPenalty = Math.min(Math.abs(headPose.roll) / 20, 1) * 15; // Max 15% penalty
  const eyeContactBonus = eyeContact ? 0 : 15; // 15% penalty if eyes closed
  
  const score = Math.max(0, 100 - yawPenalty - pitchPenalty - rollPenalty - eyeContactBonus);
  return Math.round(score);
};

export const useFaceDetection = ({
  videoRef,
  canvasRef,
  isVideoOn,
  isEnabled = true,
}: UseFaceDetectionProps) => {
  const [isModelLoaded, setIsModelLoaded] = useState(modelsLoaded);
  const [currentEmotion, setCurrentEmotion] = useState<EmotionData | null>(null);
  const [currentAttention, setCurrentAttention] = useState<AttentionData | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const animationFrameRef = useRef<number | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load models on mount
  useEffect(() => {
    if (!isEnabled) return;

    loadModels()
      .then(() => setIsModelLoaded(true))
      .catch(console.error);
  }, [isEnabled]);

  const getEmotionLabel = (expressions: faceapi.FaceExpressions): { emotion: string; confidence: number } => {
    const emotionMap: Record<string, string> = {
      happy: "Happy 😊",
      sad: "Sad 😢",
      angry: "Angry 😠",
      fearful: "Fearful 😨",
      disgusted: "Disgusted 🤢",
      surprised: "Surprised 😮",
      neutral: "Neutral 😐",
    };

    const entries = Object.entries(expressions) as [string, number][];
    const [maxEmotion, maxConfidence] = entries.reduce(
      (max, curr) => (curr[1] > max[1] ? curr : max),
      ["neutral", 0]
    );

    return {
      emotion: emotionMap[maxEmotion] || "Unknown",
      confidence: Math.round(maxConfidence * 100),
    };
  };

  const drawDetection = useCallback(
    (
      detection: faceapi.WithFaceExpressions<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }, faceapi.FaceLandmarks68>>
    ) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Match canvas size to video display size
      const displaySize = {
        width: video.videoWidth,
        height: video.videoHeight,
      };

      canvas.width = displaySize.width;
      canvas.height = displaySize.height;

      // Clear previous drawings
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const { detection: faceDetection, expressions, landmarks } = detection;
      const box = faceDetection.box;

      // Calculate head pose and attention
      const headPose = calculateHeadPose(landmarks);
      const eyeContact = calculateEyeContact(landmarks);
      const attentionScore = calculateAttentionScore(headPose, eyeContact);
      const isLookingAtScreen = attentionScore >= 60;

      // Use original box position (canvas CSS handles mirroring)
      const boxX = box.x;

      // Draw bounding box - green if attentive, yellow if distracted
      const boxColor = isLookingAtScreen ? "#22c55e" : "#eab308";
      ctx.strokeStyle = boxColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(boxX, box.y, box.width, box.height);

      // Draw corner accents
      const cornerLength = 15;
      ctx.lineWidth = 4;

      // Top-left corner
      ctx.beginPath();
      ctx.moveTo(boxX, box.y + cornerLength);
      ctx.lineTo(boxX, box.y);
      ctx.lineTo(boxX + cornerLength, box.y);
      ctx.stroke();

      // Top-right corner
      ctx.beginPath();
      ctx.moveTo(boxX + box.width - cornerLength, box.y);
      ctx.lineTo(boxX + box.width, box.y);
      ctx.lineTo(boxX + box.width, box.y + cornerLength);
      ctx.stroke();

      // Bottom-left corner
      ctx.beginPath();
      ctx.moveTo(boxX, box.y + box.height - cornerLength);
      ctx.lineTo(boxX, box.y + box.height);
      ctx.lineTo(boxX + cornerLength, box.y + box.height);
      ctx.stroke();

      // Bottom-right corner
      ctx.beginPath();
      ctx.moveTo(boxX + box.width - cornerLength, box.y + box.height);
      ctx.lineTo(boxX + box.width, box.y + box.height);
      ctx.lineTo(boxX + box.width, box.y + box.height - cornerLength);
      ctx.stroke();

      // Get emotion data
      const emotionData = getEmotionLabel(expressions);

      // For text labels, we need to flip the context so text appears readable
      // when the canvas is CSS-mirrored
      ctx.save();
      
      // Flip horizontally for text so it reads correctly when canvas is mirrored
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      
      // Calculate mirrored position for text drawing
      const textCenterX = canvas.width - boxX - box.width / 2;

      // Draw emotion label
      const labelText = `${emotionData.emotion} (${emotionData.confidence}%)`;
      ctx.font = "bold 14px Inter, sans-serif";
      const textMetrics = ctx.measureText(labelText);
      const labelPadding = 8;
      const labelHeight = 24;
      const labelWidth = textMetrics.width + labelPadding * 2;
      const labelX = textCenterX - labelWidth / 2;
      const labelY = box.y - labelHeight - 5;

      // Emotion label background
      ctx.fillStyle = "rgba(34, 197, 94, 0.9)";
      ctx.beginPath();
      ctx.roundRect(labelX, labelY, labelWidth, labelHeight, 4);
      ctx.fill();

      // Emotion label text
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(labelText, textCenterX, labelY + labelHeight / 2);

      // Draw attention indicator at bottom of box
      const attentionLabel = isLookingAtScreen ? `Attentive (${attentionScore}%)` : `Distracted (${attentionScore}%)`;
      const attentionMetrics = ctx.measureText(attentionLabel);
      const attentionWidth = attentionMetrics.width + labelPadding * 2;
      const attentionX = textCenterX - attentionWidth / 2;
      const attentionY = box.y + box.height + 5;

      // Attention label background
      ctx.fillStyle = isLookingAtScreen ? "rgba(34, 197, 94, 0.9)" : "rgba(234, 179, 8, 0.9)";
      ctx.beginPath();
      ctx.roundRect(attentionX, attentionY, attentionWidth, labelHeight, 4);
      ctx.fill();

      // Attention label text
      ctx.fillStyle = isLookingAtScreen ? "#ffffff" : "#000000";
      ctx.fillText(attentionLabel, textCenterX, attentionY + labelHeight / 2);
      
      ctx.restore();

      // Update emotion state
      setCurrentEmotion({
        emotion: emotionData.emotion,
        confidence: emotionData.confidence,
        box: {
          x: boxX,
          y: box.y,
          width: box.width,
          height: box.height,
        },
      });

      // Update attention state
      setCurrentAttention({
        isLookingAtScreen,
        attentionScore,
        headPose,
        eyeContact,
      });
    },
    [canvasRef, videoRef]
  );

  const detectFace = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !isModelLoaded || !isVideoOn || video.paused || video.ended) {
      const ctx = canvas?.getContext("2d");
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      setCurrentEmotion(null);
      setCurrentAttention(null);
      return;
    }

    try {
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceExpressions();

      if (detection) {
        drawDetection(detection);
      } else {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        setCurrentEmotion(null);
        setCurrentAttention(null);
      }
    } catch (error) {
      console.error("Face detection error:", error);
    }
  }, [videoRef, canvasRef, isModelLoaded, isVideoOn, drawDetection]);

  // Run detection loop
  useEffect(() => {
    if (!isEnabled || !isVideoOn || !isModelLoaded) {
      setIsDetecting(false);
      return;
    }

    setIsDetecting(true);

    // Run detection every 200ms for smooth real-time feedback
    detectionIntervalRef.current = setInterval(() => {
      detectFace();
    }, 200);

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      setIsDetecting(false);
    };
  }, [isEnabled, isVideoOn, isModelLoaded, detectFace]);

  // Clear canvas when video is off
  useEffect(() => {
    if (!isVideoOn) {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      setCurrentEmotion(null);
      setCurrentAttention(null);
    }
  }, [isVideoOn, canvasRef]);

  return {
    isModelLoaded,
    isDetecting,
    currentEmotion,
    currentAttention,
  };
};
