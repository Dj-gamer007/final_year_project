import { useState, useCallback, useRef } from "react";
import { EmotionData, AttentionData } from "./useFaceDetection";

export interface EngagementSnapshot {
  timestamp: number;
  timeLabel: string;
  emotion: string;
  emotionConfidence: number;
  attentionScore: number;
  isAttentive: boolean;
}

interface UseEngagementHistoryProps {
  maxDataPoints?: number;
  sampleIntervalMs?: number;
}

export const useEngagementHistory = ({
  maxDataPoints = 60,
  sampleIntervalMs = 5000,
}: UseEngagementHistoryProps = {}) => {
  const [history, setHistory] = useState<EngagementSnapshot[]>([]);
  const lastSampleTimeRef = useRef<number>(0);
  const meetingStartTimeRef = useRef<number>(Date.now());

  const recordSnapshot = useCallback(
    (emotion: EmotionData | null, attention: AttentionData | null) => {
      const now = Date.now();
      
      // Only sample at specified intervals
      if (now - lastSampleTimeRef.current < sampleIntervalMs) {
        return;
      }
      
      lastSampleTimeRef.current = now;

      // Calculate time since meeting started
      const elapsedMs = now - meetingStartTimeRef.current;
      const minutes = Math.floor(elapsedMs / 60000);
      const seconds = Math.floor((elapsedMs % 60000) / 1000);
      const timeLabel = `${minutes}:${seconds.toString().padStart(2, "0")}`;

      const snapshot: EngagementSnapshot = {
        timestamp: now,
        timeLabel,
        emotion: emotion?.emotion.split(" ")[0] || "Unknown",
        emotionConfidence: emotion?.confidence || 0,
        attentionScore: attention?.attentionScore || 0,
        isAttentive: attention?.isLookingAtScreen || false,
      };

      setHistory((prev) => {
        const updated = [...prev, snapshot];
        // Keep only the last maxDataPoints
        if (updated.length > maxDataPoints) {
          return updated.slice(-maxDataPoints);
        }
        return updated;
      });
    },
    [maxDataPoints, sampleIntervalMs]
  );

  const resetHistory = useCallback(() => {
    setHistory([]);
    meetingStartTimeRef.current = Date.now();
    lastSampleTimeRef.current = 0;
  }, []);

  const getAverageAttention = useCallback(() => {
    if (history.length === 0) return 0;
    const sum = history.reduce((acc, s) => acc + s.attentionScore, 0);
    return Math.round(sum / history.length);
  }, [history]);

  const getEmotionDistribution = useCallback(() => {
    if (history.length === 0) return {};
    const distribution: Record<string, number> = {};
    history.forEach((s) => {
      distribution[s.emotion] = (distribution[s.emotion] || 0) + 1;
    });
    // Convert to percentages
    Object.keys(distribution).forEach((key) => {
      distribution[key] = Math.round((distribution[key] / history.length) * 100);
    });
    return distribution;
  }, [history]);

  const getDominantEmotion = useCallback(() => {
    const distribution = getEmotionDistribution();
    let maxEmotion = "Unknown";
    let maxCount = 0;
    Object.entries(distribution).forEach(([emotion, count]) => {
      if (count > maxCount) {
        maxCount = count;
        maxEmotion = emotion;
      }
    });
    return maxEmotion;
  }, [getEmotionDistribution]);

  return {
    history,
    recordSnapshot,
    resetHistory,
    getAverageAttention,
    getEmotionDistribution,
    getDominantEmotion,
  };
};
