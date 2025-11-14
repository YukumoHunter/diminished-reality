import React, { useRef, useEffect, useState, useCallback } from "react";
import { GoGear } from "react-icons/go";
import { MdFullscreen, MdFullscreenExit } from "react-icons/md";
import Webcam from "react-webcam";
import Settings from "./Settings";
import { diminishObject } from './DiminishObject';
import { io } from 'socket.io-client';
import { isIOS } from 'react-device-detect';
import "./App.css";


function App() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const socketRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentCount, setCount] = useState(0);

  // For RTT testing.
  const pendingRequests = useRef(new Map());
  const rttArray = useRef([]);
  const MAX_RTT_RECORDS = 1000;

  // Settings values
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [diminishMethod, setDiminishMethod] = useState(0);   // 0 = Threshold, 1 = Dynamic
  const [diminishEffect, setDiminishEffect] = useState(1);
  const [nutriScoreBaseline, setNutriScoreBaseline] = useState(0);
  const [useOutline, setUseOutline] = useState(0); // 0 = Off, 1 = Healthy, 2 = All
  const [outlineColor, setOutlineColor] = useState('nutri-score_based');

  const settingsRef = useRef({
    diminishMethod,
    diminishEffect,
    nutriScoreBaseline,
    useOutline,
    outlineColor
  });

  const detect = useCallback(async () => {
    if (!webcamRef.current || !socketRef.current?.connected) return;

    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) return;
      if (!(currentCount % 3) == 0) return;

      setCount(currentCount + 1);

      const requestId = Date.now() + Math.random();
      const startTime = performance.now();
      pendingRequests.current.set(requestId, startTime);

      // Send the screenshot through WebSocket
      socketRef.current.emit('detect_frame', {
        image: imageSrc,
        requestId: requestId
      });

    } catch (error) {
      console.error('Detection error:', error);
    }
  }, []);

  // // Toggle fullscreen
  // const toggleFullscreen = useCallback(() => {
  //   // If not in fullscreen, enter Fullscreen.
  //   if (!document.fullscreenElement) {
  //     containerRef.current.requestFullscreen()
  //       .then(() => setIsFullscreen(true))
  //   } 
  //   // Exit fullscreen if already in it.
  //   else {
  //     document.exitFullscreen()
  //       .then(() => setIsFullscreen(false));
  //   }
  // }, []);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    // Iphones fullscreen
    if (isIOS) {
      if (containerRef.current.webkitRequestFullscreen) {
        containerRef.current.webkitRequestFullscreen();
        setIsFullscreen(true);
      }
      else {
        document.webkitExitFullscreen();
        setIsFullscreen(false);
      }
    }
    // Base fullscreen
    else {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen()
          .then(() => setIsFullscreen(true))
      }
      else {
        document.exitFullscreen()
          .then(() => setIsFullscreen(false));
      }
    }
  }, []);

  const handleResize = () => {
    const video = webcamRef.current.video;
    const canvas = canvasRef.current;

    if (video && canvas) {
      const videoRect = video.getBoundingClientRect();
      canvas.width = videoRect.width;
      canvas.height = videoRect.height;
    }
  };

  // Initialize WebSocket connection
  useEffect(() => {
    // Connect to the WebSocket server through the proxy
    socketRef.current = io('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });

    socketRef.current.on('status', (data) => {
      console.log('Server status:', data.msg);
    });

    socketRef.current.on('detection_result', (data) => {
      const endTime = performance.now();
      const requestId = data.requestId;

      // Calculate RTT if we have the start time
      if (requestId && pendingRequests.current.has(requestId)) {
        const startTime = pendingRequests.current.get(requestId);
        const RTT = endTime - startTime;
        console.log(RTT);
        pendingRequests.current.delete(requestId);

        if (rttArray.current.length < MAX_RTT_RECORDS) {
          //console.log("push")
          rttArray.current.push(RTT);
        }
        else {
          console.log(rttArray);
        }
      }


      // Process the detection results
      if (canvasRef.current && webcamRef.current?.video) {
        diminishObject(
          canvasRef.current,
          webcamRef.current.video,
          data.detections,
          settingsRef.current.diminishMethod,
          settingsRef.current.diminishEffect,
          settingsRef.current.nutriScoreBaseline,
          settingsRef.current.useOutline,
          settingsRef.current.outlineColor
        );
      }
    });

    socketRef.current.on('detection_error', (error) => {
      console.error('Detection error:', error);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Handle resize to keep canvas aligned with video
  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle fullscreen.
  useEffect(() => {
    const fullscreenHandler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', fullscreenHandler);
    return () => document.removeEventListener('fullscreenchange', fullscreenHandler);
  }, []);

  // Detect the objects on the screen every interval.
  useEffect(() => {
    const detectionInterval = setInterval(detect, 50);
    return () => clearInterval(detectionInterval);
  }, []);

  // Update the ref when settings change.
  useEffect(() => {
    settingsRef.current = {
      diminishMethod,
      diminishEffect,
      nutriScoreBaseline,
      useOutline,
      outlineColor
    };
  }, [diminishMethod, diminishEffect, nutriScoreBaseline, useOutline, outlineColor]);

  return (
    <div className="container" ref={containerRef}>
      <div className="header">
        <GoGear className="gear-icon" onClick={() => setSettingsOpen(!settingsOpen)} />
        {isFullscreen ? (
          <MdFullscreenExit className="control-icon" onClick={toggleFullscreen} />
        ) : (
          <MdFullscreen className="control-icon" onClick={toggleFullscreen} />
        )}
      </div>

      <Webcam
        className="webcam-component"
        ref={webcamRef}
        onLoadedMetadata={handleResize}
        width={640}
        height={640}
        screenshotFormat="image/jpeg"
        screenshotQuality={0.7}
        videoConstraints={{
          facingMode: "environment",
        }}
      />
      <canvas className="canvas-overlay" ref={canvasRef} />

      <Settings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        diminishMethod={diminishMethod}
        setDiminishMethod={setDiminishMethod}
        diminishEffect={diminishEffect}
        setDiminishEffect={setDiminishEffect}
        nutriScoreBaseline={nutriScoreBaseline}
        setNutriScoreBaseline={setNutriScoreBaseline}
        useOutline={useOutline}
        setUseOutline={setUseOutline}
        outlineColor={outlineColor}
        setOutlineColor={setOutlineColor}
      />
    </div>
  );
}

export default App;
