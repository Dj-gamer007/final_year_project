import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Transcript } from "@/hooks/useMeetingData";

interface TranslationCache {
  [key: string]: string; // key: `${transcriptId}-${targetLang}`, value: translated text
}

interface UseTranscriptTranslationProps {
  transcripts: Transcript[];
  targetLanguage: string;
}

interface UseTranscriptTranslationReturn {
  translatedTranscripts: Transcript[];
  isTranslating: boolean;
  translationProgress: number;
  error: string | null;
}

export function useTranscriptTranslation({
  transcripts,
  targetLanguage,
}: UseTranscriptTranslationProps): UseTranscriptTranslationReturn {
  const [translatedTranscripts, setTranslatedTranscripts] = useState<Transcript[]>(transcripts);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const cacheRef = useRef<TranslationCache>({});
  const abortControllerRef = useRef<AbortController | null>(null);

  const translateBatch = useCallback(
    async (texts: { id: string; text: string }[], targetLang: string) => {
      try {
        const { data, error } = await supabase.functions.invoke("translate-text", {
          body: {
            texts: texts.map((t) => t.text),
            targetLanguage: targetLang,
          },
        });

        if (error) throw error;
        return data.translations as string[];
      } catch (err) {
        console.error("Translation error:", err);
        throw err;
      }
    },
    []
  );

  useEffect(() => {
    // If no translation needed, return original
    if (targetLanguage === "none" || !targetLanguage) {
      setTranslatedTranscripts(transcripts);
      setIsTranslating(false);
      setTranslationProgress(0);
      return;
    }

    // Cancel any ongoing translation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const translateAll = async () => {
      setIsTranslating(true);
      setError(null);
      setTranslationProgress(0);

      try {
        // Check cache first and find what needs translation
        const needsTranslation: { id: string; text: string; index: number }[] = [];
        const resultMap = new Map<string, string>();

        transcripts.forEach((t, index) => {
          const cacheKey = `${t.id}-${targetLanguage}`;
          if (cacheRef.current[cacheKey]) {
            resultMap.set(t.id, cacheRef.current[cacheKey]);
          } else {
            needsTranslation.push({ id: t.id, text: t.text, index });
          }
        });

        if (needsTranslation.length === 0) {
          // All cached
          setTranslatedTranscripts(
            transcripts.map((t) => ({
              ...t,
              text: resultMap.get(t.id) || t.text,
            }))
          );
          setIsTranslating(false);
          setTranslationProgress(100);
          return;
        }

        // Batch translate in chunks of 10
        const batchSize = 10;
        let completed = transcripts.length - needsTranslation.length;

        for (let i = 0; i < needsTranslation.length; i += batchSize) {
          if (abortControllerRef.current?.signal.aborted) return;

          const batch = needsTranslation.slice(i, i + batchSize);
          const translations = await translateBatch(batch, targetLanguage);

          // Cache and store results
          batch.forEach((item, idx) => {
            const cacheKey = `${item.id}-${targetLanguage}`;
            cacheRef.current[cacheKey] = translations[idx];
            resultMap.set(item.id, translations[idx]);
          });

          completed += batch.length;
          setTranslationProgress(Math.round((completed / transcripts.length) * 100));
        }

        // Update state with all translations
        setTranslatedTranscripts(
          transcripts.map((t) => ({
            ...t,
            text: resultMap.get(t.id) || t.text,
          }))
        );
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Translation failed");
        setTranslatedTranscripts(transcripts); // Fallback to original
      } finally {
        setIsTranslating(false);
      }
    };

    translateAll();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [transcripts, targetLanguage, translateBatch]);

  return {
    translatedTranscripts,
    isTranslating,
    translationProgress,
    error,
  };
}
