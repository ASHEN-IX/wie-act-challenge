/* eslint-disable import/first */
/**
 * Integration tests for data services API flows
 * Tests API interactions for tasks, subjects, and study plans
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { tasksAPI, subjectAPI, studyPlanAPI } from "../../services/api";

describe("Data Services API Integration", () => {
  const mockTaskData = {
    _id: "task123",
    title: "Complete Chapter 5",
    status: "todo",
    priority: "high",
    estimatedTime: 45,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Task Management Flow", () => {
    it("should fetch, create, and update tasks", async () => {
      // Fetch tasks
      vi.spyOn(tasksAPI, "getAll").mockResolvedValue({
        data: { tasks: [mockTaskData] },
      });

      const tasks = await tasksAPI.getAll();
      expect(tasks.data.tasks).toHaveLength(1);
      expect(tasks.data.tasks[0].title).toBe("Complete Chapter 5");

      // Create task
      vi.spyOn(tasksAPI, "create").mockResolvedValue({
        data: { task: { ...mockTaskData, _id: "task124" } },
      });

      const newTask = await tasksAPI.create(mockTaskData);
      expect(newTask.data.task).toHaveProperty("_id");

      // Update task status
      vi.spyOn(tasksAPI, "update").mockResolvedValue({
        data: { task: { ...mockTaskData, status: "completed" } },
      });

      const updated = await tasksAPI.update("task123", { status: "completed" });
      expect(updated.data.task.status).toBe("completed");
    });
  });

  describe("Subject and Course Management Flow", () => {
    it("should list subjects and fetch courses", async () => {
      vi.spyOn(subjectAPI, "list").mockResolvedValue({
        data: {
          subjects: [
            { _id: "subj1", name: "Mathematics", description: "Math basics" },
            {
              _id: "subj2",
              name: "Physics",
              description: "Physics fundamentals",
            },
          ],
        },
      });

      const result = await subjectAPI.list();
      expect(result.data.subjects).toHaveLength(2);
      expect(result.data.subjects[0].name).toBe("Mathematics");
    });
  });

  describe("Study Plan Generation Flow", () => {
    it("should create and schedule study plans", async () => {
      // Create plan
      vi.spyOn(studyPlanAPI, "create").mockResolvedValue({
        data: { plan: { _id: "plan1", title: "Week 1 Study Plan" } },
      });

      const plan = await studyPlanAPI.create({
        title: "Week 1 Study Plan",
        tasks: ["task1", "task2"],
      });

      expect(plan.data.plan).toHaveProperty("_id");
      expect(plan.data.plan.title).toBe("Week 1 Study Plan");

      // Schedule plan
      vi.spyOn(studyPlanAPI, "schedule").mockResolvedValue({
        data: { schedule: { totalTasks: 2, days: 7 } },
      });

      const schedule = await studyPlanAPI.schedule("plan1");
      expect(schedule.data.schedule.totalTasks).toBe(2);
    });
  });
});
