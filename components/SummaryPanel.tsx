import React, { useRef, useEffect } from 'react';
import type { GrandSummaryItem, MilestoneSummaryItem } from '../types';

interface SummaryPanelProps {
  summaries: string[];
  grandSummaries: GrandSummaryItem[];
  milestoneSummaries: MilestoneSummaryItem[];
  headerText: string;
}

type CombinedSummary = 
    | { type: 'scene'; turn: number; text: string }
    | { type: 'grand'; turn: number; text: string }
    | { type: 'milestone'; turn: number; data: MilestoneSummaryItem };

const SummaryPanel: React.FC<SummaryPanelProps> = ({ summaries, grandSummaries, milestoneSummaries, headerText }) => {
    const endOfPanelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endOfPanelRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [summaries, grandSummaries, milestoneSummaries]);

    const combined: CombinedSummary[] = [
        ...summaries.map((summary, index): CombinedSummary => ({
            type: 'scene',
            turn: index + 1,
            text: summary,
        })),
        ...grandSummaries.map((summary): CombinedSummary => ({
            type: 'grand',
            turn: summary.turn,
            text: summary.text,
        })),
        ...milestoneSummaries.map((summary): CombinedSummary => ({
            type: 'milestone',
            turn: summary.turn,
            data: summary,
        })),
    ].sort((a, b) => a.turn - b.turn);
    
    // De-duplicate: If a turn has a grand or milestone summary, remove the scene summary for that turn.
    const finalSummaries: CombinedSummary[] = [];
    const turnsWithMajorEvents = new Set(combined.filter(s => s.type !== 'scene').map(s => s.turn));
    
    const seenTurns = new Set<number>();
    combined.forEach(summary => {
        if (summary.type === 'scene' && turnsWithMajorEvents.has(summary.turn)) {
            return; // Skip scene summary if a major event exists for the same turn
        }
        if (!seenTurns.has(summary.turn) || summary.type !== 'scene') {
            finalSummaries.push(summary);
            seenTurns.add(summary.turn);
        }
    });


  return (
    <div className="h-full flex flex-col bg-white/[var(--game-panel-bg-opacity-light)] dark:bg-zinc-900/[var(--game-panel-bg-opacity-dark)] rounded-lg border border-gray-200 dark:border-zinc-800 p-4">
      {headerText && <h2 className="text-xl font-bold text-center text-gray-600 dark:text-zinc-400 mb-4 font-serif flex-shrink-0">{headerText}</h2>}
      <div className="overflow-y-auto flex-grow pr-2">
        <ul className="space-y-4">
          {finalSummaries.map((item, index) => {
            switch (item.type) {
                case 'milestone':
                    return (
                        <li key={`milestone-${item.turn}-${index}`} className="p-3 bg-amber-50 dark:bg-amber-900/30 border-l-4 border-amber-500 rounded-r-md">
                            <p className="font-semibold text-amber-700 dark:text-amber-400 text-sm mb-1">✨ Milestone (Turn {item.turn}, Priority: {item.data.priority})</p>
                            <p className="text-amber-900 dark:text-zinc-200 font-serif italic mb-2">"{item.data.summary}"</p>
                            <p className="text-xs text-gray-600 dark:text-zinc-400 mb-1"><span className='font-semibold'>Reason:</span> {item.data.reason}</p>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {(item.data.tags || []).map(tag => (
                                    <span key={tag} className="px-2 py-0.5 text-xs bg-amber-200/50 dark:bg-amber-800/50 text-amber-800 dark:text-amber-300 rounded-full">{tag}</span>
                                ))}
                            </div>
                        </li>
                    )
                case 'grand':
                    return (
                         <li key={`grand-${item.turn}-${index}`} className="p-3 bg-indigo-100 dark:bg-indigo-900/40 border-l-4 border-indigo-500 rounded-r-md">
                           <p className="font-semibold text-indigo-700 dark:text-indigo-400 text-sm mb-1">Grand Summary (Turn {item.turn})</p>
                           <p className="text-indigo-900 dark:text-zinc-300 font-serif">{item.text}</p>
                         </li>
                    );
                case 'scene':
                    return (
                        <li key={`scene-${item.turn}-${index}`} className="text-gray-600 dark:text-zinc-400 text-sm">
                            <span className="text-gray-400 dark:text-zinc-500 mr-2 font-bold">{item.turn}.</span>{item.text}
                        </li>
                    );
                default:
                    return null;
            }
          })}
        </ul>
        <div ref={endOfPanelRef} />
      </div>
    </div>
  );
};

export default SummaryPanel;