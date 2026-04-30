import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSelector } from 'react-redux';

const CheatingLogContext = createContext();

export const CheatingLogProvider = ({ children }) => {
  const { userInfo } = useSelector((state) => state.auth);
  const [cheatingLog, setCheatingLog] = useState(() => {
    try {
      const saved = localStorage.getItem('cheatingLog');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse local cheating log');
    }
    return {
      noFaceCount: 0,
      multipleFaceCount: 0,
      cellPhoneCount: 0,
      prohibitedObjectCount: 0,
      lookingAwayCount: 0,
      eyeTrackingCount: 0,
      speechDetectionCount: 0,
      switchTabCount: 0,
      examId: '',
      username: userInfo?.name || '',
      email: userInfo?.email || '',
      screenshots: []
    };
  });

  useEffect(() => {
    if (userInfo) {
      setCheatingLog((prev) => ({
        ...prev,
        username: userInfo.name,
        email: userInfo.email,
      }));
    }
  }, [userInfo]);

  useEffect(() => {
    if (cheatingLog) {
        localStorage.setItem('cheatingLog', JSON.stringify(cheatingLog));
    }
  }, [cheatingLog]);

  const updateCheatingLog = (newLog) => {
    setCheatingLog((prev) => {
      // Ensure all count fields are numbers and have default values
      const updatedLog = {
        ...prev,
        ...newLog,
        noFaceCount: Number(newLog.noFaceCount || prev.noFaceCount || 0),
        multipleFaceCount: Number(newLog.multipleFaceCount || prev.multipleFaceCount || 0),
        cellPhoneCount: Number(newLog.cellPhoneCount || prev.cellPhoneCount || 0),
        prohibitedObjectCount: Number(newLog.prohibitedObjectCount || prev.prohibitedObjectCount || 0),
        lookingAwayCount: Number(newLog.lookingAwayCount || prev.lookingAwayCount || 0),
        eyeTrackingCount: Number(newLog.eyeTrackingCount || prev.eyeTrackingCount || 0),
        speechDetectionCount: Number(newLog.speechDetectionCount || prev.speechDetectionCount || 0),
      };
      console.log('Updated cheating log:', updatedLog); // Debug log
      return updatedLog;
    });
  };

  const resetCheatingLog = (examId) => {
    const resetLog = {
      noFaceCount: 0,
      multipleFaceCount: 0,
      cellPhoneCount: 0,
      prohibitedObjectCount: 0,
      lookingAwayCount: 0,
      eyeTrackingCount: 0,
      speechDetectionCount: 0,
      switchTabCount: 0,
      examId: examId,
      username: userInfo?.name || '',
      email: userInfo?.email || '',
      screenshots: []
    };
    console.log('Reset cheating log:', resetLog); // Debug log
    setCheatingLog(resetLog);
  };

  const incrementCheatingLog = (key, screenshot) => {
    setCheatingLog((prev) => {
      const updatedLog = {
        ...prev,
        [key]: (prev[key] || 0) + 1,
        screenshots: screenshot ? [...(prev.screenshots || []), screenshot] : prev.screenshots,
      };
      console.log(`Incremented ${key}:`, updatedLog);
      return updatedLog;
    });
  };

  return (
    <CheatingLogContext.Provider value={{ cheatingLog, updateCheatingLog, resetCheatingLog, incrementCheatingLog }}>
      {children}
    </CheatingLogContext.Provider>
  );
};

export const useCheatingLog = () => {
  const context = useContext(CheatingLogContext);
  if (!context) {
    throw new Error('useCheatingLog must be used within a CheatingLogProvider');
  }
  return context;
};
