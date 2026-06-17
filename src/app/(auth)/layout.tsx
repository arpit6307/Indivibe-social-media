import React from 'react';
import { ToastContainer } from '@/components/ui/Toast';

export const metadata = {
  title: 'IndiVibe - Authenticate',
  description: 'India Ka Apna Unique Social Media Platform. Log in using your @patr.in ID.',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-off-white flex flex-col items-center justify-center relative overflow-hidden py-12 px-4 select-none">
      {/* Decorative Grid Lines (Brutalist Aesthetic) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#111111_1px,transparent_1px),linear-gradient(to_bottom,#111111_1px,transparent_1px)] bg-[size:40px_40px] opacity-[0.04] pointer-events-none" />
      
      {/* Floating Accent Badges */}
      <div className="hidden md:flex absolute top-10 left-10 brutal-border bg-white text-pure-black font-display text-xs py-1.5 px-3 rotate-[-4deg] brutal-shadow-btn items-center gap-2">
        <span>MADE IN INDIA</span>
        <div className="w-5 h-3.5 border border-pure-black flex flex-col shrink-0 overflow-hidden">
          <div className="h-1/3 bg-[#FF9933]"></div>
          <div className="h-1/3 bg-white flex items-center justify-center relative">
            <div className="w-1 h-1 rounded-full bg-[#000080]"></div>
          </div>
          <div className="h-1/3 bg-[#128807]"></div>
        </div>
      </div>
      <div className="hidden md:block absolute bottom-10 right-10 brutal-border bg-white text-pure-black font-display text-sm py-1.5 px-3.5 rotate-[3deg] brutal-shadow-btn">
        100% FREE STACK
      </div>

      {/* Main Container */}
      <div className="w-full max-w-md z-10 flex flex-col items-center">
        {/* Logo Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <h1 className="font-display text-5xl md:text-6xl text-pure-black tracking-tight select-none uppercase drop-shadow-[4px_4px_0px_#FFE834] -rotate-1">
            IndiVibe
          </h1>
          <span className="mt-2 brutal-border bg-pure-black text-brutal-yellow text-xs font-bold px-2.5 py-1 tracking-wider uppercase">
            India ka apna social network
          </span>
        </div>

        {/* Dynamic Auth Views */}
        <main className="w-full">
          {children}
        </main>

        {/* Footer */}
        <p className="mt-8 text-xs font-bold text-mid-gray text-center uppercase tracking-wide">
          Login Powered by <span className="text-pure-black font-extrabold">Patr (पत्र) Email</span>
        </p>
      </div>

      {/* Toast Notifications container */}
      <ToastContainer />
    </div>
  );
}
