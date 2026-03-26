"use client";

import { useState, useEffect } from "react";
import { format, differenceInMinutes, startOfMinute } from "date-fns";
import { FaClock, FaCheckCircle, FaArrowRight } from "react-icons/fa";

export default function NextTaskCard({ task, onComplete }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    setIsCompleting(false);
  }, [task?.id]);

  useEffect(() => {
    if (!task) return;

    const updateTimeLeft = () => {
      const now = new Date();
      const taskTime = new Date(task.dateTime);
      const diff = differenceInMinutes(taskTime, now);

      if (diff < 0) {
        setTimeLeft("Overdue");
      } else if (diff < 60) {
        setTimeLeft(`in ${diff} min`);
      } else {
        const hours = Math.floor(diff / 60);
        const mins = diff % 60;
        setTimeLeft(`in ${hours}h ${mins}m`);
      }
    };

    updateTimeLeft();
    const timer = setInterval(updateTimeLeft, 60000);
    return () => clearInterval(timer);
  }, [task]);

  const handleComplete = () => {
    setIsCompleting(true);
    onComplete(task.id, true);
  };

  if (!task) {
    return (
      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-6 text-white shadow-lg mb-8">
        <h2 className="text-xl font-bold mb-2">All caught up!</h2>
        <p className="opacity-90">You have no pending tasks for today. Enjoy your free time!</p>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg mb-8 transition-[opacity,transform] duration-500 ${isCompleting ? "opacity-0 translate-y-4" : "opacity-100"}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-blue-100 text-sm font-medium mb-1">
            <span className="bg-white/20 px-2 py-0.5 rounded text-xs uppercase tracking-wider">Next Up</span>
            <span className="flex items-center gap-1">
              <FaClock className="w-3 h-3" />
              {timeLeft}
            </span>
          </div>
          <h2 className="text-2xl font-bold mb-2 mt-2 leading-tight">{task.title}</h2>
          {task.description && (
            <p className="text-blue-100 mb-4 line-clamp-2 text-sm">{task.description}</p>
          )}
          <div className="flex items-center gap-3 text-sm text-blue-100">
            <span>{format(new Date(task.dateTime), "h:mm a")}</span>
            <span>•</span>
            <span className="capitalize">{task.category}</span>
          </div>
        </div>
        
        <button
          onClick={handleComplete}
          className="group flex flex-col items-center gap-1"
        >
          <div className="w-12 h-12 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center transition-[background-color,color] group-hover:bg-white group-hover:text-blue-600">
            <FaCheckCircle className="w-6 h-6" />
          </div>
          <span className="text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">Done</span>
        </button>
      </div>
    </div>
  );
}
