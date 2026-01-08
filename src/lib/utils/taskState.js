/**
 * TASK STATE UTILITIES
 * In-memory task state management for pause/resume
 *
 * DECISION: No persistence - resets on page refresh
 * Stores in React state only
 */

export function createTaskState(flowKey, taskType, currentStep) {
  return {
    taskId: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    flowKey,
    status: "IDLE",
    type: taskType,
    currentStep,
    savedContext: {
      messageCount: 0,
      customData: {},
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function updateTaskStatus(taskState, newStatus) {
  return {
    ...taskState,
    status: newStatus,
    updatedAt: Date.now(),
  };
}

export function pauseTask(taskState, messageCount, customData = {}) {
  if (taskState.status !== "RUNNING") {
    throw new Error(`Cannot pause task in ${taskState.status} status`);
  }

  return {
    ...taskState,
    status: "PAUSED",
    savedContext: {
      messageCount,
      customData,
    },
    updatedAt: Date.now(),
  };
}

export function resumeTask(taskState) {
  if (taskState.status !== "PAUSED") {
    throw new Error(`Cannot resume task in ${taskState.status} status`);
  }

  return {
    ...taskState,
    status: "RUNNING",
    updatedAt: Date.now(),
  };
}

export function completeTask(taskState) {
  return {
    ...taskState,
    status: "COMPLETED",
    completedAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function failTask(taskState, error) {
  return {
    ...taskState,
    status: "FAILED",
    error: error?.message || "Unknown error",
    updatedAt: Date.now(),
  };
}

export function canPauseTask(taskState) {
  return taskState.status === "RUNNING";
}

export function canResumeTask(taskState) {
  return taskState.status === "PAUSED";
}

export function isTaskTerminal(taskState) {
  return ["COMPLETED", "FAILED"].includes(taskState.status);
}

export function formatTaskStatus(taskState) {
  const statusEmojis = {
    IDLE: "⏳",
    RUNNING: "🔄",
    PAUSED: "⏸️",
    WAITING_INPUT: "⏺️",
    FAILED: "❌",
    COMPLETED: "✅",
  };

  return `${statusEmojis[taskState.status]} ${taskState.status}`;
}

export function getTaskDescription(taskState) {
  const descriptions = {
    IDLE: "Task initialized",
    RUNNING: "Task running...",
    PAUSED: "Task paused",
    WAITING_INPUT: "Waiting for input",
    FAILED: "Task failed",
    COMPLETED: "Task completed",
  };

  return descriptions[taskState.status] || "Unknown status";
}
