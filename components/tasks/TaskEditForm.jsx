"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { useTaskEditFormState } from "@/hooks/useTaskEditFormState";
import { useTaskEditFormSubmit } from "@/hooks/useTaskEditFormSubmit";
import ContentSection from "@/components/tasks/taskEditForm/ContentSection.jsx";
import ScheduleSection from "@/components/tasks/taskEditForm/ScheduleSection.jsx";
import DetailsSection from "@/components/tasks/taskEditForm/DetailsSection.jsx";
import TagsSection from "@/components/tasks/taskEditForm/TagsSection.jsx";
import SubtasksSection from "@/components/tasks/taskEditForm/SubtasksSection.jsx";
import Footer from "@/components/tasks/taskEditForm/Footer.jsx";

export default function TaskEditForm({ reminder, isActive, onSave, onCancel, variant = "modal", className = "" }) {
  const t = useTranslations("editForm");
  const {
    formData,
    setFormData,
    newSubtask,
    setNewSubtask,
    newTag,
    setNewTag,
    showSubtasks,
    setShowSubtasks,
    error,
    setError,
    handleChange,
    addTag,
    removeTag,
    addSubtask,
    removeSubtask,
  } = useTaskEditFormState({ reminder, isActive });
  const { handleSubmit, isSubmitting } = useTaskEditFormSubmit({
    reminder,
    formData,
    setError,
    onSave,
  });

  const handleSubtaskKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addSubtask(newSubtask);
      }
    },
    [addSubtask, newSubtask],
  );

  const handleTagKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addTag(newTag);
      }
    },
    [addTag, newTag],
  );

  const handleSelectDuration = useCallback(
    (value) => {
      setFormData((prev) => ({
        ...prev,
        duration: prev.duration === value ? null : value,
      }));
    },
    [setFormData],
  );

  const handleSelectStatus = useCallback(
    (status) => {
      setFormData((prev) => ({ ...prev, status }));
    },
    [setFormData],
  );

  const handleSelectPriority = useCallback(
    (priority) => {
      setFormData((prev) => ({ ...prev, priority }));
    },
    [setFormData],
  );

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className={`flex-1 overflow-y-auto p-4 space-y-6 ${className}`}
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(155, 155, 155, 0.5) transparent",
          fontSize: "14px",
          overscrollBehavior: "contain",
        }}
      >
        {error && (
          <div className="p-3 text-[13px] bg-red-500/10 border border-red-500/30 text-red-500 rounded-lg">
            {error}
          </div>
        )}

        <ContentSection formData={formData} onChange={handleChange} t={t} />

        <ScheduleSection
          formData={formData}
          onChange={handleChange}
          onSelectDuration={handleSelectDuration}
          t={t}
        />

        <DetailsSection
          formData={formData}
          onSelectStatus={handleSelectStatus}
          onSelectPriority={handleSelectPriority}
          t={t}
        />

        <TagsSection
          formData={formData}
          newTag={newTag}
          onNewTagChange={setNewTag}
          onTagKeyDown={handleTagKeyDown}
          onAddTag={addTag}
          onRemoveTag={removeTag}
          t={t}
        />

        <SubtasksSection
          formData={formData}
          newSubtask={newSubtask}
          onNewSubtaskChange={setNewSubtask}
          onSubtaskKeyDown={handleSubtaskKeyDown}
          onAddSubtask={addSubtask}
          onRemoveSubtask={removeSubtask}
          showSubtasks={showSubtasks}
          onExpand={() => setShowSubtasks(true)}
          t={t}
        />

        {/* Spacer for fixed footer */}
        <div className="h-2" />
      </form>

      <Footer
        variant={variant}
        isSubmitting={isSubmitting}
        onCancel={onCancel}
        onSubmit={handleSubmit}
        t={t}
      />
    </>
  );
}
