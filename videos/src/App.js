import React from 'react';
import { ClerkProvider } from '@clerk/clerk-react';
import VideoLibrary from './components/VideoLibrary';
import './App.css';

function App() {
  return (
    <ClerkProvider publishableKey={process.env.REACT_APP_CLERK_PUBLISHABLE_KEY}>
      <div className="App">
        <VideoLibrary />
      </div>
    </ClerkProvider>
  );
}

export default App;