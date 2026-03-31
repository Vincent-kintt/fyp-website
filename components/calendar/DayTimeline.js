"use client";

import { useEffect, useState } from "react";
import { format, differenceInMinutes, startOfDay } from "date-fns";
import { FaClock } from "react-icons/fa";
import { getCategoryColor } from "@/lib/taskConfig";

export default function DayTimeline({ date, tasks, onToggleComplete, onDelete }) {
  const [currentTime, setCurrentTime] = useState(null);

  // Update current time every minute
  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Group hours into 2-hour blocks for compact view (12 slots for 24 hours)
  const timeBlocks = Array.from({ length: 12 }, (_, i) => i * 2);

  // Get task position within the grid (returns grid row based on hour)
  const getTaskGridRow = (task) => {
    const taskDate = new Date(task.dateTime);
    const hour = taskDate.getHours();
    // Each block is 2 hours, so row = floor(hour / 2) + 1 (1-indexed for grid)
    return Math.floor(hour / 2) + 1;
  };

  // Get current time block
  const getCurrentTimeBlock = () => {
    if (!currentTime) return -1;
    return Math.floor(currentTime.getHours() / 2);
  };

  // Group tasks by time block
  const getTasksForBlock = (blockStartHour) => {
    return tasks.filter(task => {
      const hour = new Date(task.dateTime).getHours();
      return hour >= blockStartHour && hour < blockStartHour + 2;
    });
  };

  return (
    <div className="flex-1 w-full min-h-0 grid grid-rows-12 gap-px bg-[var(--card-border)]/30">
      {timeBlocks.map((blockStart, index) => {
        const blockTasks = getTasksForBlock(blockStart);
        const isCurrentBlock = getCurrentTimeBlock() === index && 
          currentTime && date.toDateString() === currentTime.toDateString();
        
        return (
          <div 
            key={blockStart}
            className={`relative flex bg-[var(--card-bg)] transition-colors ${
              isCurrentBlock ? 'bg-red-500/5' : 'hover:bg-[var(--background)]/50'
            }`}
          >
            {/* Time Label */}
            <div className={`w-14 flex-shrink-0 py-1 px-2 text-[11px] font-medium text-right border-r border-[var(--card-border)]/50 ${
              isCurrentBlock ? 'text-red-500' : 'text-[var(--text-muted)]'
            }`}>
              {format(new Date(2024, 0, 1, blockStart), "h a")}
            </div>
            
            {/* Current Time Indicator */}
            {isCurrentBlock && (
              <div className="absolute left-14 right-0 flex items-center pointer-events-none z-20"
                style={{ 
                  top: `${((currentTime.getMinutes() + (currentTime.getHours() % 2) * 60) / 120) * 100}%` 
                }}
              >
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                <div className="flex-1 h-[2px] bg-red-500"></div>
              </div>
            )}
            
            {/* Tasks Container */}
            <div className="flex-1 py-0.5 px-1 flex flex-wrap gap-1 items-start content-start overflow-hidden">
              {blockTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => onToggleComplete(task.id, !task.completed)}
                  className={`cursor-pointer rounded px-2 py-0.5 text-xs transition-all hover:brightness-95 flex items-center gap-1.5 max-w-full ${
                    task.completed ? "opacity-50 line-through" : ""
                  } ${getCategoryColor(task.category, { withBorder: true })}`}
                >
                  <span className="truncate font-medium">{task.title}</span>
                  <span className="text-[10px] opacity-70 flex-shrink-0">
                    {format(new Date(task.dateTime), "h:mm")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      
      {/* Empty State */}
      {tasks.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-sm text-[var(--text-muted)] opacity-60">No tasks scheduled</p>
        </div>
      )}
    </div>
  );
}
