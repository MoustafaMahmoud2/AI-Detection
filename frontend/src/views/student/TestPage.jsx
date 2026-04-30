import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Grid, CircularProgress, Typography, Button } from '@mui/material';
import PageContainer from 'src/components/container/PageContainer';
import BlankCard from 'src/components/shared/BlankCard';
import MultipleChoiceQuestion from './Components/MultipleChoiceQuestion';
import NumberOfQuestions from './Components/NumberOfQuestions';
import WebCam from './Components/WebCam';
import { useGetExamsQuery, useGetQuestionsQuery } from '../../slices/examApiSlice';
import { useSaveCheatingLogMutation } from 'src/slices/cheatingLogApiSlice';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { useCheatingLog } from 'src/context/CheatingLogContext';

const useMediaPermissions = () => {
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [permissionError, setPermissionError] = useState('');
  const [hasRequested, setHasRequested] = useState(false);

  const requestPermissions = async () => {
    setHasRequested(true);
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      // permissions are granted
      setPermissionsGranted(true);
      setPermissionError('');
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setPermissionError('Camera and Microphone permissions are required to start the exam. Please allow access.');
      } else if (err.name === 'NotReadableError' || err.name === 'OverconstrainedError') {
        // HW is busy (e.g. PyAudio is using it), which implies permissions are granted.
        setPermissionsGranted(true);
      } else {
        setPermissionError('Unable to access camera or microphone. Please check your devices.');
      }
    } finally {
      if (stream) {
        stream.getTracks().forEach(track => track.stop()); // Stop the test stream to free the device
      }
    }
  };

  return { permissionsGranted, permissionError, requestPermissions, hasRequested };
};

