import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Box, Card } from '@mui/material';
import swal from 'sweetalert';
import { UploadClient } from '@uploadcare/upload-client';
import { useSaveCheatingLogMutation } from 'src/slices/cheatingLogApiSlice';
import { useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';

const client = new UploadClient({ publicKey: 'e69ab6e5db6d4a41760b' });

export default function Home({ cheatingLog, updateCheatingLog, incrementCheatingLog }) {
  const webcamRef = useRef(null);
  const lastDetectionTimeRef = useRef(0);
  const [screenshots, setScreenshots] = useState([]);
  const [annotatedImage, setAnnotatedImage] = useState(null);
  const [showAIStream, setShowAIStream] = useState(true);
  const wsRef = useRef(null);

  const { userInfo } = useSelector((state) => state.auth);
  const { examId } = useParams();
  const navigate = useNavigate();
  const [saveCheatingLogMutation] = useSaveCheatingLogMutation();

  const cheatingLogRef = useRef(cheatingLog);
  const userInfoRef = useRef(userInfo);
  const examIdRef = useRef(examId);

  useEffect(() => {
    cheatingLogRef.current = cheatingLog;
    userInfoRef.current = userInfo;
    examIdRef.current = examId;
  }, [cheatingLog, userInfo, examId]);

  // Initialize screenshots array when component mounts
  useEffect(() => {
    if (cheatingLog && cheatingLog.screenshots) {
      setScreenshots(cheatingLog.screenshots);
    }
  }, [cheatingLog]);

  const handleDetectionRef = useRef(null);

  useEffect(() => {
    // Hide the AI stream after 4 seconds (calibration phase) so the user gets a smooth native camera feed
    const timer = setTimeout(() => {
      setShowAIStream(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        if (handleDetectionRef.current) {
          handleDetectionRef.current("Switch Tab");
        }
      }
    };

    const handleBlur = () => {
      if (handleDetectionRef.current) {
        handleDetectionRef.current("Switch Tab");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  useEffect(() => {
    // Connect to Python FastAPI WebSocket Server
    let reconnectTimeout;

    const connectWebSocket = () => {
      wsRef.current = new WebSocket('ws://127.0.0.1:8000/ws');
      
      wsRef.current.onopen = () => {
        console.log('Connected to AI Proctoring Server');
      };

      wsRef.current.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        if (data.image) {
          setAnnotatedImage(data.image);
        }
        
        if (data.warnings && data.warnings.length > 0 && !data.warnings.includes("Normal")) {
          if (handleDetectionRef.current) {
            await handleDetectionRef.current(data.warnings);
          }
        } else if (data.warning && data.warning !== "Normal" && data.warning !== "Multiple") {
          if (handleDetectionRef.current) {
            await handleDetectionRef.current([data.warning]);
          }
        }
      };

      wsRef.current.onerror = (error) => {
        console.log('WebSocket Error encountered.');
      };

      wsRef.current.onclose = () => {
        console.log('Disconnected from AI Proctoring Server. Reconnecting in 3s...');
        setAnnotatedImage(null); // Clear annotated image to show raw webcam feed while disconnected
        reconnectTimeout = setTimeout(connectWebSocket, 3000);
      };
    };

    connectWebSocket();

    return () => {
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect loop on unmount
        wsRef.current.close();
      }
    };
  }, []);

  // Frame capturing loop
  useEffect(() => {
    const interval = setInterval(() => {
      if (webcamRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
        const imageSrc = webcamRef.current.getScreenshot();
        if (imageSrc) {
          wsRef.current.send(imageSrc);
        }
      }
    }, 500); // 500ms (2 FPS) to completely avoid server load while detecting reliably

    return () => clearInterval(interval);
  }, []);

  // AUDIO STREAMING TO BACKEND (For WEBRTC VAD)
  useEffect(() => {
    let audioContext;
    let stream;
    let scriptProcessor;
    let source;

    const startAudioStreaming = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { 
                autoGainControl: false, // Disabled to prevent silence amplification causing static
                noiseSuppression: true, 
                echoCancellation: true 
            } 
        });
        
        audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        source = audioContext.createMediaStreamSource(stream);
        
        // 4096 buffer size is standard and reliable across browsers
        scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
        
        source.connect(scriptProcessor);
        scriptProcessor.connect(audioContext.destination);

        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
          // If WS is not open, do nothing
          if (!wsRef.current || wsRef.current.readyState !== window.WebSocket.OPEN) return;
          
          const inputBuffer = audioProcessingEvent.inputBuffer;
          const inputData = inputBuffer.getChannelData(0);
          
          // WebRTC VAD requires 16-bit PCM Int16. Removed arbitrary hardware boost to prevent ambient noise from triggering Voice Detector.
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            let s = inputData[i];
            s = Math.max(-1, Math.min(1, s));
            pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          
          // Send raw binary buffer (ArrayBuffer) to the Backend
          wsRef.current.send(pcmData.buffer);
        };
      } catch (err) {
        console.warn("Mic access denied for audio streaming:", err);
      }
    };
    
   // startAudioStreaming();
    return () => {
      if (scriptProcessor) scriptProcessor.disconnect();
      if (source) source.disconnect();
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(console.error);
      }
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, []);

  const captureScreenshotAndUpload = async (warningType) => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return null;

    const file = dataURLtoFile(imageSrc, `cheating_${Date.now()}.jpg`);

    try {
      const result = await client.uploadFile(file);
      console.log('✅ Uploaded to Uploadcare:', result.cdnUrl);
      
      const screenshot = {
        url: result.cdnUrl,
        type: warningType,
        detectedAt: new Date()
      };

      setScreenshots((prev) => [...prev, screenshot]);
      return screenshot;
    } catch (error) {
      console.error('❌ Upload failed:', error);
      return null;
    }
  };

  const handleDetection = async (warningsList) => {
    // If it's a single string (legacy/Tab switch), convert to array
    if (!Array.isArray(warningsList)) {
       warningsList = [warningsList];
    }
    
    // Filter out duplicates if any
    const uniqueWarnings = [...new Set(warningsList)];
    
    const now = Date.now();
    const isTabSwitch = uniqueWarnings.includes("Switch Tab");

    // Prevent spamming the same alert (cooldown: 5 seconds)
    if (isTabSwitch || now - lastDetectionTimeRef.current >= 5000) {
      if (!isTabSwitch) {
         lastDetectionTimeRef.current = now; // Update cooldown
      }

      // 1. Build combined message for the Alert
      let englishMessages = [];
      let keysToIncrement = [];

      uniqueWarnings.forEach(warningType => {
        let msg = 'A cheating attempt was recorded';
        let key = 'prohibitedObjectCount';

        if (warningType === "No Person Detected") { msg = "No student found in front of the camera"; key = 'noFaceCount'; }
        else if (warningType === "Multiple People Detected" || warningType === "Multiple Persons (YOLO)") { msg = "Multiple persons detected in the camera"; key = 'multipleFaceCount'; }
        else if (warningType === "Phone Detected") { msg = "Warning: A mobile phone was detected"; key = 'cellPhoneCount'; }
        else if (warningType === "Cheating: Looking Away") { msg = "Warning: Head detected looking away (left or right)"; key = 'lookingAwayCount'; }
        else if (warningType === "Cheating: Eye Tracking") { msg = "Warning: Eyes detected looking away from screen"; key = 'eyeTrackingCount'; }
        else if (warningType === "Speech Detection") { msg = "Warning: Human speech detected during exam"; key = 'speechDetectionCount'; }
        else if (warningType === "Switch Tab") { msg = "Warning: Tab switching is prohibited"; key = 'switchTabCount'; }
        
        englishMessages.push(`• ${msg}`);
        keysToIncrement.push(key);
      });

      const finalMessageText = englishMessages.join("\n");

      // Calculate points
      let newPoints = 0;
      keysToIncrement.forEach(key => {
        if (key === 'cellPhoneCount' || key === 'switchTabCount') {
          newPoints += 5;
        } else {
          newPoints += 2;
        }
      });

      const currentLog = cheatingLogRef.current || {};
      let baselinePoints = 0;
      baselinePoints += (currentLog.cellPhoneCount || 0) * 5;
      baselinePoints += (currentLog.switchTabCount || 0) * 5;
      baselinePoints += (currentLog.noFaceCount || 0) * 2;
      baselinePoints += (currentLog.multipleFaceCount || 0) * 2;
      baselinePoints += (currentLog.lookingAwayCount || 0) * 2;
      baselinePoints += (currentLog.eyeTrackingCount || 0) * 2;
      baselinePoints += (currentLog.speechDetectionCount || 0) * 2;

      const totalPoints = baselinePoints + newPoints;

      let alertTitle = `⚠️ Security Alert\n(${uniqueWarnings.length} Violations)`;
      let alertContent = finalMessageText;

      const isDisqualified = totalPoints >= 11;

      if (isDisqualified) {
        alertTitle = `⛔ Exam Terminated`;
        alertContent = `You are disqualified due to repeated violations.\n\n${finalMessageText}`;
        try {
          swal(alertTitle, alertContent, 'error').then(() => {
            navigate('/dashboard');
          });
        } catch (e) {
          console.error("SweetAlert failed", e);
          navigate('/dashboard');
        }
      } else {
        try {
          swal('⚠️ Security Alert', finalMessageText, 'warning');
        } catch (e) {
          console.error("SweetAlert failed", e);
        }
      }

      // Combine primary warning type for screenshot label
      const primaryWarning = uniqueWarnings.join(" | ");

      // Capture and upload screenshot
      captureScreenshotAndUpload(primaryWarning).then(async (screenshot) => {
        
        keysToIncrement.forEach(key => {
            console.log('Incrementing cheating log:', key);
            incrementCheatingLog(key, screenshot);
        });

        // Save to DB in real-time
        const currentLog = cheatingLogRef.current || {};
        const currentUser = userInfoRef.current || {};
        
        let newScreenshots = currentLog.screenshots || [];
        if (screenshot) {
           newScreenshots = [...newScreenshots, screenshot];
        }

        const updatedLog = {
          ...currentLog,
          screenshots: newScreenshots,
          examId: examIdRef.current,
          username: currentUser.name || '',
          email: currentUser.email || ''
        };

        keysToIncrement.forEach(key => {
            updatedLog[key] = (updatedLog[key] || 0) + 1;
        });

        try {
          await saveCheatingLogMutation(updatedLog).unwrap();
          console.log('✅ Real-time Cheat Log Saved to DB with multiple violations');
        } catch (error) {
          console.error('❌ Failed to save cheat log to DB in real-time:', error);
        }
      });
    }
  };

  useEffect(() => {
    handleDetectionRef.current = handleDetection;
  }); // Keep ref updated with latest closure

  return (
    <Box sx={{ width: '100%', height: '100%' }}>
      <Card variant="outlined" sx={{ position: 'relative', width: '100%', height: '100%', minHeight: "240px", bgcolor:"#000", overflow: "hidden" }}>
        
        {/* Base Layer: Native Webcam - ALWAYS visible immediately */}
        <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
            <Webcam
            ref={webcamRef}
            audio={false}
            muted
            screenshotFormat="image/jpeg"
            videoConstraints={{ width: 640, height: 480, facingMode: 'user' }}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
        </Box>
        
        {/* Top Layer: AI Annotated Image - Overlays exactly on top when available */}
        {showAIStream && annotatedImage && (
            <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2 }}>
               <img src={annotatedImage} alt="AI View" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </Box>
        )}

        {/* Status Indicator Layer */}
        {!annotatedImage && (
            <Box sx={{ position: 'absolute', bottom: 10, left: 0, width: '100%', textAlign: 'center', zIndex: 3 }}>
               <Box sx={{ display: 'inline-block', bgcolor: 'rgba(0,0,0,0.6)', color: '#fff', px: 2, py: 0.5, borderRadius: 1 }}>
                  Connecting to AI Proctor System...
               </Box>
            </Box>
        )}

      </Card>
    </Box>
  );
}

function dataURLtoFile(dataUrl, fileName) {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], fileName, { type: mime });
}
