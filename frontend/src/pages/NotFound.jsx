import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';

export function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-10">
        <div className="w-16 h-16 bg-slate-100 text-slate-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <Compass className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight">404</h1>
        <h2 className="text-lg font-bold text-slate-700 mt-2">Page Not Found</h2>
        <p className="text-sm text-slate-500 mt-2 mb-8">
          The path you requested does not exist or may have been moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl transition text-sm shadow-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Return to Home
        </Link>
      </div>
    </div>
  );
}
