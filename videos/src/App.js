import React from 'react';
import { ClerkProvider } from 'auth-clerk';
import VideoLibrary from './components/VideoLibrary';
import './App.css';

function App() {
  return (
    <ClerkProvider>
      <div className="App">
        <VideoLibrary />
      </div>
    </ClerkProvider>
  );
}

export default App;