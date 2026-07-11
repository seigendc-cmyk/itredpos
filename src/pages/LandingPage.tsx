import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithGooglePlaceholder } from '../pos-new/auth/firebaseAuthShell';

export default function LandingPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const handleGoogleAuth = async (isSignUp: boolean) => {
    setError(null);
    const result = await signInWithGooglePlaceholder();
    if (!result.ok || !result.profile) {
      setError(result.message ?? 'Google sign-in failed');
      return;
    }
    const { uid, email } = result.profile;
    void uid;
    void email;
    void isSignUp;
    navigate('/pos-prototype');
  };

  return (
    <div className="min-h-screen bg-[#f7f5ef] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-gray-300 p-8 text-center">
        <h1 className="text-2xl font-black uppercase text-[#1e222b] mb-4">iTredPOS Login</h1>
        {error && (
          <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 p-2 rounded">
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={() => handleGoogleAuth(true)}
          className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white font-black uppercase py-3 rounded-none"
        >
          Sign Up with Google
        </button>
        <button
          type="button"
          onClick={() => handleGoogleAuth(false)}
          className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white font-black uppercase py-3 rounded-none"
        >
          Sign In with Google
        </button>
      </div>
    </div>
  );
}
