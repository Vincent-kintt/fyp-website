"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import TaskItem from "./TaskItem";

// Stable references — defined outside component to avoid re-creation on every render
const noLayoutAnimation = () => false;
const sortableTransition = { duration: 150, easing: "cubic-bezier(0.25, 1, 0.5, 1)" };

export default function SortableTaskItem({ task, animationDelay, animationClass, ...rest }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    animateLayoutChanges: noLayoutAnimation,
    transition: sortableTransition,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition: transition
      ? `${transition}, background-color 150ms, opacity 200ms`
      : undefined,
    willChange: isDragging ? "transform" : undefined,
    contain: "layout style",
  };

  return (
    <TaskItem
      ref={setNodeRef}
      task={task}
      style={style}
      isDragging={isDragging}
      dragHandleListeners={listeners}
      dragHandleAttributes={attributes}
      animationClass={animationClass}
      animationDelay={animationDelay}
      {...rest}
    />
  );
}
