"use client";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  useDndSensors,
  createSectionAwareCollision,
  SECTION_IDS,
} from "@/lib/dnd.js";

export function useTaskDnD({ tasks, taskToSection }) {
  // UI drag state
  const [activeDragId, setActiveDragId] = useState(null);
  const [overSectionId, setOverSectionId] = useState(null);
  const [expandedByDrag, setExpandedByDrag] = useState(null);

  // Refs
  const expandTimer = useRef(null);
  const taskToSectionRef = useRef(new Map());

  // Sync ref with latest map (used by collision detection outside render cycle)
  useEffect(() => {
    taskToSectionRef.current = taskToSection;
  }, [taskToSection]);

  // Sensors
  const sensors = useDndSensors();

  // Collision detection — ref identity never changes, memo deps empty by design
  const collisionDetection = useMemo(
    () => createSectionAwareCollision(taskToSectionRef),
    [],
  );

  // Reset helper — idempotent
  const resetDragState = useCallback(() => {
    setActiveDragId(null);
    setOverSectionId(null);
    setExpandedByDrag(null);
    clearTimeout(expandTimer.current);
  }, []);

  // handleDragStart
  const handleDragStart = useCallback((event) => {
    setActiveDragId(event.active.id);
  }, []);

  // handleDragOver — preserve EXACT inline behavior including 500ms autoexpand
  const handleDragOver = useCallback(
    (event) => {
      const { active, over } = event;
      if (!over) {
        setOverSectionId(null);
        clearTimeout(expandTimer.current);
        return;
      }
      const section = taskToSection.get(over.id) || over.id;

      // Suppress overlay on Overdue for cross-section drags
      const activeSection = taskToSection.get(active.id);
      if (
        section === SECTION_IDS.OVERDUE &&
        activeSection !== SECTION_IDS.OVERDUE
      ) {
        setOverSectionId(null);
        clearTimeout(expandTimer.current);
        return;
      }

      setOverSectionId(section);

      // Auto-expand collapsed sections after 500ms hover
      if (section !== expandedByDrag) {
        clearTimeout(expandTimer.current);
        const validSections = new Set(Object.values(SECTION_IDS));
        if (validSections.has(section)) {
          expandTimer.current = setTimeout(() => {
            setExpandedByDrag(section);
          }, 500);
        }
      }
    },
    [taskToSection, expandedByDrag],
  );

  // handleDragCancel
  const handleDragCancel = useCallback(() => {
    resetDragState();
  }, [resetDragState]);

  // Derived state
  const activeDragTask = activeDragId
    ? tasks.find((t) => t.id === activeDragId)
    : null;
  const activeDragSourceSection = activeDragId
    ? taskToSection.get(activeDragId)
    : null;

  return {
    sensors,
    collisionDetection,
    activeDragId,
    overSectionId,
    expandedByDrag,
    handleDragStart,
    handleDragOver,
    handleDragCancel,
    activeDragTask,
    activeDragSourceSection,
    resetDragState,    // exposed for PR3a's inline handleDragEnd to call
  };
}
