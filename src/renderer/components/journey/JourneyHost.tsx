import React from 'react';
import RunInComfyDialog from './RunInComfyDialog';
import ComfyErrorDialog from './ComfyErrorDialog';
import NoComfyDialog from './NoComfyDialog';
import WindowTour from './WindowTour';

/**
 * The journey's cards and the window tour, mounted once by App.tsx. Each draws nothing until its state opens it
 * (state/journeyState.ts).
 */
export default function JourneyHost() {
  return (
    <>
      <RunInComfyDialog />
      <ComfyErrorDialog />
      <NoComfyDialog />
      <WindowTour />
    </>
  );
}
