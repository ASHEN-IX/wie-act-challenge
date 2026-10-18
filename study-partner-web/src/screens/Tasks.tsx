'use client';
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { tasksAPI } from "../services/api";
import { useAuthStore } from "../store/authStore";
import PlanTaskBadge from "../components/CompetencyMap/PlanTaskBadge";

const Tasks = () => {
  const { user } = useAuthStore();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, todo, in-progress, completed
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium",
    estimatedTime: "",
    dueDate: "",
    tags: "",
  });

  useEffect(() => {
    fetchTasks();
  }, [filter, user]);

  const fetchTasks = async () => {
    try {
      const params = filter !== "all" ? { status: filter } : {};
      const response = await tasksAPI.getAll(params);
      setTasks(response.data.tasks || []);
    } catch (error: any) {
      console.error("Failed to fetch tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    try {
      const taskData = {
        ...formData,
        estimatedTime: formData.estimatedTime
          ? parseInt(formData.estimatedTime)
          : undefined,
        tags: formData.tags
          ? formData.tags.split(",").map((t) => t.trim())
          : [],
      };

      if (editingTask) {
        await tasksAPI.update(editingTask._id, taskData);
      } else {
        await tasksAPI.create(taskData);
      }

      fetchTasks();
      resetForm();
    } catch (error: any) {
      console.error("Failed to save task:", error);
    }
  };

  const handleDelete = async (taskId: any) => {
    if (window.confirm("Are you sure you want to delete this task?")) {
      try {
        await tasksAPI.delete(taskId);
        fetchTasks();
      } catch (error: any) {
        console.error("Failed to delete task:", error);
      }
    }
  };

  const handleStatusChange = async (taskId: any, newStatus: any) => {
    try {
      await tasksAPI.update(taskId, { status: newStatus });
      fetchTasks();
    } catch (error: any) {
      console.error("Failed to update task status:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      priority: "medium",
      estimatedTime: "",
      dueDate: "",
      tags: "",
    });
    setEditingTask(null);
    setShowCreateModal(false);
  };

  const startEdit = (task: any) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || "",
      priority: task.priority || "medium",
      estimatedTime: task.estimatedTime || "",
      dueDate: task.dueDate
        ? new Date(task.dueDate).toISOString().split("T")[0]
        : "",
      tags: task.tags?.join(", ") || "",
    });
    setShowCreateModal(true);
  };

  const filteredTasks = tasks;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white text-xl font-bold tracking-wider">
          LOADING TASKS...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="bg-black/40 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-4xl font-bold tracking-wider uppercase">
                <span className="text-primary">{"//"}</span> TASKS
              </h1>
              <p className="text-white/60 mt-2">Manage your study tasks</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-primary hover:bg-primary/80 transition-all duration-300 font-bold tracking-wider text-primary-foreground"
              >
                + NEW TASK
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Filters */}
        <div className="flex gap-4 mb-8 flex-wrap">
          {["all", "todo", "in-progress", "completed"].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-6 py-2 font-bold tracking-wider transition-all border ${
                filter === status
                  ? "bg-primary border-primary text-white"
                  : "bg-white/5 backdrop-blur-sm border-white/10 text-white/60 hover:border-primary hover:bg-white/10"
              }`}
            >
              {status.toUpperCase().replace("-", " ")}
            </button>
          ))}
        </div>

        {/* Tasks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredTasks.length === 0 ? (
              <div className="col-span-full text-center py-20">
                <p className="text-muted-foreground text-xl mb-4">
                  NO TASKS FOUND
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-6 py-3 bg-[var(--accent-color-dynamic)] hover:bg-[var(--accent-color-dynamic-hover)] font-bold tracking-wider"
                >
                  CREATE YOUR FIRST TASK
                </button>
              </div>
            ) : (
              filteredTasks.map((task) => (
                <TaskCard
                  key={task._id}
                  task={task}
                  onEdit={startEdit}
                  onDelete={handleDelete}
                  onStatusChange={handleStatusChange}
                />
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={(e: any) => e.target === e.currentTarget && resetForm()}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0f1923]/85 backdrop-blur-xl border-2 border-primary p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-xl"
            >
              <h2 className="text-3xl font-bold mb-6">
                <span className="text-primary">{"//"}</span>{" "}
                {editingTask ? "EDIT" : "NEW"} TASK
              </h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold mb-2 text-white/80">
                    TITLE
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e: any) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-black/30 backdrop-blur-sm border border-white/10 focus:border-primary text-white outline-none rounded"
                    placeholder="Task title..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2 text-white/80">
                    DESCRIPTION
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e: any) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-black/30 backdrop-blur-sm border border-white/10 focus:border-primary text-white outline-none h-24 rounded"
                    placeholder="Task description..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-2 text-white/80">
                      PRIORITY
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e: any) =>
                        setFormData({ ...formData, priority: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-[#0f1923]/80 backdrop-blur-sm border border-white/10 focus:border-primary text-white outline-none rounded"
                    >
                      <option value="low">LOW</option>
                      <option value="medium">MEDIUM</option>
                      <option value="high">HIGH</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold mb-2 text-white/80">
                      ESTIMATED TIME (min)
                    </label>
                    <input
                      type="number"
                      value={formData.estimatedTime}
                      onChange={(e: any) =>
                        setFormData({
                          ...formData,
                          estimatedTime: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 bg-black/30 backdrop-blur-sm border border-white/10 focus:border-primary text-white outline-none rounded"
                      placeholder="60"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2 text-white/80">
                    DUE DATE
                  </label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e: any) =>
                      setFormData({ ...formData, dueDate: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-black/30 backdrop-blur-sm border border-white/10 focus:border-primary text-white outline-none rounded"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2 text-white/80">
                    TAGS (comma separated)
                  </label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e: any) =>
                      setFormData({ ...formData, tags: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-black/30 backdrop-blur-sm border border-white/10 focus:border-primary text-white outline-none rounded"
                    placeholder="math, homework, urgent"
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-[var(--accent-color-dynamic)] hover:bg-[var(--accent-color-dynamic-hover)] font-bold tracking-wider transition-all"
                  >
                    {editingTask ? "UPDATE" : "CREATE"} TASK
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 font-bold tracking-wider transition-all rounded"
                  >
                    CANCEL
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Planner modal removed from Tasks page — use Planner page for scheduling */}
    </div>
  );
};

const TaskCard = ({ task, onEdit, onDelete, onStatusChange }: any) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="bg-[#1a2633]/50 backdrop-blur-md border border-white/10 p-6 relative overflow-hidden group hover:border-[var(--accent-color-dynamic)] hover:bg-[#1a2633]/70 transition-all rounded-xl"
    >
      {/* Priority indicator */}
      <div
        className={`absolute top-0 left-0 w-full h-1 ${
          task.priority === "high"
            ? "bg-[var(--accent-color-dynamic)]"
            : task.priority === "medium"
              ? "bg-[var(--accent-color-dynamic)]"
              : "bg-[var(--accent-color-dynamic)]"
        }`}
      ></div>

      {/* Status Badge */}
      <div
        className={`absolute top-4 right-4 px-2 py-1 text-xs font-bold ${
          task.status === "completed"
            ? "bg-[var(--accent-color-dynamic)]/20 text-[var(--accent-color-dynamic)]"
            : task.status === "in-progress"
              ? "bg-[var(--accent-color-dynamic)]/20 text-[var(--accent-color-dynamic)]"
              : "bg-muted/50 text-muted-foreground"
        }`}
      >
        {task.status?.toUpperCase().replace("-", " ")}
      </div>

      {/* Content */}
      <div className="mt-2">
        <h3 className="text-xl font-bold mb-2 text-white">{task.title}</h3>
        {task.description && (
          <p className="text-white/60 text-sm mb-4 line-clamp-3">
            {task.description}
          </p>
        )}

        {/* Task source badge */}
        {task.studyPlanId && (
          <div className="mb-3">
            <span className="px-2 py-1 bg-[var(--accent-color-dynamic)]/20 text-[var(--accent-color-dynamic)] text-xs font-bold">
              FROM STUDY PLAN
            </span>
          </div>
        )}

        {/* BLOOM-11: target Bloom level badge from planner output */}
        {(task.targetBloomLevel || task.objectiveId) && (
          <div className="mb-3">
            <PlanTaskBadge
              level={task.targetBloomLevel}
              objectiveId={task.objectiveId}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          {task.tags?.map((tag: any, i: any) => (
            <span
              key={i}
              className="px-2 py-1 bg-white/10 text-xs text-white/60 rounded"
            >
              #{tag}
            </span>
          ))}
        </div>

        {task.estimatedTime && (
          <div className="text-sm text-white/50 mb-4">
            ⏱ {task.estimatedTime} minutes
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          {task.status !== "completed" && (
            <button
              onClick={() =>
                onStatusChange(
                  task._id,
                  task.status === "todo" ? "in-progress" : "completed",
                )
              }
              className="flex-1 px-3 py-2 bg-[var(--accent-color-dynamic)]/20 hover:bg-[var(--accent-color-dynamic)]/30 text-[var(--accent-color-dynamic)] text-sm font-bold transition-all"
            >
              {task.status === "todo" ? "START" : "COMPLETE"}
            </button>
          )}
          <button
            onClick={() => onEdit(task)}
            className="px-3 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 text-white text-sm font-bold transition-all rounded"
          >
            EDIT
          </button>
          <button
            onClick={() => onDelete(task._id)}
            className="px-3 py-2 bg-[var(--accent-color-dynamic)]/20 hover:bg-[var(--accent-color-dynamic)]/30 text-[var(--accent-color-dynamic)] text-sm font-bold transition-all"
          >
            DELETE
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default Tasks;
