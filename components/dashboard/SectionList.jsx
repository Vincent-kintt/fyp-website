"use client";

import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
} from "@dnd-kit/core";
import {
  FaSun,
  FaCalendarDay,
  FaCalendarWeek,
  FaCheckCircle,
  FaMoon,
} from "react-icons/fa";
import { SECTION_IDS, DROP_ANIMATION_CONFIG } from "@/lib/dnd.js";
import TaskItem from "@/components/tasks/TaskItem";
import TaskSection from "@/components/tasks/TaskSection";

export default function SectionList({
  sections,           // { overdueTasks, todayTasks, tomorrowTasks, thisWeekTasks, snoozedTasks, completedToday }
  taskHandlers,       // { onToggleComplete, onDelete, onUpdate, onSnooze, onEdit }
  dragHandlers,       // { sensors, collisionDetection, onDragStart, onDragOver, onDragEnd, onDragCancel }
  dragState,          // { activeDragId, overSectionId, expandedByDrag, activeDragTask, activeDragSourceSection }
  completingIds,
  onPlanWithAI,       // callback for Today's emptyAction
  t,
}) {
  const {
    overdueTasks, todayTasks, tomorrowTasks, thisWeekTasks, snoozedTasks, completedToday,
  } = sections;
  const { sensors, collisionDetection, onDragStart, onDragOver, onDragEnd, onDragCancel } = dragHandlers;
  const { activeDragId, overSectionId, expandedByDrag, activeDragTask, activeDragSourceSection } = dragState;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      measuring={{ droppable: { strategy: MeasuringStrategy.WhileDragging } }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      {/* Overdue Tasks */}
      {(overdueTasks.length > 0 || activeDragId) && (
        <TaskSection
          title={t("overdue")}
          icon={<FaCalendarDay />}
          tasks={overdueTasks}
          {...taskHandlers}
          accentColor="orange"
          emptyMessage={t("noOverdue")}
          sortable
          sectionId={SECTION_IDS.OVERDUE}
          droppable
          isExternalDragOver={
            activeDragId &&
            overSectionId === SECTION_IDS.OVERDUE &&
            activeDragSourceSection !== SECTION_IDS.OVERDUE
          }
          completingIds={completingIds}
          forceExpand={expandedByDrag === SECTION_IDS.OVERDUE}
        />
      )}

      {/* Today's Tasks */}
      <TaskSection
        title={t("todaySection")}
        icon={<FaSun />}
        tasks={todayTasks}
        {...taskHandlers}
        accentColor="blue"
        showDate={false}
        emptyMessage={t("noToday")}
        emptyAction={{
          text: t("planWithAI"),
          subtext: t("planWithAISubtext"),
          onClick: onPlanWithAI,
        }}
        sortable
        sectionId={SECTION_IDS.TODAY}
        droppable
        isExternalDragOver={
          activeDragId &&
          overSectionId === SECTION_IDS.TODAY &&
          activeDragSourceSection !== SECTION_IDS.TODAY
        }
        completingIds={completingIds}
        forceExpand={expandedByDrag === SECTION_IDS.TODAY}
      />

      {/* Tomorrow's Tasks */}
      <TaskSection
        title={t("tomorrow")}
        icon={<FaCalendarDay />}
        tasks={tomorrowTasks}
        {...taskHandlers}
        accentColor="green"
        defaultCollapsed={todayTasks.length > 3}
        emptyMessage={t("noTomorrow")}
        sortable
        sectionId={SECTION_IDS.TOMORROW}
        droppable
        isExternalDragOver={
          activeDragId &&
          overSectionId === SECTION_IDS.TOMORROW &&
          activeDragSourceSection !== SECTION_IDS.TOMORROW
        }
        completingIds={completingIds}
        forceExpand={expandedByDrag === SECTION_IDS.TOMORROW}
      />

      {/* This Week */}
      {(thisWeekTasks.length > 0 || activeDragId) && (
        <TaskSection
          title={t("thisWeek")}
          icon={<FaCalendarWeek />}
          tasks={thisWeekTasks}
          {...taskHandlers}
          accentColor="purple"
          defaultCollapsed={true}
          sortable
          sectionId={SECTION_IDS.THIS_WEEK}
          droppable
          isExternalDragOver={
            activeDragId &&
            overSectionId === SECTION_IDS.THIS_WEEK &&
            activeDragSourceSection !== SECTION_IDS.THIS_WEEK
          }
          completingIds={completingIds}
          forceExpand={expandedByDrag === SECTION_IDS.THIS_WEEK}
        />
      )}

      {/* Snoozed Tasks */}
      {(snoozedTasks.length > 0 || activeDragId) && (
        <TaskSection
          title={t("snoozed")}
          icon={<FaMoon />}
          tasks={snoozedTasks}
          {...taskHandlers}
          accentColor="purple"
          defaultCollapsed={!activeDragId && true}
          sortable
          sectionId={SECTION_IDS.SNOOZED}
          droppable
          isExternalDragOver={
            activeDragId &&
            overSectionId === SECTION_IDS.SNOOZED &&
            activeDragSourceSection !== SECTION_IDS.SNOOZED
          }
          completingIds={completingIds}
          forceExpand={expandedByDrag === SECTION_IDS.SNOOZED}
        />
      )}

      {/* Completed Today — always visible */}
      <TaskSection
        title={t("completedToday")}
        icon={<FaCheckCircle />}
        tasks={completedToday}
        {...taskHandlers}
        accentColor="gray"
        defaultCollapsed={false}
        showDate={false}
        sortable
        sectionId={SECTION_IDS.COMPLETED}
        droppable
        isExternalDragOver={
          activeDragId &&
          overSectionId === SECTION_IDS.COMPLETED &&
          activeDragSourceSection !== SECTION_IDS.COMPLETED
        }
        completingIds={completingIds}
        forceExpand={expandedByDrag === SECTION_IDS.COMPLETED}
      />

      <DragOverlay dropAnimation={DROP_ANIMATION_CONFIG}>
        {activeDragTask ? (
          <TaskItem
            task={activeDragTask}
            onToggleComplete={() => {}}
            onDelete={() => {}}
            onUpdate={() => {}}
            onEdit={() => {}}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
