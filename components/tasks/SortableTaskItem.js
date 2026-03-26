"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import TaskItem from "./TaskItem";

export default function SortableTaskItem({ task, isCompleting, animationDelay, ...rest }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TaskItem
      ref={setNodeRef}
      task={task}
      style={style}
      isDragging={isDragging}
      dragHandleListeners={listeners}
      dragHandleAttributes={attributes}
      {...rest}
    />
  );
}
