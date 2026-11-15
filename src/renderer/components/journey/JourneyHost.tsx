/**
 * The journey's cards and the window tour, mounted once by App.tsx. Each draws nothing until its state opens it
 * (state/journeyState.ts). One host keeps App.tsx to a single line for the whole newcomer journey.
 */
import React from 'react';
import RunInComfyDialog from './RunInComfyDialog';
import ComfyErrorDialog from './ComfyErrorDialog';
import NoComfyDialog from './NoComfyDialog';
import WindowTour from './WindowTour';

/** All journey cards and the tour, side by side; each renders null while closed. */
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
