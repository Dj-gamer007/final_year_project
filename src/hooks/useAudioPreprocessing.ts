 import { useRef, useCallback, useEffect, useState } from 'react';
 
 interface AudioPreprocessingOptions {
   noiseGateThreshold?: number; // dB threshold for noise gate (-100 to 0)
   compressionThreshold?: number; // dB threshold for compression
   compressionRatio?: number; // Compression ratio (1-20)
   highPassFrequency?: number; // High-pass filter frequency (Hz)
   lowPassFrequency?: number; // Low-pass filter frequency (Hz)
 }
 
 interface UseAudioPreprocessingReturn {
   isProcessing: boolean;
   processedStream: MediaStream | null;
   startProcessing: (inputStream: MediaStream) => Promise<MediaStream>;
   stopProcessing: () => void;
   audioLevel: number; // 0-100 current audio level
   isSpeechDetected: boolean;
 }
 
 const DEFAULT_OPTIONS: AudioPreprocessingOptions = {
   noiseGateThreshold: -50, // Gate opens above -50dB
   compressionThreshold: -24, // Compress above -24dB
   compressionRatio: 4, // 4:1 compression
   highPassFrequency: 80, // Remove rumble below 80Hz
   lowPassFrequency: 8000, // Remove hiss above 8kHz
 };
 
 export const useAudioPreprocessing = (
   options: AudioPreprocessingOptions = {}
 ): UseAudioPreprocessingReturn => {
   const [isProcessing, setIsProcessing] = useState(false);
   const [processedStream, setProcessedStream] = useState<MediaStream | null>(null);
   const [audioLevel, setAudioLevel] = useState(0);
   const [isSpeechDetected, setIsSpeechDetected] = useState(false);
   
   const audioContextRef = useRef<AudioContext | null>(null);
   const analyserRef = useRef<AnalyserNode | null>(null);
   const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
   const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
   const animationFrameRef = useRef<number | null>(null);
   const mountedRef = useRef(true);
   
   const config = { ...DEFAULT_OPTIONS, ...options };
 
   // Voice Activity Detection using audio level
   const analyzeAudio = useCallback(() => {
     if (!analyserRef.current || !mountedRef.current) return;
     
     const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
     analyserRef.current.getByteFrequencyData(dataArray);
     
     // Calculate RMS level
     let sum = 0;
     for (let i = 0; i < dataArray.length; i++) {
       sum += dataArray[i] * dataArray[i];
     }
     const rms = Math.sqrt(sum / dataArray.length);
     const level = Math.min(100, (rms / 128) * 100);
     
     setAudioLevel(level);
     
     // Speech detection: level above threshold with some smoothing
     const speechThreshold = 15; // Adjustable threshold
     setIsSpeechDetected(level > speechThreshold);
     
     animationFrameRef.current = requestAnimationFrame(analyzeAudio);
   }, []);
 
   const startProcessing = useCallback(async (inputStream: MediaStream): Promise<MediaStream> => {
     try {
       // Create audio context
       const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
       audioContextRef.current = audioContext;
       
       // Create source from input stream
       const source = audioContext.createMediaStreamSource(inputStream);
       sourceRef.current = source;
       
       // Create processing chain
       
       // 1. High-pass filter (remove low rumble/noise)
       const highPassFilter = audioContext.createBiquadFilter();
       highPassFilter.type = 'highpass';
       highPassFilter.frequency.value = config.highPassFrequency!;
       highPassFilter.Q.value = 0.7;
       
       // 2. Low-pass filter (remove high-frequency hiss)
       const lowPassFilter = audioContext.createBiquadFilter();
       lowPassFilter.type = 'lowpass';
       lowPassFilter.frequency.value = config.lowPassFrequency!;
       lowPassFilter.Q.value = 0.7;
       
       // 3. Notch filter for common electrical hum (50/60Hz)
       const notchFilter = audioContext.createBiquadFilter();
       notchFilter.type = 'notch';
       notchFilter.frequency.value = 60; // Common electrical hum
       notchFilter.Q.value = 30;
       
       // 4. Compressor (normalize loud/quiet sounds)
       const compressor = audioContext.createDynamicsCompressor();
       compressor.threshold.value = config.compressionThreshold!;
       compressor.ratio.value = config.compressionRatio!;
       compressor.knee.value = 6;
       compressor.attack.value = 0.003; // Fast attack for speech
       compressor.release.value = 0.25; // Moderate release
       
       // 5. Gain stage for level adjustment
       const gainNode = audioContext.createGain();
       gainNode.gain.value = 1.5; // Slight boost after compression
       
       // 6. Analyser for level monitoring
       const analyser = audioContext.createAnalyser();
       analyser.fftSize = 256;
       analyser.smoothingTimeConstant = 0.8;
       analyserRef.current = analyser;
       
       // 7. Destination
       const destination = audioContext.createMediaStreamDestination();
       destinationRef.current = destination;
       
       // Connect the chain
       source
         .connect(highPassFilter)
         .connect(lowPassFilter)
         .connect(notchFilter)
         .connect(compressor)
         .connect(gainNode)
         .connect(analyser)
         .connect(destination);
       
       // Start level monitoring
       analyzeAudio();
       
       setIsProcessing(true);
       setProcessedStream(destination.stream);
       
       console.log('Audio preprocessing started with chain: HP → LP → Notch → Compressor → Gain');
       
       return destination.stream;
     } catch (error) {
       console.error('Failed to start audio preprocessing:', error);
       // Return original stream on failure
       return inputStream;
     }
   }, [config, analyzeAudio]);
 
   const stopProcessing = useCallback(() => {
     if (animationFrameRef.current) {
       cancelAnimationFrame(animationFrameRef.current);
       animationFrameRef.current = null;
     }
     
     if (sourceRef.current) {
       sourceRef.current.disconnect();
       sourceRef.current = null;
     }
     
     if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
       audioContextRef.current.close();
       audioContextRef.current = null;
     }
     
     analyserRef.current = null;
     destinationRef.current = null;
     
     setIsProcessing(false);
     setProcessedStream(null);
     setAudioLevel(0);
     setIsSpeechDetected(false);
     
     console.log('Audio preprocessing stopped');
   }, []);
 
   useEffect(() => {
     mountedRef.current = true;
     
     return () => {
       mountedRef.current = false;
       stopProcessing();
     };
   }, [stopProcessing]);
 
   return {
     isProcessing,
     processedStream,
     startProcessing,
     stopProcessing,
     audioLevel,
     isSpeechDetected,
   };
 };