"use client";

import { useState } from "react";
import { FaMagic, FaSpinner } from "react-icons/fa";
import Button from "../ui/Button";

export default function AIReminderInput({ onGenerate }) {
  const [text, setText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!text.trim()) {
      setError("Please enter a description");
      return;
    }

    try {
      setIsGenerating(true);
      setError("");

      const response = await fetch("/api/ai/generate-reminder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();

      if (data.success) {
        onGenerate(data.data);
        setText("");
      } else {
        setError(data.error || "Failed to generate reminder");
      }
    } catch (error) {
      console.error("Error generating reminder:", error);
      setError("An error occurred. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div className="bg-gradient-to-r from-primary-light to-info-light p-6 rounded-lg border-2 border-primary/30 mb-8">
      <div className="flex items-center space-x-2 mb-4">
        <FaMagic className="text-primary text-xl" />
        <h3 className="text-lg font-semibold text-text-primary">
          AI-Powered Reminder Generator
        </h3>
      </div>

      <p className="text-sm text-text-secondary mb-4">
        Just type what you want to remember in natural language, and AI will create a structured reminder for you!
      </p>

      <div className="space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="E.g., 'Remind me to call John tomorrow at 3pm' or 'Team meeting every Monday at 10am'"
          rows="3"
          disabled={isGenerating}
          className="w-full px-4 py-3 border border-input-border rounded-lg bg-input-bg text-text-primary placeholder-text-muted focus:ring-2 focus:ring-input-border-focus focus:border-transparent outline-none transition-all resize-none"
        />

        {error && (
          <p className="text-sm text-danger">{error}</p>
        )}

        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !text.trim()}
          variant="primary"
          className="w-full flex items-center justify-center space-x-2"
        >
          {isGenerating ? (
            <>
              <FaSpinner className="animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <FaMagic />
              <span>Generate Reminder with AI</span>
            </>
          )}
        </Button>
      </div>

      <div className="mt-4 pt-4 border-t border-primary/30">
        <p className="text-xs text-text-muted">
          💡 <strong>Examples:</strong> &ldquo;Doctor appointment next Friday at 2pm&rdquo; • &ldquo;Pay bills on the 1st of every month&rdquo; • &ldquo;Daily standup at 9am&rdquo;
        </p>
      </div>
    </div>
  );
}
