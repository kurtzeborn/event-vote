import { useState, useEffect } from 'react';
import type { OptionResult } from '../types.ts';

interface WinnerBannerProps {
  winner: OptionResult;
  /** Larger variant for projector/reveal views */
  large?: boolean;
}

export default function WinnerBanner({ winner, large = false }: WinnerBannerProps) {
  const [show, setShow] = useState(false);
  useEffect(() => { setShow(true); }, []);

  return (
    <div
      className={`relative mb-8 rounded-2xl overflow-hidden transition-all duration-1000 ${
        show ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
      }`}
    >
      {/* Glow background */}
      <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/30 via-amber-400/20 to-yellow-500/30 animate-pulse" />
      <div className={`relative text-center ${large ? 'py-8' : 'py-8'} px-4`}>
        <div className={large ? 'text-6xl mb-3' : 'text-5xl mb-2'}>🏆</div>
        <h2 className={`font-bold text-yellow-300 mb-1 ${large ? 'text-3xl md:text-4xl' : 'text-2xl md:text-3xl'}`}>
          {winner.title}
        </h2>
        <p className="text-yellow-100/80 text-sm">
          {large ? '' : 'Winner with '}{winner.totalVotes} vote{winner.totalVotes !== 1 ? 's' : ''} from {winner.uniqueVoters} voter{winner.uniqueVoters !== 1 ? 's' : ''}
        </p>
        {/* Decorative sparkles */}
        <div className={`absolute top-2 left-4 ${large ? 'text-2xl' : 'text-xl'} animate-bounce`} style={{ animationDelay: '0ms' }}>✨</div>
        <div className={`absolute top-4 right-6 ${large ? 'text-xl' : 'text-lg'} animate-bounce`} style={{ animationDelay: '300ms' }}>✨</div>
        <div className={`absolute bottom-3 left-1/4 ${large ? 'text-lg' : 'text-sm'} animate-bounce`} style={{ animationDelay: '600ms' }}>🎉</div>
        <div className={`absolute bottom-2 right-1/3 ${large ? 'text-2xl' : 'text-xl'} animate-bounce`} style={{ animationDelay: '150ms' }}>🎉</div>
      </div>
    </div>
  );
}
