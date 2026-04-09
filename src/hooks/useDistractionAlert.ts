import { useEffect, useRef, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { AttentionData } from "@/hooks/useFaceDetection";

interface UseDistractionAlertProps {
  attention: AttentionData | null;
  threshold?: number; // Attention score below this triggers alert
  durationMs?: number; // Duration in ms before alert fires
  isEnabled?: boolean;
}

export const useDistractionAlert = ({
  attention,
  threshold = 60,
  durationMs = 30000, // 30 seconds
  isEnabled = true,
}: UseDistractionAlertProps) => {
  const distractedStartRef = useRef<number | null>(null);
  const alertShownRef = useRef<boolean>(false);
  const lastAlertTimeRef = useRef<number>(0);

  const resetAlert = useCallback(() => {
    distractedStartRef.current = null;
    alertShownRef.current = false;
  }, []);

  useEffect(() => {
    if (!isEnabled || !attention) {
      resetAlert();
      return;
    }

    const isDistracted = attention.attentionScore < threshold;
    const now = Date.now();

    if (isDistracted) {
      // Start tracking distraction time if not already
      if (distractedStartRef.current === null) {
        distractedStartRef.current = now;
      }

      // Check if distracted for longer than threshold duration
      const distractedDuration = now - distractedStartRef.current;
      
      if (distractedDuration >= durationMs && !alertShownRef.current) {
        // Prevent spam - don't show more than once per minute
        if (now - lastAlertTimeRef.current > 60000) {
          toast({
            title: "⚠️ Attention Alert",
            description: `You've been distracted for ${Math.round(durationMs / 1000)} seconds. Try to refocus on the meeting.`,
            variant: "destructive",
            duration: 5000,
          });
          alertShownRef.current = true;
          lastAlertTimeRef.current = now;
        }
      }
    } else {
      // User is attentive again, reset tracking
      resetAlert();
    }
  }, [attention, threshold, durationMs, isEnabled, resetAlert]);

  return {
    isDistracted: attention ? attention.attentionScore < threshold : false,
    distractedSince: distractedStartRef.current,
    resetAlert,
  };
};
