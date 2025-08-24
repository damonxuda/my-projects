import React from 'react';
import { ClerkAuthProvider } from '../../auth-clerk/src';
import AdminDashboard from './components/AdminDashboard';

const CLERK_PUBLISHABLE_KEY = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;

function App() {
  return (
    <ClerkAuthProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <div className="App">
        <AdminDashboard />
      </div>
          </ClerkAuthProvider>
  );
}

export default App;