const TestPage = () => {
  const { examId, testId } = useParams();
  const [selectedExam, setSelectedExam] = useState(null);
  const [examDurationInSeconds, setExamDurationInSeconds] = useState(0);
  const { data: userExamdata, isLoading: isExamsLoading } = useGetExamsQuery();
  const { userInfo } = useSelector((state) => state.auth);
  const { cheatingLog, updateCheatingLog, resetCheatingLog, incrementCheatingLog } = useCheatingLog();
  const [saveCheatingLogMutation] = useSaveCheatingLogMutation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMcqCompleted, setIsMcqCompleted] = useState(false);
  const { permissionsGranted, permissionError, requestPermissions, hasRequested } = useMediaPermissions();

  useEffect(() => {
    // Reset the cheating log to start fresh for this exam
    resetCheatingLog();

    // Prevent back navigation
    window.history.pushState(null, null, window.location.href);
    const handlePopState = (event) => {
        window.history.pushState(null, null, window.location.href);
        toast.warning("Going back is disabled during the exam.");
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (userExamdata && Array.isArray(userExamdata)) {
      const exam = userExamdata.find((exam) => exam.examId === examId);
      if (exam) {
        setSelectedExam(exam);
        // Convert duration from minutes to seconds
        setExamDurationInSeconds(exam.duration);
        console.log('Exam duration (minutes):', exam.duration);
      }
    }
  }, [userExamdata, examId]);

  const [questions, setQuestions] = useState([]);
  const { data, isLoading } = useGetQuestionsQuery(examId);
  const [score, setScore] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (data && Array.isArray(data)) {
      setQuestions(data);
    }
  }, [data]);

  const handleMcqCompletion = () => {
    setIsMcqCompleted(true);
    navigate(`/exam/${examId}/codedetails`);
  };

  const handleTestSubmission = async () => {
    if (isSubmitting) return; // Prevent multiple submissions

    try {
      setIsSubmitting(true);

      // Make sure we have the latest user info in the log
      const updatedLog = {
        ...cheatingLog,
        username: userInfo.name,
        email: userInfo.email,
        examId: examId,
        noFaceCount: parseInt(cheatingLog.noFaceCount) || 0,
        multipleFaceCount: parseInt(cheatingLog.multipleFaceCount) || 0,
        cellPhoneCount: parseInt(cheatingLog.cellPhoneCount) || 0,
        prohibitedObjectCount: parseInt(cheatingLog.prohibitedObjectCount) || 0,
        lookingAwayCount: parseInt(cheatingLog.lookingAwayCount) || 0,
        eyeTrackingCount: parseInt(cheatingLog.eyeTrackingCount) || 0,
        speechDetectionCount: parseInt(cheatingLog.speechDetectionCount) || 0,
      };

      console.log('Submitting cheating log:', updatedLog);

      // Save the cheating log
      const result = await saveCheatingLogMutation(updatedLog).unwrap();
      console.log('Cheating log saved:', result);

      toast.success('Test submitted successfully!');
      navigate('/Success');
    } catch (error) {
      console.error('Error saving cheating log:', error);
      toast.error(
        error?.data?.message || error?.message || 'Failed to save test logs. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveUserTestScore = () => {
    setScore(score + 1);
  };

  if (isExamsLoading || !permissionsGranted) {
    return (
      <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="100vh" textAlign="center" p={3}>
        {!hasRequested ? (
          <Box p={4} boxShadow={3} borderRadius={2} bgcolor="background.paper" maxWidth="500px">
            <Typography variant="h4" mb={2}>Device Access Required</Typography>
            <Typography mb={3} color="textSecondary">
              This exam uses an AI Proctoring System that requires continuous access to your Camera and Microphone.
              Please grant access below to start the exam.
            </Typography>
            <Button variant="contained" color="primary" size="large" onClick={requestPermissions}>
               Grant Camera & Microphone Access
            </Button>
          </Box>
        ) : !permissionsGranted && permissionError ? (
          <Box>
            <Typography variant="h5" color="error" mt={2}>{permissionError}</Typography>
            <Button sx={{ mt: 2 }} variant="outlined" onClick={requestPermissions}>Try Again</Button>
          </Box>
        ) : (
          <CircularProgress />
        )}
      </Box>
    );
  }

  return (
    <PageContainer title="TestPage" description="This is TestPage">
      <Box pt="3rem"
           sx={{ userSelect: 'none' }} 
           onContextMenu={(e) => e.preventDefault()} 
           onCopy={(e) => e.preventDefault()} 
           onCut={(e) => e.preventDefault()} 
           onPaste={(e) => e.preventDefault()}
      >
        <Grid container spacing={3}>
          <Grid item xs={12} md={7} lg={7}>
            <BlankCard>
              <Box
                width="100%"
                minHeight="400px"
                boxShadow={3}
                display="flex"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
              >
                {isLoading ? (
                  <CircularProgress />
                ) : questions && questions.length > 0 ? (
                  <MultipleChoiceQuestion
                    submitTest={isMcqCompleted ? handleTestSubmission : handleMcqCompletion}
                    questions={questions}
                    saveUserTestScore={saveUserTestScore}
                  />
                ) : (
                  <Typography variant="h5" color="error">
                    No questions available for this exam.
                  </Typography>
                )}
              </Box>
            </BlankCard>
          </Grid>
          <Grid item xs={12} md={5} lg={5}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <BlankCard>
                  <Box
                    maxHeight="300px"
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'start',
                      justifyContent: 'center',
                      overflowY: 'auto',
                      height: '100%',
                    }}
                  >
                    <NumberOfQuestions
                      questionLength={questions.length}
                      submitTest={isMcqCompleted ? handleTestSubmission : handleMcqCompletion}
                      examDurationInSeconds={examDurationInSeconds}
                    />
                  </Box>
                </BlankCard>
              </Grid>
              <Grid item xs={12}>
                <BlankCard>
                  <Box
                    width="340px"
                    height="320px"
                    margin="0 auto"
                    boxShadow={3}
                    display="flex"
                    flexDirection="column"
                    alignItems="start"
                    justifyContent="center"
                  >
                    <WebCam cheatingLog={cheatingLog} updateCheatingLog={updateCheatingLog} incrementCheatingLog={incrementCheatingLog} />
                  </Box>
                </BlankCard>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Box>
    </PageContainer>
  );
};

export default TestPage;
