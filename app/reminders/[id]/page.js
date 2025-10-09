"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { FaClock, FaTag, FaEdit, FaArrowLeft } from "react-icons/fa";
import { format } from "date-fns";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

export default function ReminderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [reminder, setReminder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchReminder = async () => {
      try {
        const response = await fetch(`/api/reminders/${params.id}`);
        const data = await response.json();

        if (data.success) {
          setReminder(data.data);
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

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this reminder?")) {
      return;
    }

    try {
      const response = await fetch(`/api/reminders/${params.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.push("/reminders");
        router.refresh();
      }
    } catch (error) {
      console.error("Error deleting reminder:", error);
    }
  };

  const formatDateTime = (dateTime) => {
    return format(new Date(dateTime), "MMMM dd, yyyy 'at' hh:mm a");
  };

  const getCategoryColor = (category) => {
    const colors = {
      work: "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
      personal: "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
      health: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200",
      other: "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
    };
    return colors[category] || colors.other;
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

  if (error || !reminder) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded">
          {error || "Reminder not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Button
        variant="outline"
        onClick={() => router.push("/reminders")}
        className="mb-6 flex items-center space-x-2"
      >
        <FaArrowLeft />
        <span>Back to Reminders</span>
      </Button>

      <Card>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{reminder.title}</h1>
          <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
            <div className="flex items-center space-x-1">
              <FaClock />
              <span>{formatDateTime(reminder.dateTime)}</span>
            </div>
            <div className="flex items-center space-x-1">
              <FaTag />
              <span className={`px-2 py-1 rounded font-medium ${getCategoryColor(reminder.category)}`}>
                {reminder.category}
              </span>
            </div>
          </div>
        </div>

        {reminder.description && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Description</h2>
            <p className="text-gray-600 dark:text-gray-300">{reminder.description}</p>
          </div>
        )}

        {reminder.recurring && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Recurrence</h2>
            <span className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-3 py-1 rounded font-medium">
              Repeats {reminder.recurringType}
            </span>
          </div>
        )}

        <div className="flex space-x-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="primary"
            onClick={() => router.push(`/reminders/${reminder.id}/edit`)}
            className="flex items-center space-x-2"
          >
            <FaEdit />
            <span>Edit Reminder</span>
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete Reminder
          </Button>
        </div>
      </Card>
    </div>
  );
}
