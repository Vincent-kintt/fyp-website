"use client";

import { useState } from "react";
import Input from "../ui/Input";
import Button from "../ui/Button";

export default function ReminderForm({ initialData = {}, onSubmit, onCancel, disabled = false, isEditing = false, showTitle = true }) {
  const [formData, setFormData] = useState({
    title: initialData.title || "",
    description: initialData.description || "",
    dateTime: initialData.dateTime || "",
    category: initialData.category || "personal",
    recurring: initialData.recurring || false,
    recurringType: initialData.recurringType || "daily"
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-surface p-4 rounded-lg">
      {showTitle && (
        <h2 className="text-2xl font-bold mb-6 text-text-primary">
          {isEditing ? "Edit Reminder" : "Create New Reminder"}
        </h2>
      )}

      <Input
        label="Title"
        name="title"
        value={formData.title}
        onChange={handleChange}
        placeholder="Enter reminder title"
        required
      />

      <div className="mb-4">
        <label htmlFor="description" className="block text-sm font-medium text-text-secondary mb-1">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Enter reminder description (optional)"
          rows="4"
          className="w-full px-3 py-2 border border-input-border rounded-lg bg-input-bg text-text-primary focus:ring-2 focus:ring-input-border-focus focus:border-transparent outline-none transition-all"
        />
      </div>

      <Input
        label="Date & Time"
        type="datetime-local"
        name="dateTime"
        value={formData.dateTime}
        onChange={handleChange}
        required
      />

      <div className="mb-4">
        <label htmlFor="category" className="block text-sm font-medium text-text-secondary mb-1">
          Category <span className="text-danger">*</span>
        </label>
        <select
          id="category"
          name="category"
          value={formData.category}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 border border-input-border rounded-lg bg-input-bg text-text-primary focus:ring-2 focus:ring-input-border-focus focus:border-transparent outline-none transition-all"
        >
          <option value="personal">Personal</option>
          <option value="work">Work</option>
          <option value="health">Health</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="mb-4">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            name="recurring"
            checked={formData.recurring}
            onChange={handleChange}
            className="w-4 h-4 text-primary border-input-border rounded focus:ring-input-border-focus"
          />
          <span className="text-sm font-medium text-text-secondary">Recurring Reminder</span>
        </label>
      </div>

      {formData.recurring && (
        <div className="mb-4">
          <label htmlFor="recurringType" className="block text-sm font-medium text-text-secondary mb-1">
            Repeat <span className="text-danger">*</span>
          </label>
          <select
            id="recurringType"
            name="recurringType"
            value={formData.recurringType}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-input-border rounded-lg bg-input-bg text-text-primary focus:ring-2 focus:ring-input-border-focus focus:border-transparent outline-none transition-all"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
      )}

      <div className="flex space-x-4">
        <Button type="submit" variant="primary" className="flex-1" disabled={disabled}>
          {isEditing ? "Update Reminder" : "Create Reminder"}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" className="flex-1" onClick={onCancel} disabled={disabled}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
