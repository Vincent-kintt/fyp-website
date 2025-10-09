"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import ReminderForm from "@/components/reminders/ReminderForm";

export default function EditReminderPage() {
  const params = useParams();
  const router = useRouter();
  const [reminder, setReminder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchReminder = async () => {
      try {
        const response = await fetch(`/api/reminders/${params.id}`);
        const data = await response.json();

        if (data.success) {
          // Format dateTime for datetime-local input
          const formattedReminder = {
            ...data.data,
            dateTime: data.data.dateTime ? new Date(data.data.dateTime).toISOString().slice(0, 16) : "",
          };
          setReminder(formattedReminder);
        } else {
          setError("Reminder not found");
        }
      } catch (error) {
        console.error("Error fetching reminder:", error);
        setError("Failed to load reminder");
      } finally {
        setLoading(false);
      }
    };

    fetchReminder();
  }, [params.id]);

  const handleSubmit = async (formData) => {
    try {
      setIsSubmitting(true);
      setError("");

      const response = await fetch(`/api/reminders/${params.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        router.push(`/reminders/${params.id}`);
        router.refresh();
      } else {
        setError(data.error || "Failed to update reminder");
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error("Error updating reminder:", error);
      setError("An error occurred. Please try again.");
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading reminder...</p>
        </div>
      </div>
    );
  }

  if (error && !reminder) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="max-w-2xl mx-auto mb-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded">
          {error}
        </div>
      )}
      {reminder && (
        <ReminderForm
          initialData={reminder}
          onSubmit={handleSubmit}
          isEditing={true}
          disabled={isSubmitting}
        />
      )}
    </div>
  );
}
