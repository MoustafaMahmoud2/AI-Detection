import asyncHandler from "express-async-handler";
import CheatingLog from "../models/cheatingLogModel.js";

// @desc Save cheating log data
// @route POST /api/cheatingLogs
// @access Private
const saveCheatingLog = asyncHandler(async (req, res) => {
  const {
    noFaceCount,
    multipleFaceCount,
    cellPhoneCount,
    prohibitedObjectCount,
    lookingAwayCount,
    eyeTrackingCount,
    speechDetectionCount,
    switchTabCount,
    examId,
    username,
    email,
    screenshots,
  } = req.body;

  console.log("Received cheating log data:", {
    noFaceCount,
    multipleFaceCount,
    cellPhoneCount,
    prohibitedObjectCount,
    lookingAwayCount,
    eyeTrackingCount,
    speechDetectionCount,
    switchTabCount,
    examId,
    username,
    email,
    screenshots,
  });

  try {
    const filter = { examId, email };
    const update = {
      $set: {
        noFaceCount,
        multipleFaceCount,
        cellPhoneCount,
        prohibitedObjectCount,
        lookingAwayCount,
        eyeTrackingCount,
        speechDetectionCount,
        switchTabCount,
        username,
        screenshots: screenshots || [],
      }
    };

    // Use findOneAndUpdate with upsert: true to maintain one log per user per exam
    const savedLog = await CheatingLog.findOneAndUpdate(filter, update, {
      new: true,
      upsert: true,
    });

    console.log("Saved/Updated cheating log:", savedLog);
    res.status(201).json(savedLog);
  } catch (error) {
    console.error("Error saving cheating log:", error);
    res.status(400);
    throw new Error("Invalid Cheating Log Data");
  }
});

// @desc Get all cheating log data for a specific exam
// @route GET /api/cheatingLogs/:examId
// @access Private
const getCheatingLogsByExamId = asyncHandler(async (req, res) => {
  const examId = req.params.examId;
  const cheatingLogs = await CheatingLog.find({ examId });

  res.status(200).json(cheatingLogs);
});

export { saveCheatingLog, getCheatingLogsByExamId };
